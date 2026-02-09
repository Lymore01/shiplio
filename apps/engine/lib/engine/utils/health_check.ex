defmodule Engine.Utils.HealthCheck do
  require Logger

  @max_attempts 15
  @retry_interval 1000
  @http_timeout 5000

  def wait_for_healthy(ip, port, path \\ "/", attempt \\ 0) do
    if attempt > @max_attempts do
      Logger.error("Health Check: Failed after #{@max_attempts} attempts on #{ip}:#{port}")
      {:error, :timeout}
    else
      health_url = "http://#{ip}:#{port}#{path}"

      case check_http_health(health_url) do
        {:ok, :healthy} ->
          Logger.info("Health Check: Container at #{ip}:#{port} is UP.")
          {:ok, :healthy}

        {:error, reason} ->
          Logger.info(
            "Health Check: Waiting for #{ip}:#{port} (Attempt #{attempt + 1}/#{@max_attempts}, reason: #{inspect(reason)})..."
          )
          Process.sleep(@retry_interval)
          wait_for_healthy(ip, port, path, attempt + 1)
      end
    end
  end

  def quick_check(ip, port) do
    health_url = "http://#{ip}:#{port}/health"

    case check_http_health(health_url) do
      {:ok, :healthy} ->
        {:ok, :healthy}

      {:error, _reason} ->
        {:error, :unhealthy}
    end
  end

  defp check_http_health(url) do
    case HTTPoison.get(url, [], recv_timeout: @http_timeout, connect_timeout: @http_timeout) do
      {:ok, %HTTPoison.Response{status_code: code}} when code in 200..299 ->
        {:ok, :healthy}

      {:ok, %HTTPoison.Response{status_code: code}} ->
        {:error, {:bad_status, code}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, reason}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
