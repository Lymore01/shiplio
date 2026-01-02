defmodule Engine.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :email, :string
    field :hashed_password, :string
    field :password, :string, virtual: true, redact: true

    timestamps()
  end

  @doc """
  Registration changeset. Handles validation and hashing.
  """
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :password])
    |> validate_email()
    |> validate_password()
    |> maybe_hash_password()
  end

  defp validate_email(changeset) do
    changeset
    |> validate_required([:email])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/, message: "must have the @ sign and no spaces")
    |> validate_length(:email, max: 160)
    |> unique_constraint(:email)
  end

  defp validate_password(changeset) do
    changeset
    |> validate_required([:password])
    |> validate_length(:password, min: 8, max: 72)
    |> validate_format(:password, ~r/[a-z]/, message: "at least one lower case character")
    |> validate_format(:password, ~r/[A-Z]/, message: "at least one upper case character")
    |> validate_format(:password, ~r/[0-9]/, message: "at least one digit")
  end

  defp maybe_hash_password(changeset) do
    password = get_change(changeset, :password)

    if changeset.valid? && password do
      put_change(changeset, :hashed_password, Pbkdf2.hash_pwd_salt(password))
    else
      changeset
    end
  end

  def valid_password?(%Engine.Accounts.User{hashed_password: hashed_password}, password)
      when is_binary(password) do
    Pbkdf2.verify_pass(password, hashed_password)
  end

  def valid_password?(_, _), do: Pbkdf2.no_user_verify()
end
