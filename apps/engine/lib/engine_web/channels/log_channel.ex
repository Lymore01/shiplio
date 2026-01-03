defmodule EngineWeb.LogChannel do
  use EngineWeb, :channel

  def join("logs:" <> project_id, _payload, socket) do
    # From UserSocket
    user_id = socket.assigns.user_id

    # Check if the project exists and belongs to the user
    if Engine.Projects.exists_for_user?(project_id, user_id) do
      EngineWeb.Endpoint.subscribe("logs:#{project_id}")
      {:ok, assign(socket, :project_id, project_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  def handle_info({:new_log, payload}, socket) do
    push(socket, "new_log", payload)
    {:noreply, socket}
  end
end
