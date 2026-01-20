defmodule Engine.Repo.Migrations.AddDefaultPortToProjects do
  use Ecto.Migration

  def change do
    alter table(:projects) do
      add :default_port, :integer, null: false
      add :stack, :string
    end
  end
end
