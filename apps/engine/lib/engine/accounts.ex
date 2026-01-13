defmodule Engine.Accounts do
  @moduledoc """
  The Accounts context. Handles User persistence and authentication.
  """

  import Ecto.Query, warn: false
  alias Engine.Repo
  alias Engine.Accounts.User

  ## --- Authentication & Getters ---

  @doc """
  Gets a user by email and password.
  Used by the Shiplio CLI for login.
  """
  def authenticate_user(email, password) when is_binary(email) and is_binary(password) do
    user = Repo.get_by(User, email: email)
    if user && User.valid_password?(user, password) do
      {:ok, user}
    else
      Pbkdf2.no_user_verify()
      {:error, :unauthorized}
    end
  end

  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: email)
  end

  def get_user!(id), do: Repo.get!(User, id)

  ## --- Registration & Writing ---

  @doc """
  Registers a user.
  """
  def register_user(attrs) do
    %User{}
    |> User.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Returns an %Ecto.Changeset{} for tracking user changes.
  Useful for validation checks before submitting.
  """
  def change_user(%User{} = user, attrs \\ %{}) do
    User.changeset(user, attrs)
  end

  @doc """
  Updates a user.
  """
  def update_user(%User{} = user, attrs) do
    user
    |> User.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a user.
  """
  def delete_user(%User{} = user) do
    Repo.delete(user)
  end
end
