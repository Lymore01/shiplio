defmodule Engine.Deployments.BuildWorker do
  use GenServer, restart: :temporary
  alias Engine.Deployments.Templates

  def start_link({project_id, path}) do
    GenServer.start_link(__MODULE__, {project_id, path})
  end

  @impl true
  def init({project_id, path}) do
    send(self(), :perform_build)
    {:ok, %{project_id: project_id, path: path}}
  end

  @impl true
  def handle_info(:perform_build, state) do
    workspace_dir = Path.dirname(state.path)

    result =
      with {:ok, build_dir} <- extract_source(state),
           {:ok, config} <- resolve_config(state.project_id, build_dir),
           {:ok, context_dir} <- prepare_build_context(state.project_id, build_dir, config),
           {:ok, image_tag} <- run_docker_build(state.project_id, context_dir) do
        run_docker_container(state.project_id, image_tag)
      end

    log_info(state.project_id, :cleanup, "🧹 Cleaning up build workspace...")
    File.rm_rf!(workspace_dir)

    case result do
      {:ok, _port} ->
        log_success(state.project_id, :done, "✅ Deployment successful!")

      {:error, reason} ->
        log_error(state.project_id, :done, "❌ Deployment failed: #{reason}")
    end

    {:stop, :normal, state}
  end

  defp extract_source(state) do
    abs_archive_path = Path.expand(state.path)
    build_dir = Path.dirname(abs_archive_path)
    archive_file = Path.basename(abs_archive_path)

    log_info(state.project_id, :extract, "📦 Extracting source code...")

    cd_cmd = if :os.type() == {:win32, :nt}, do: "cd /d", else: "cd"
    command = "#{cd_cmd} \"#{build_dir}\" && tar -xzvf \"#{archive_file}\""

    {_, exit_code} =
      System.shell(command,
        stderr_to_stdout: true,
        into: log_stream(state.project_id, :extract)
      )

    if exit_code == 0 do
      File.rm!(abs_archive_path)
      log_success(state.project_id, :extract, "✔ Source extracted successfully")
      {:ok, build_dir}
    else
      File.rm!(abs_archive_path)
      log_error(state.project_id, :extract, "❌ Source extraction failed")
      {:error, "Source extraction failed"}
    end
  end

  defp resolve_config(project_id, build_dir) do
    config_path = Path.join(build_dir, "shiplio.json")

    cond do
      File.exists?(config_path) ->
        log_info(project_id, :config, "🔍 Found shiplio.json config")
        {:ok, Jason.decode!(File.read!(config_path))}

      File.exists?(Path.join(build_dir, "package.json")) ->
        log_info(project_id, :config, "🔍 Auto-detected Node.js environment")
        {:ok, %{"runtime" => "nodejs", "scripts" => %{}}}

      true ->
        log_info(project_id, :config, "🔍 Falling back to raw Dockerfile mode")
        {:ok, %{"runtime" => "dockerfile", "scripts" => %{}}}
    end
  end

  defp prepare_build_context(project_id, build_dir, config) do
    dockerfile_path = Path.wildcard("#{build_dir}/**/[Dd]ockerfile") |> List.first()

    if dockerfile_path do
      log_info(project_id, :dockerfile, "📜 Using provided Dockerfile")
      normalize_encoding(dockerfile_path)
      {:ok, Path.dirname(dockerfile_path)}
    else
      log_info(project_id, :dockerfile, "🔨 Generating Dockerfile (#{config["runtime"]})")
      content = Templates.get_dockerfile(config["runtime"], config)
      File.write!(Path.join(build_dir, "Dockerfile"), content)
      {:ok, build_dir}
    end
  end

  defp run_docker_build(project_id, context_dir) do
    tag = "shiplio-app-#{project_id}"

    log_info(project_id, :build, "🚀 Building Docker image...")

    {_, exit_code} =
      System.shell("docker build -t #{tag} \"#{context_dir}\"",
        stderr_to_stdout: true,
        into: log_stream(project_id, :build)
      )

    if exit_code == 0 do
      log_success(project_id, :build, "✔ Docker image built")
      {:ok, tag}
    else
      {:error, "Docker build failed"}
    end
  end

  defp run_docker_container(project_id, image_tag) do
    container_name = "shiplio-container-#{project_id}"

    log_info(project_id, :run, "🧹 Cleaning up existing containers")
    System.shell("docker rm -f #{container_name} > /dev/null 2>&1")

    log_info(project_id, :run, "🚀 Booting container")

    run_cmd = """
    docker run -d \
      --name #{container_name} \
      -p :8080 \
      --memory="512m" \
      --cpus="0.5" \
      #{image_tag}
    """

    case System.shell(run_cmd) do
      {_out, 0} ->
        {raw, 0} = System.shell("docker port #{container_name} 8080")

        port =
          raw
          |> String.trim()
          |> String.split(":")
          |> List.last()

        log_info(project_id, :run, "⏳ Waiting for app on port #{port}")

        case wait_for_healthy(port) do
          :ok ->
            log_success(project_id, :run, "✨ App LIVE at http://localhost:#{port}")
            {:ok, port}

          {:error, _} ->
            {:error, "Container started but health check failed"}
        end

      _ ->
        {:error, "Failed to start container"}
    end
  end


  defp log_info(project_id, step, msg),
    do: broadcast(project_id, :info, step, msg)

  defp log_success(project_id, step, msg),
    do: broadcast(project_id, :success, step, msg)

  defp log_error(project_id, step, msg),
    do: broadcast(project_id, :error, step, msg)

  defp broadcast(project_id, level, step, msg) do
    event = %{
      level: level,
      step: step,
      message: msg,
      timestamp: DateTime.utc_now()
    }

    Phoenix.PubSub.broadcast(
      Engine.PubSub,
      "logs:#{project_id}",
      {:new_log, event}
    )

    IO.puts("[#{level}] #{msg}")
  end

  defp log_stream(project_id, step) do
    %Engine.Deployments.LogCollector{
      project_id: project_id,
      step: step
    }
  end

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
end
