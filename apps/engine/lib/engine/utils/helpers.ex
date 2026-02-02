defmodule Engine.Utils.Helpers do
  alias Engine.Repo
  alias Engine.Projects.Project
  import Ecto.Query

  def generate_unique_name(base_name) do
    slug = slugify(base_name)

    if name_available?(slug) do
      slug
    else
      suffix = :crypto.strong_rand_bytes(2) |> Base.encode16(case: :lower)
      "#{slug}-#{suffix}"
    end
  end

  defp name_available?(name) do
    Repo.aggregate(from(p in Project, where: p.name == ^name), :count) == 0
  end

  defp slugify(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "-")
    |> String.trim("-")
  end
end
