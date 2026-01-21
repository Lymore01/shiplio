defmodule Engine.Repo.Migrations.AddContainerIdToProjects do
  use Ecto.Migration

  def change do
    alter table(:projects) do
      add :container_id, :string, null: true
    end
  end
end
