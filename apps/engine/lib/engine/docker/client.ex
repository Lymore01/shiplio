defmodule Engine.Docker.Client do
  require Logger

  def stop_container(container_id) do
    case System.cmd("docker", ["rm", "-f", container_id]) do
      {_output, 0} ->
        Logger.info("Docker: Forcefully removed container #{container_id}")
        :ok

      {output, _exit_code} ->
        Logger.error("Docker: Failed to remove container #{container_id}: #{output}")
        {:error, output}
    end
  end
end
