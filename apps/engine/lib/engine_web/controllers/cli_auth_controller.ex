defmodule EngineWeb.CliAuthController do
  use EngineWeb, :controller

  def index(conn, %{"callback" => callback_url}) do
    user = Map.get(conn.assigns, :current_user)

    if user do
      {:ok, token} = EngineWeb.Auth.Guardian.create_token(user)

      redirect(conn, external: "#{callback_url}?token=#{token}")
    else
      put_flash(conn, :info, "You are not logged in.")
      redirect(conn, external: "/login?callback=#{callback_url}")
    end
  end
end
