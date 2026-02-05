defmodule ShiplioApi.Application do
  use Application

  @impl true
  def start(_type, _args) do
    port = Application.get_env(:shiplio_api, :port, 4000)

    children = [
      {Plug.Cowboy, scheme: :http, plug: ShiplioApi.Router, options: [port: port]}
    ]

    opts = [strategy: :one_for_one, name: ShiplioApi.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
