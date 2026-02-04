defmodule EngineWeb.RegisterController do
  use EngineWeb, :controller
  alias Engine.Accounts

  def new(conn, _params) do
    conn
    |> put_layout(false)
    |> render(:new,
      changeset: Accounts.change_user(%Accounts.User{})
    )
  end

  def create(conn, %{"email" => email, "password" => password}) do
    case Accounts.register_user(%{"email" => email, "password" => password}) do
      {:ok, _user} ->
        conn
        |> put_flash(:info, "Account created successfully!")
        |> redirect(to: ~p"/login")

      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_layout(false)
        |> render(:new, changeset: changeset)
    end
  end
end
