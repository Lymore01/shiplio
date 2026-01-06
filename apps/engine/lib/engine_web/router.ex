defmodule EngineWeb.Router do
  use EngineWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :auth do
    plug EngineWeb.Auth.Pipeline
    plug Guardian.Plug.EnsureAuthenticated
  end

  scope "/api", EngineWeb do
    pipe_through :api

    post "/auth/login", AuthController, :login
    post "/auth/register", AuthController, :register
    get "/auth/callback", AuthController, :callback

    post "/webhooks/github", WebhookController, :github
  end

  scope "/api", EngineWeb do
    pipe_through [:api, :auth]

    get "/projects", ProjectController, :index
    get "/projects/:id", ProjectController, :show
    post "/projects", ProjectController, :create

    post "/projects/:id/deployments", ProjectController, :deploy

  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:engine, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: EngineWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
