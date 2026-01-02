# for protected routes
defmodule EngineWeb.Auth.Pipeline do
  use Guardian.Plug.Pipeline,
    otp_app: :engine,
    module: EngineWeb.Auth.Guardian,
    error_handler: EngineWeb.Auth.ErrorHandler

  # 1. Look for 'Authorization: Bearer <token>' header
  plug Guardian.Plug.VerifyHeader, claims: %{"typ" => "access"}

  # 2. If a token was found, load the user into 'conn.assigns'
  plug Guardian.Plug.LoadResource, allow_blank: true
end
