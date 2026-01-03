defmodule EngineWeb.UserSocket do
  use Phoenix.Socket

  ## Channels
  channel "logs:*", EngineWeb.LogChannel

  def connect(%{"token" => token}, socket, _connect_info) do
    case EngineWeb.Auth.Guardian.decode_and_verify(token) do
      {:ok, claims} ->
        {:ok, assign(socket, :user_id, claims["sub"])}
      {:error, _reason} ->
        :error
    end
  end

  def id(_socket), do: nil
end
