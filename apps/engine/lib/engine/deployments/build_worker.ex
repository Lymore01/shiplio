defmodule Engine.Deployments.BuildWorker do
  use GenServer, restart: :temporary

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
    build_dir = Path.dirname(state.path)
    project_tag = "shiplio-app-#{state.project_id}"

    broadcast_log(state.project_id, "📦 Extracting source code...\n")

    case System.shell("tar -xzf \"#{state.path}\" -C \"#{build_dir}\"") do
      {_output, 0} ->
        File.rm!(state.path)

        context_dir =
          case Path.wildcard("#{build_dir}/**/[Dd]ockerfile") do
            [path | _] -> Path.dirname(path)
            [] -> build_dir
          end

        broadcast_log(state.project_id, "🚀 Starting build in #{context_dir}...\n")

        {_output, exit_code} =
          System.shell("docker build -t #{project_tag} #{context_dir}",
            stderr_to_stdout: true,
            into: %IO.Stream{device: :standard_io, line_or_bytes: :line}
          )

        if exit_code != 0 do
          broadcast_log(state.project_id, "❌ Build failed with exit code #{exit_code}.\n")
        else
          run_docker_container(state.project_id, project_tag)
        end

      {error, _} ->
        broadcast_log(state.project_id, "❌ Failed to extract archive: #{error}\n")
    end

    {:stop, :normal, state}
  end

  defp broadcast_log(project_id, message) do
    IO.write(message)

    Phoenix.PubSub.broadcast(
      Engine.PubSub,
      "logs:#{project_id}",
      {:new_log, %{message: message}}
    )
  end

  defp run_docker_container(project_id, project_tag) do
    container_name = "shiplio-container-#{project_id}"

    {:ok, socket} = :gen_tcp.listen(0, [])
    {:ok, port} = :inet.port(socket)
    :gen_tcp.close(socket)

    System.shell("docker rm -f #{container_name} > /dev/null 2>&1")

    # 2. Use the dynamic port
    run_command = "docker run -d --name #{container_name} -p #{port}:8080 #{project_tag}"

    case System.shell(run_command) do
      {_output, 0} ->
        broadcast_log(project_id, "✨ App is LIVE at http://localhost:#{port}\n")
        broadcast_log(project_id, "✅ Deployment successful!\n")

      {error, _} ->
        broadcast_log(project_id, "❌ Failed to start container: #{error}\n")
    end
  end
end
