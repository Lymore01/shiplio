defmodule Engine.Deployments.LogCollector do
  defstruct [:project_id, :prefix]

  defimpl Collectable do
    def into(config) do
      collector_fun = fn
        _state, {:cont, line} ->
          message = "[#{config.prefix}] #{line}"
          Engine.Deployments.BuildWorker.broadcast_log(config.project_id, message)
        state, :done -> state
        _state, :halt -> :ok
      end

      {:ok, collector_fun}
    end
  end
end
