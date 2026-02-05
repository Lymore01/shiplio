import Config

config :shiplio_api,
  port: String.to_integer(System.get_env("PORT") || "4000")

if config_env() == :prod do
  config :shiplio_api,
    port: String.to_integer(System.get_env("PORT") || "4000")
end
