defmodule Engine.Repo.Migrations.AddUniqueIndexToProjects do
  use Ecto.Migration

  def change do
    drop_if_exists index(:projects, [:name, :user_id])
    create unique_index(:projects, [:name])
  end
end
