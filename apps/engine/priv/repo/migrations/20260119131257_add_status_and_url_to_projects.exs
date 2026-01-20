defmodule Engine.Repo.Migrations.AddStatusAndUrlToProjects do
  use Ecto.Migration

  def change do
    alter table(:projects) do
      add :local_url, :string, null: true
    end
  end
end
