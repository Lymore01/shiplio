defmodule Engine.ProjectsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Engine.Projects` context.
  """

  @doc """
  Generate a project.
  """
  def project_fixture(attrs \\ %{}) do
    {:ok, project} =
      attrs
      |> Enum.into(%{
        name: "some name",
        status: "some status"
      })
      |> Engine.Projects.create_project()

    project
  end
end
