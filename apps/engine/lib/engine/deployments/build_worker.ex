defmodule Engine.Deployments.BuildWorker do
  use GenServer, restart: :temporary
  alias Engine.Deployments.Templates
  alias Engine.Utils.PathGuard

  def start_link({project_id, path, public_env}) do
    GenServer.start_link(__MODULE__, {project_id, path, public_env})
  end

  @impl true
  def init({project_id, path, public_env}) do
    send(self(), :perform_build)
    {:ok, %{project_id: project_id, path: path, public_env: public_env}}
  end

  @impl true
  def handle_info(:perform_build, state) do
    start_time = System.monotonic_time(:milliseconds)
    Engine.Projects.update_project_status(state.project_id, "building")

    result =
      with {:ok, build_dir} <- extract_source(state),
           {:ok, config} <- resolve_config(state.project_id, build_dir),
           {:ok, context_dir} <- prepare_build_context(state.project_id, build_dir, config),
           {:ok, image_tag} <- run_docker_build(state.project_id, context_dir) do
        run_docker_container(state.project_id, image_tag, state.public_env)
      end

    log_info(state.project_id, :cleanup, "Cleaning up build workspace...")
    PathGuard.safe_delete_project(state.project_id)

    case result do
      {:ok, port, container_id} ->
        end_time = System.monotonic_time(:milliseconds)
        duration_ms = end_time - start_time

        formatted_duration = format_duration(duration_ms)

        {:ok, updated_project} =
          Engine.Projects.mark_project_as_active(
            state.project_id,
            port,
            container_id,
            duration_ms
          )

        EngineWeb.Endpoint.broadcast("logs:#{state.project_id}", "build_complete", %{
          url: updated_project.local_url,
          duration: formatted_duration
        })

      {:error, reason} ->
        end_time = System.monotonic_time(:milliseconds)
        duration_ms = end_time - start_time

        Engine.Projects.update_project_by_id(state.project_id, %{
          status: "failed",
          last_build_duration_ms: duration_ms
        })

        log_error(state.project_id, :done, "Deployment failed: #{reason}")
    end

    Engine.Deployments.LogBuffer.clear_logs_delayed(state.project_id)

    {:stop, :normal, state}
  end

  def handle_info({:clear_buffer, project_id}, state) do
    Engine.Deployments.LogBuffer.clear_logs(project_id)
    {:noreply, state}
  end

  defp extract_source(state) do
    abs_archive_path = Path.expand(state.path)
    build_dir = Path.dirname(abs_archive_path)
    _archive_file = Path.basename(abs_archive_path)

    log_info(state.project_id, :extract, "Extracting source code...")

    cmd = "tar -xzvf \"#{abs_archive_path}\" -C \"#{build_dir}\""
    port = Port.open({:spawn, cmd}, [:binary, :exit_status, :stderr_to_stdout, :line])

    status = await_port_completion(port, state.project_id, :extract)

    File.rm!(abs_archive_path)

    if status == 0 do
      log_success(state.project_id, :extract, "Source extracted successfully")
      {:ok, build_dir}
    else
      log_error(state.project_id, :extract, "Source extraction failed")
      {:error, "Source extraction failed"}
    end
  end

  defp resolve_config(project_id, build_dir) do
    config_path = Path.join(build_dir, "shiplio.json")

    cond do
      File.exists?(config_path) ->
        log_info(project_id, :config, "Found shiplio.json config")
        {:ok, Jason.decode!(File.read!(config_path))}

      File.exists?(Path.join(build_dir, "package.json")) ->
        log_info(project_id, :config, "Auto-detected Node.js environment")
        {:ok, %{"runtime" => "nodejs", "scripts" => %{}}}

      true ->
        log_info(project_id, :config, "Falling back to raw Dockerfile mode")
        {:ok, %{"runtime" => "dockerfile", "scripts" => %{}}}
    end
  end

  defp prepare_build_context(project_id, build_dir, config) do
    stack_type = config["stack"] || "unknown"
    dockerfile_path = Path.wildcard("#{build_dir}/**/[Dd]ockerfile") |> List.first()

    if dockerfile_path do
      log_info(project_id, :dockerfile, "Using provided Dockerfile")
      normalize_encoding(dockerfile_path)
      {:ok, Path.dirname(dockerfile_path)}
    else
      log_info(project_id, :dockerfile, "Generating Dockerfile (#{stack_type})")
      content = Templates.get_dockerfile(build_dir, stack_type, config)
      File.write!(Path.join(build_dir, "Dockerfile"), content)
      {:ok, build_dir}
    end
  end

  defp run_docker_build(project_id, context_dir) do
    tag = "shiplio-app-#{project_id}"
    log_info(project_id, :build, "Building Docker image...")

    exe = System.find_executable("docker") || "docker"

    port =
      Port.open(
        {:spawn_executable, exe},
        [
          {:args,
           [
             "build",
             "--progress=plain",
             "--provenance=false",
             "--attest=type=sbom,disabled=true",
             "-t",
             tag,
             context_dir
           ]},
          :binary,
          :exit_status,
          :stderr_to_stdout,
          :line,
          :hide
        ]
      )

    case await_port_completion(port, project_id, :build) do
      0 ->
        log_success(project_id, :build, "Docker image built")
        {:ok, tag}

      _ ->
        {:error, "Docker build failed"}
    end
  end

  defp await_port_completion(port, project_id, step, timeout \\ 300_000) do
    receive do
      {^port, {:data, {:line, msg}}} ->
        process_and_broadcast(msg, project_id, step)
        await_port_completion(port, project_id, step, timeout)

      {^port, {:data, {_, msg}}} when is_binary(msg) ->
        process_and_broadcast(msg, project_id, step)
        await_port_completion(port, project_id, step, timeout)

      {^port, {:data, msg}} when is_binary(msg) ->
        process_and_broadcast(msg, project_id, step)
        await_port_completion(port, project_id, step, timeout)

      {^port, {:exit_status, status}} ->
        status
    after
      timeout ->
        Port.close(port)
        {:error, :timeout}
    end
  end

  defp process_and_broadcast(msg, project_id, step) do
    clean_msg = String.replace(msg, ~r/\e\[[0-9;]*m/, "")
    broadcast(project_id, :info, step, clean_msg)
  end

  def run_docker_container(project_id, image_tag, public_env \\ %{}) do
    project = Engine.Projects.get_project!(project_id)

    container_name = "shiplio-container-#{project_id}"

    public_port = project.dedicated_port || Engine.Utils.PortAllocator.allocate_next_port()
    internal_port = project.default_port || 3000

    merged_env = Map.merge(public_env, project.env_vars || %{})

    env_flags =
      merged_env
      |> Enum.map(fn {k, v} -> "-e #{k}='#{v}'" end)
      |> Enum.join(" ")

    log_info(project_id, :run, "Cleaning up existing containers")
    System.shell("docker rm -f #{container_name} > #{dev_null()} 2>&1")

    log_info(project_id, :run, "Booting container")

    run_cmd = """
    docker run -d \
      --name #{container_name} \
      -p #{public_port}:#{internal_port} \
      -e PORT=#{internal_port} \
      #{env_flags} \
      --memory="512m" \
      --cpus="0.5" \
      #{image_tag}
    """

    case System.shell(run_cmd) do
      {raw_id, 0} ->
        container_id = String.trim(raw_id)

        log_info(project_id, :run, "Waiting for app on port #{public_port}")

        {:ok, public_port, container_id}

      _ ->
        {:error, "Failed to start container"}
    end
  end

  defp dev_null do
    if :os.type() == {:win32, :nt}, do: "nul", else: "/dev/null"
  end

  defp log_info(project_id, step, msg),
    do: broadcast(project_id, :info, step, msg)

  defp log_success(project_id, step, msg),
    do: broadcast(project_id, :success, step, msg)

  defp log_error(project_id, step, msg),
    do: broadcast(project_id, :error, step, msg)

  defp broadcast(project_id, level, step, msg) do
    event = %{
      level: Atom.to_string(level),
      step: step,
      message: msg,
      timestamp: DateTime.utc_now()
    }

    Engine.Deployments.LogBuffer.add_log(project_id, event)

    EngineWeb.Endpoint.broadcast("logs:#{project_id}", "new_log", event)

    IO.puts("[#{level}] #{msg}")
  end

  # defp log_stream(project_id, step) do
  #   %Engine.Deployments.LogCollector{
  #     project_id: project_id,
  #     step: step
  #   }
  # end

  defp normalize_encoding(path) do
    content =
      File.read!(path)
      |> String.replace(~r/[^\x09\x0A\x0D\x20-\x7E]/, "")

    File.write!(path, content)
  end

  defp wait_for_healthy(port, retries \\ 10)
  defp wait_for_healthy(_, 0), do: {:error, :timeout}

  defp wait_for_healthy(port, retries) do
    case :gen_tcp.connect(~c"localhost", String.to_integer(port), [], 1000) do
      {:ok, socket} ->
        :gen_tcp.close(socket)
        :ok

      _ ->
        Process.sleep(1000)
        wait_for_healthy(port, retries - 1)
    end
  end

  defp format_duration(ms) when ms < 1000, do: "#{ms}ms"
  defp format_duration(ms), do: "#{Float.round(ms / 1000, 2)}s"
end
