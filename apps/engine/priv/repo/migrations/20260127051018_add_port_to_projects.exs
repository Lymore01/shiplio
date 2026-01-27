defmodule Engine.Repo.Migrations.AddPortToProjects do
  use Ecto.Migration

  def change do
    alter table(:projects) do
      add :dedicated_port, :integer, unique: true
    end
  end
end
