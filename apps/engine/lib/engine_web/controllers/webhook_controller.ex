defmodule EngineWeb.WebhookController do
  use EngineWeb, :controller

  def github(conn, _params) do
    json(conn, %{message: "GitHub webhook endpoint"})
  end
end
