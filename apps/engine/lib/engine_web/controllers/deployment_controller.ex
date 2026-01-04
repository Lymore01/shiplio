defmodule EngineWeb.DeploymentController do
  use EngineWeb, :controller

  plug Guardian.Plug.EnsureAuthenticated

  # wraps the file upload in a %Plug.Upload struct

  def create(conn, %{"id" => project_id, "file" => upload}) do
    current_user = EngineWeb.Auth.Guardian.Plug.current_resource(conn)
    source_path = upload.path

    Engine.Deployments.BuildSupervisor.start_build(project_id, source_path)

    json(conn, %{
      message: "Deployment started for project #{project_id} by user #{current_user.id}"
    })
  end
end

# todo: validate path
