defmodule Engine.Repo.Migrations.AddEnvVarsToProjects do
  use Ecto.Migration

  def change do
    alter table(:projects) do
      add :env_vars, :map, default: %{}
    end
  end
end
