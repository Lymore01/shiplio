defmodule EngineWeb.AuthController do
  use EngineWeb, :controller
  alias Engine.Accounts

  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.authenticate_user(email, password) do
      {:ok, user} ->
        {:ok, token} = EngineWeb.Auth.Guardian.create_token(user)
        json(conn, %{token: token, user: %{email: user.email}})

      {:error, :unauthorized} ->
        conn |> put_status(401) |> json(%{error: "Invalid credentials"})
    end
  end

  def register(conn, %{"email" => email, "password" => password}) do
    case Accounts.register_user(%{"email" => email, "password" => password}) do
      {:ok, user} ->
        {:ok, token} = EngineWeb.Auth.Guardian.create_token(user)
        json(conn, %{token: token, user: %{email: user.email}})

      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(400)
        |> json(%{
          message: "Registration failed",
          errors: EngineWeb.ChangesetJSON.error_details(changeset)
        })
    end
  end

  def callback(conn, _params) do
    json(conn, %{message: "Callback endpoint"})
  end
end
