defmodule Engine.Utils.HealthCheck do
  require Logger

  @max_attempts 5
  @retry_interval 2000

  def wait_for_healthy(ip, port, attempt \\ 0) do
    if attempt > @max_attempts do
      {:error, :timeout}
    else
      case :gen_tcp.connect(String.to_charlist(ip), port, [:binary, active: false], 1000) do
        {:ok, socket} ->
          :gen_tcp.close(socket)
          Logger.info("Health Check: Container at #{ip}:#{port} is UP.")
          {:ok, :healthy}

        {:error, _reason} ->
          Logger.info(
            "Health Check: Waiting for #{ip}:#{port} (Attempt #{attempt}/#{@max_attempts})..."
          )

          Process.sleep(@retry_interval)
          wait_for_healthy(ip, port, attempt + 1)
      end
    end
  end

  def quick_check(ip, port) do
    case :gen_tcp.connect(String.to_charlist(ip), port, [:binary, active: false], 1000) do
      {:ok, socket} ->
        :gen_tcp.close(socket)
        {:ok, :healthy}

      {:error, _reason} ->
        {:error, :unhealthy}
    end
  end
end
