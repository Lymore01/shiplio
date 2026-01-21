defmodule EngineWeb.LogChannel do
  use EngineWeb, :channel
  alias Engine.Deployments.LogBuffer

  def join("logs:runtime:" <> project_id, payload, socket) do
    if authorized?(project_id, socket) do
      project = Engine.Projects.get_project!(project_id)

      tail_count = Map.get(payload, "tail", 20)

      Engine.Deployments.LogStreamSupervisor.start_log_streamer(
        project_id,
        project.container_id,
        tail_count
      )

      {:ok, assign(socket, :project_id, project_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # todo: update topic from logs:id to logs:build:id
  def join("logs:" <> project_id, _payload, socket) do
    if authorized?(project_id, socket) do
      historical_logs = LogBuffer.get_logs(project_id)
      send(self(), {:playback, historical_logs})

      {:ok, assign(socket, :project_id, project_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  def handle_info({:playback, logs}, socket) do
    Enum.each(logs, fn log ->
      push(socket, "new_log", log)
    end)

    {:noreply, socket}
  end

  def handle_info({:new_log, payload}, socket) do
    push(socket, "new_log", payload)
    {:noreply, socket}
  end

  def handle_info({:build_complete, payload}, socket) do
    push(socket, "build_complete", payload)
    {:noreply, socket}
  end

  def handle_info({:runtime_log, payload}, socket) do
    push(socket, "runtime_log", payload)
    {:noreply, socket}
  end

  defp authorized?(project_id, socket) do
    project_id = String.to_integer(project_id)
    Engine.Projects.exists_for_user?(project_id, socket.assigns.user_id)
  end
end
