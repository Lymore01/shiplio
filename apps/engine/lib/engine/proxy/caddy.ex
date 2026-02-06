defmodule Engine.Proxy.Caddy do
  require Logger

  @caddy_api "http://localhost:20200/config/apps/http/servers/srv0/routes"

  def register_route(project_id, domain, internal_port) do
    payload = %{
      "@id" => "project-#{project_id}",
      "match" => [
        %{
          "host" => [domain]
        }
      ],
      "handle" => [
        %{
          "handler" => "reverse_proxy",
          "upstreams" => [
            %{
              "dial" => "localhost:#{internal_port}"
            }
          ]
        }
      ]
    }

    case HTTPoison.post(@caddy_api, Jason.encode!(payload), [{"Content-Type", "application/json"}]) do
      {:ok, %HTTPoison.Response{status_code: code}} when code in 200..299 ->
        Logger.info("Caddy route registered for project #{project_id} at domain #{domain}")
        :ok

      {:ok, %HTTPoison.Response{status_code: code, body: body}} ->
        Logger.error("Failed to register Caddy route: #{code} - #{body}")
        {:error, :failed_to_register}

      {:error, %HTTPoison.Error{reason: reason}} ->
        Logger.error("HTTP request to Caddy failed: #{inspect(reason)}")
        {:error, :http_request_failed}
    end
  end

  def unregister_route(project_id) do
    url = "http://localhost:20200/id/project-#{project_id}"

    case HTTPoison.delete(url) do
      {:ok, %HTTPoison.Response{status_code: code}} when code in 200..299 ->
        Logger.info("Caddy route unregistered for project #{project_id}")
        :ok

      {:ok, %HTTPoison.Response{status_code: 404}} ->
        Logger.warning("Caddy route for project #{project_id} not found during unregistration")
        :ok

      {:ok, %HTTPoison.Response{status_code: code, body: body}} ->
        Logger.error("Failed to unregister Caddy route: #{code} - #{body}")
        {:error, :failed_to_unregister}

      {:error, %HTTPoison.Error{reason: reason}} ->
        Logger.error("HTTP request to Caddy failed: #{inspect(reason)}")
        {:error, :http_request_failed}
    end
  end
end
