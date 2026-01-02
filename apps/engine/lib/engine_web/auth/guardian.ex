defmodule EngineWeb.Auth.Guardian do
  use Guardian, otp_app: :engine
  alias Engine.Accounts

  # This "packs" the user ID into the 'sub' (subject) field of the JWT
  def subject_for_token(user, _claims) do
    {:ok, to_string(user.id)}
  end

  # This "unpacks" the ID and finds the User in the database
  def resource_from_claims(%{"sub" => id}) do
    case Accounts.get_user!(id) do
      nil -> {:error, :resource_not_found}
      user -> {:ok, user}
    end
  rescue
    Ecto.NoResultsError -> {:error, :resource_not_found}
  end

  # --- Helper Functions ---

  @doc "Generates a token for a user"
  def create_token(user) do
    {:ok, token, _claims} = encode_and_sign(user)
    {:ok, token}
  end

  @doc "Revokes a token (useful for logout)"
  def revoke_token(token) do
    revoke(token)
  end
end
