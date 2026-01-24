defmodule EngineWeb.ProjectController do
  use EngineWeb, :controller
  require Logger
  alias Engine.Projects
  alias EngineWeb.Auth.Guardian

  def create(conn, %{"name" => name, "stack" => stack, "default_port" => default_port}) do
    user = Guardian.Plug.current_resource(conn)

    case Projects.create_project(user, %{name: name, stack: stack, default_port: default_port}) do
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
            url: project.local_url,
            default_port: project.default_port,
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
            stack: project.stack,
            status: project.status,
            url: project.local_url,
            default_port: project.default_port,
            duration: project.last_build_duration_ms,
            inserted_at: project.inserted_at,
            updated_at: project.updated_at
          }
        })
    end
  end

  def delete_project(conn, %{"id" => project_id} = params) do
    user = Guardian.Plug.current_resource(conn)
    soft_delete = Map.get(params, "soft") == "true"

    case Projects.get_project_for_user!(user, project_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{message: "Project not found."})

      project ->
        Task.Supervisor.start_child(Engine.TaskSupervisor, fn ->
          Engine.Deployments.CleanupWorker.run(project, soft: soft_delete)
        end)

        unless soft_delete do
          Projects.delete_project(project)
        end

        conn
        |> put_status(:no_content)
        |> json(%{message: "Project deleted successfully."})
    end
  end

  # def set_env_vars(conn, %{"id" => project_id, "env_vars" => env_vars}) do
  # end

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

  # defp finalize_upload(tmp_path, dest_path) do
  #   case File.cp(tmp_path, dest_path) do
  #     :ok ->
  #       # File.rm_rf(tmp_path)
  #       :ok

  #     {:error, reason} ->
  #       Logger.error("Failed to copy project files: #{reason}")
  #       # File.rm_rf(tmp_path)
  #       {:error, reason}
  #   end
  # end
end
