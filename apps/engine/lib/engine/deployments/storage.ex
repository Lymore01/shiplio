defmodule Engine.Deployments.Storage do
  @doc "Calculates the absolute path for a specific project's build directory"
  def build_path(project_id) do
    root = Application.get_env(:engine, :uploads)[:root_path] || "uploads"
    Path.expand(Path.join(root, project_id))
  end
end
