defmodule Engine.Deployments.LogStreamer do
  use GenServer, restart: :temporary

  def start_link(args) do
    GenServer.start_link(__MODULE__, args)
  end

  @impl true
  def init(%{project_id: id, container_id: c_id, tail_count: tail_count}) do
    cmd = "docker logs -f --tail #{tail_count} #{c_id}"

    port =
      Port.open({:spawn, cmd}, [
        :binary,
        :exit_status,
        :line,
        :stderr_to_stdout
      ])

    {:ok, %{port: port, project_id: id}}
  end

  @impl true
  def handle_info({_port, {:data, {:eol, text}}}, state) do
    broadcast_log(text, state)
    {:noreply, state}
  end

  @impl true
  def handle_info({_port, {:data, {:line, text}}}, state) do
    broadcast_log(state, text)

    {:noreply, state}
  end

  @impl true
  def handle_info({_port, {:data, text}}, state) when is_binary(text) do
    broadcast_log(state, text)

    {:noreply, state}
  end

  @impl true
  def handle_info({_port, {:exit_status, _status}}, state) do
    {:stop, :normal, state}
  end

  defp broadcast_log(text, state) do
    EngineWeb.Endpoint.broadcast("logs:runtime:#{state.project_id}", "runtime_log", %{
      message: text,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })

    # IO.puts("[#{state.project_id}] #{text}")
  end
end
