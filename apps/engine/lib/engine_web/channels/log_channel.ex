defmodule EngineWeb.LogChannel do
  use EngineWeb, :channel
  alias Engine.Deployments.LogBuffer

  def join("logs:" <> project_id, _payload, socket) do
    user_id = socket.assigns.user_id

    if Engine.Projects.exists_for_user?(project_id, user_id) do
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
end
