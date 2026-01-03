defmodule Engine.Projects.Project do
  use Ecto.Schema
  import Ecto.Changeset

  schema "projects" do
    field :name, :string
    field :status, :string, default: "active"

    belongs_to :user, Engine.Accounts.User

    timestamps()
  end

  @doc false
  def changeset(project, attrs) do
    project
    |> cast(attrs, [:name, :status])
    |> validate_required([:name])
    |> validate_length(:name, min: 3, max: 30)
    |> update_change(:name, &slugify/1)
    |> validate_format(:name, ~r/^[a-z0-9-]+$/)
    |> unique_constraint([:name, :user_id], name: :projects_user_id_name_index)
  end

  defp slugify(name) when is_binary(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.trim("-")
  end
end
