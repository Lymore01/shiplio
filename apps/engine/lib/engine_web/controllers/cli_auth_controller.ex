defmodule EngineWeb.CliAuthController do
  use EngineWeb, :controller

  def index(conn, %{"callback" => callback_url}) do
    user = conn.assigns.current_user

    if user do
      {:ok, token, _claims} = Engine.Auth.Guardian.encode_and_sign(user)

      redirect(conn, external: "#{callback_url}?token=#{token}")
    else
      conn
      |> put_flash(:info, "Please log in to authorize the Shiplio CLI")
      |> redirect(to: ~p"/login?return_to=#{conn.request_path}&callback=#{callback_url}")
    end
  end
end
