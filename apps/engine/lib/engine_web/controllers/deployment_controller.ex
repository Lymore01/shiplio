defmodule EngineWeb.DeploymentController do
  use EngineWeb, :controller


  plug Guardian.Plug.EnsureAuthenticated
  def create(conn, %{"id" => project_id}) do
    current_user = EngineWeb.Auth.Guardian.Plug.current_resource(conn)

    json(conn, %{message: "Deployment started for project #{project_id} by user #{current_user.id}"})
  end
end
