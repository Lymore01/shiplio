defmodule Engine.Deployments.BuildWorker do
  use GenServer, restart: :temporary
  alias Engine.Deployments.Templates
  alias Engine.Deployments.Storage

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
    result =
      with {:ok, build_dir} <- extract_source(state),
           {:ok, config} <- resolve_config(state.project_id, build_dir),
           {:ok, context_dir} <- prepare_build_context(state.project_id, build_dir, config),
           {:ok, image_tag} <- run_docker_build(state.project_id, context_dir) do
        run_docker_container(state.project_id, image_tag)
      end

    case result do
      {:ok, _} -> broadcast_log(state.project_id, "✅ Deployment successful!\n")
      {:error, reason} -> broadcast_log(state.project_id, "\n❌ Deployment failed: #{reason}\n")
    end

    {:stop, :normal, state}
  end

  defp extract_source(state) do
    build_dir = Storage.build_path(state.project_id)
    File.mkdir_p!(build_dir)

    broadcast_log(state.project_id, "📦 Extracting source code...\n")

    command = "tar -xzvf \"#{state.path}\" -C \"#{build_dir}\""

    {_, exit_code} =
      System.shell(command,
        stderr_to_stdout: true,
       into: %Engine.Deployments.LogCollector{project_id: state.project_id, prefix: "extract"}
      )

    case exit_code do
      0 ->
        File.rm!(state.path)
        {:ok, build_dir}

      _ ->
        {:error, "Extraction failed"}
    end
  end

  defp resolve_config(project_id, build_dir) do
    config_path = Path.join(build_dir, "shiplio.json")

    if File.exists?(config_path) do
      broadcast_log(project_id, "🔍 Found shiplio.json config.\n")
      {:ok, Jason.decode!(File.read!(config_path))}
    else
      cond do
        File.exists?(Path.join(build_dir, "package.json")) ->
          broadcast_log(project_id, "🔍 No config found. Auto-detected Node.js environment.\n")
          {:ok, %{"runtime" => "nodejs", "scripts" => %{}}}

        true ->
          broadcast_log(project_id, "🔍 No config found. Falling back to raw Dockerfile mode.\n")
          {:ok, %{"runtime" => "dockerfile", "scripts" => %{}}}
      end
    end
  end

  defp prepare_build_context(project_id, build_dir, config) do
    dockerfile_path = Path.wildcard("#{build_dir}/**/[Dd]ockerfile") |> List.first()

    if dockerfile_path do
      broadcast_log(project_id, "📜 Using provided Dockerfile at #{dockerfile_path}\n")
      normalize_encoding(dockerfile_path)
      {:ok, Path.dirname(dockerfile_path)}
    else
      broadcast_log(project_id, "🔨 Generating Dockerfile for #{config["runtime"]}...\n")
      content = Templates.get_dockerfile(config["runtime"], config)
      File.write!(Path.join(build_dir, "Dockerfile"), content)
      {:ok, build_dir}
    end
  end

  defp run_docker_build(project_id, context_dir) do
    tag = "shiplio-app-#{project_id}"
    broadcast_log(project_id, "Starting Docker build...\n")

    {_, exit_code} =
      System.shell("docker build -t #{tag} \"#{context_dir}\"",
        stderr_to_stdout: true,
        into: %Engine.Deployments.LogCollector{project_id: project_id, prefix: "build"}
      )

    if exit_code == 0, do: {:ok, tag}, else: {:error, "Build failed"}
  end

  defp run_docker_container(project_id, project_tag) do
    container_name = "shiplio-container-#{project_id}"

    broadcast_log(project_id, "🧹 Cleaning up existing instances...\n")
    System.shell("docker rm -f #{container_name} > /dev/null 2>&1")

    broadcast_log(project_id, "Booting container...\n")

    run_command = """
    docker run -d \
      --name #{container_name} \
      -p :8080 \
      --memory="512m" \
      --cpus="0.5" \
      #{project_tag}
    """

    case System.shell(run_command) do
      {_output, 0} ->
        {raw_output, 0} = System.shell("docker port #{container_name} 8080")

        port =
          raw_output
          |> String.trim()
          |> String.split(":")
          |> List.last()

        broadcast_log(project_id, "⏳ Waiting for app to become healthy on port #{port}...\n")

        case wait_for_healthy(port) do
          :ok ->
            broadcast_log(project_id, "✨ App is LIVE at http://localhost:#{port}\n")
            {:ok, port}

          {:error, _} ->
            {:error, "App started but failed to respond on port #{port}"}
        end

      {error, _} ->
        {:error, "Failed to start container: #{error}"}
    end
  end

  def broadcast_log(project_id, message) do
    IO.write(message)

    Phoenix.PubSub.broadcast(
      Engine.PubSub,
      "logs:#{project_id}",
      {:new_log, %{message: message}}
    )
  end

  defp normalize_encoding(path) do
    content = File.read!(path) |> String.replace(~r/[^\x20-\x7E\n\r\t]/, "")
    File.write!(path, content)
  end

  defp wait_for_healthy(port, retries \\ 10)
  defp wait_for_healthy(_port, 0), do: {:error, :timeout}

  defp wait_for_healthy(port, retries) do
    case :gen_tcp.connect(~c'localhost', String.to_integer(port), [], 1000) do
      {:ok, socket} ->
        :gen_tcp.close(socket)
        :ok

      {:error, _} ->
        Process.sleep(1000)
        wait_for_healthy(port, retries - 1)
    end
  end
end
