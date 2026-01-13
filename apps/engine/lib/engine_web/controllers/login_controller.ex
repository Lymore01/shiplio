defmodule EngineWeb.LoginController do
  use EngineWeb, :controller
  alias Engine.Accounts

  def new(conn, params) do
    conn
    |> put_layout(false)
    |> render(:new,
      callback: params["callback"]
    )
  end

  def create(conn, %{"email" => email, "password" => password, "callback" => cb}) do
    case Accounts.authenticate_user(email, password) do
      {:ok, user} ->
        conn
        |> put_session(:user_id, user.id)
        |> configure_session(renew: true)
        |> redirect(to: ~p"/cli/auth?callback=#{cb}")

      {:error, _} ->
        conn
        |> put_flash(:error, "Invalid credentials")
        |> render(:new, callback: cb)

    end
  end
end
