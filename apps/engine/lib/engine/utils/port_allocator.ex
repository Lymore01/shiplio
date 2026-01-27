defmodule Engine.Utils.PortAllocator do
  import Ecto.Query
  alias Engine.Repo
  alias Engine.Projects.Project

  @start_port 10000

  def allocate_next_port do
    query = from p in Project, select: max(p.dedicated_port)

    case Repo.one(query) do
      nil -> @start_port
      max_port -> max_port + 1
    end
  end
end
