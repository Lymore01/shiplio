defmodule Engine.Deployments.LogCollector do
  @moduledoc """
  Collects streamed shell output (e.g Docker, tar)
  and forwards it as structured logs via PubSub.
  """

  defstruct [:project_id, :step]

  defimpl Collectable do
    def into(%{project_id: project_id, step: step}) do
      collector_fun = fn
        _state, {:cont, line} ->
          line = String.trim_trailing(line)

          if line != "" do
            event = %{
              level: :stream,
              step: step,
              message: line,
              timestamp: DateTime.utc_now()
            }

            Phoenix.PubSub.broadcast(
              Engine.PubSub,
              "logs:#{project_id}",
              {:new_log, event}
            )

            IO.puts("[#{step}] #{line}")
          end

          :ok

        state, :done ->
          state

        _state, :halt ->
          :ok
      end

      {:ok, collector_fun}
    end
  end
end
