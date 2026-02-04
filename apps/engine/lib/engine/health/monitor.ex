defmodule Engine.Health.Monitor do
  require Logger
  use GenServer

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{projects: []}, name: :health_monitor)
  end

  def start_monitoring(project_id, port, container_id) do
    GenServer.cast(
      :health_monitor,
      {:monitor_project,
       %{
         project_id: project_id,
         port: port,
         container_id: container_id,
         ip: "localhost",
         failures: 0,
         status: :up
       }}
    )
  end

  def init(state) do
    schedule_check()
  end

  def handle_cast({:monitor_project, new_project}, state) do
    Logger.info("Monitoring started for #{new_project.project_id}")
    {:noreply, %{state | projects: [new_project | state.projects]}}
  end

  def handle_info(:check_health, state) do
    new_projects =
      Enum.map(state.projects, fn project ->
        case Engine.Utils.HealthCheck.quick_check(project.ip, project.port) do
          {:ok, :healthy} ->
            %{project | status: :up, failures: 0}

          {:error, :unhealthy} ->
            handle_unhealthy_project(project)
        end
      end)

    schedule_check()
    {:noreply, %{state | projects: new_projects}}
  end

  defp handle_unhealthy_project(project) do
    new_failures = project.failures + 1
    Logger.warn("Project #{project.name} is unhealthy (Failure #{new_failures}/3)")

    cond do
      new_failures < 3 ->
        %{project | failures: new_failures, status: :degraded}

      new_failures == 3 ->
        attempt_restart(project)
        %{project | failures: new_failures, status: :restarting}

      new_failures > 5 ->
        notify_failure(project)
        stop_and_quarantine(project)
        %{project | failures: new_failures, status: :down}

      true ->
        %{project | failures: new_failures}
    end
  end

  defp schedule_check, do: Process.send_after(self(), :check_health, 30_000)

  defp attempt_restart(project) do
    Logger.info("Health Monitor: Attempting automatic restart of #{project.name}...")

    EngineWeb.Endpoint.broadcast("logs:#{project.id}", "system_msg", %{
      message: "⚠️ App unhealthy. Attempting automatic restart..."
    })

    Engine.Docker.Client.restart_container(project.container_id)
  end

  defp notify_failure(project) do
    Logger.error("Health Monitor: Project #{project.name} has failed multiple health checks.")

    EngineWeb.Endpoint.broadcast("logs:#{project.project_id}", "system_msg", %{
      message: "App failed multiple health checks and will be stopped."
    })
  end

  defp stop_and_quarantine(project) do
    Logger.error("Health Monitor: Project #{project.name} failed too many times. Shutting down.")

    # 1. Kill the container
    Engine.Docker.Client.stop_container(project.container_id)

    # 2. Remove from Caddy so users don't see a broken link
    Engine.Proxy.Caddy.unregister_route(project.project_id)

    # 3. Update DB
    Engine.Projects.update_project_by_id(project.project_id, %{status: "failed"})
  end
end
