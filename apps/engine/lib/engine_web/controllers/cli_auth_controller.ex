defmodule EngineWeb.CliAuthController do
  use EngineWeb, :controller

  def index(conn, _params) do
    user = Map.get(conn.assigns, :current_user)

    if user do
      {:ok, token} = EngineWeb.Auth.Guardian.create_token(user)

      redirect(conn, external: "#{"/cli/auth"}?token=#{token}")
    else
      put_flash(conn, :info, "You are not logged in.")
      redirect(conn, external: "#{"/login"}")
    end
  end
end
