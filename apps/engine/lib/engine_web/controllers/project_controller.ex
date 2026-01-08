defmodule EngineWeb.ProjectController do
  use EngineWeb, :controller
  alias Engine.Projects
  alias EngineWeb.Auth.Guardian

  def create(conn, %{"name" => name}) do
    user = Guardian.Plug.current_resource(conn)

    case Projects.create_project(user, %{name: name}) do
      {:ok, project} ->
        conn
        |> put_status(:created)
        |> json(%{
          data: %{
            id: project.id,
            name: project.name,
            status: project.status,
            inserted_at: project.inserted_at
          },
          message: "Project shell created successfully."
        })

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          message: "Could not create project",
          errors: EngineWeb.ChangesetJSON.error_details(changeset)
        })
    end
  end

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    projects = Projects.list_user_projects(user)

    json(conn, %{
      data:
        Enum.map(projects, fn project ->
          %{
            id: project.id,
            name: project.name,
            status: project.status,
            inserted_at: project.inserted_at
          }
        end)
    })
  end

  def show(conn, %{"id" => project_id}) do
    user = Guardian.Plug.current_resource(conn)

    case Projects.get_project_for_user(user, project_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{message: "Project not found."})

      project ->
        json(conn, %{
          data: %{
            id: project.id,
            name: project.name,
            status: project.status,
            inserted_at: project.inserted_at
          }
        })
    end
  end

  def set_env_vars(conn, %{"id" => project_id, "env_vars" => env_vars}) do
  end

  def deploy(conn, %{"id" => project_id, "file" => %Plug.Upload{path: tmp_path}}) do
    root = Application.get_env(:engine, :uploads)[:root_path] || "uploads"
    user = Guardian.Plug.current_resource(conn)
    project = Projects.get_project_for_user!(user, project_id)

    timestamp = DateTime.utc_now() |> DateTime.to_unix() |> Integer.to_string()

    dest_path = Path.join([root, project_id, timestamp, "source.tar.gz"])
    File.mkdir_p!(Path.dirname(dest_path))

    case File.cp(tmp_path, dest_path) do
      :ok ->
        Engine.Deployments.BuildSupervisor.start_build(project.id, dest_path)

        conn
        |> put_status(:accepted)
        |> json(%{message: "Build triggered in background", project: project.name})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{
          message: "Could not upload file.",
          error: reason
        })
    end
  end
end
