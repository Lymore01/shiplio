defmodule Engine.Projects do
  @moduledoc """
  The Projects context. Handles Provisioning and Metadata for Shiplio apps.
  """

  import Ecto.Query, warn: false
  alias Engine.Repo
  alias Engine.Projects.Project
  alias Engine.Accounts.User

  @doc """
  Returns the list of projects belonging to a specific user.
  """
  def list_user_projects(%User{} = user) do
    Project
    |> where(user_id: ^user.id)
    |> Repo.all()
  end

  @doc """
  Gets a single project by ID.
  """
  def get_project!(id) do
    Repo.get_by!(Project, id: id)
  end

  @doc """
  Gets a single project by ID, but only if it belongs to the user.
  """
  def get_project_for_user!(%User{} = user, id) do
    Repo.get_by!(Project, id: id, user_id: user.id)
  end

  def get_project_for_user(user, id) do
    Project
    |> where([p], p.id == ^id and p.user_id == ^user.id)
    |> Repo.one()
  end

  @doc """
  The "Provisioning" step: Creates a project shell for a user.
  """
  def create_project(%User{} = user, attrs \\ %{}) do
    %Project{}
    |> Project.changeset(attrs)
    # Links the project to the owner
    |> Ecto.Changeset.put_assoc(:user, user)
    |> Repo.insert()
  end

  @doc """
  Updates project metadata (e.g., changing status or name).
  """
  def update_project(%Project{} = project, attrs) do
    project
    |> Project.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a project.
  """
  def delete_project(%Project{} = project) do
    project
    |> Repo.delete()
  end

  @doc """
  Updates the status of a project.
  Returns {:ok, project} or {:error, changeset}.
  """
  def update_project_status(project_id, status, url \\ nil) do
    project = Repo.get!(Project, project_id)

    attrs = %{status: status}
    attrs = if url, do: Map.put(attrs, :local_url, url), else: attrs

    project
    |> Project.changeset(attrs)
    |> Repo.update()
  end

  @doc """

  """
  def update_project_by_id(project_id, attrs) do
    project = Repo.get!(Project, project_id)

    project
    |> Project.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Updates the container ID of a project.
  Returns {:ok, project} or {:error, changeset}.
  """
  def update_project_container_id(project_id, container_id) do
    project = Repo.get!(Project, project_id)

    project
    |> Project.changeset(%{container_id: container_id})
    |> Repo.update()
  end

  @doc """
  Checks if a project with the given ID exists and belongs to the specified user.
  """
  def exists_for_user?(project_id, user_id) do
    query =
      from(p in Project,
        where: p.id == ^project_id and p.user_id == ^user_id,
        select: count(p.id)
      )

    Repo.one(query) > 0
  end
end
