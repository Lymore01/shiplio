defmodule Engine.Deployments.LogStreamSupervisor do
  use DynamicSupervisor

  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  def start_log_streamer(project_id, container_id, tail_count) do
    spec = {Engine.Deployments.LogStreamer, %{project_id: project_id, container_id: container_id, tail_count: tail_count}}
    DynamicSupervisor.start_child(__MODULE__, spec)
  end
end
