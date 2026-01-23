defmodule Engine.Repo.Migrations.AddDurationToProjects do
  use Ecto.Migration

  def change do
    alter table(:projects) do
      add :last_build_duration_ms, :integer, null: true
    end
  end
end
