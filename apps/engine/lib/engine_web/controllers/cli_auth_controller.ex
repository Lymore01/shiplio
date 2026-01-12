defmodule EngineWeb.CliAuthController do
  use EngineWeb, :controller

  def index(conn, %{"callback" => callback_url}) do
    user = conn.assigns.current_user

    if user do
      {:ok, token, _claims} = Engine.Auth.Guardian.encode_and_sign(user)

      redirect(conn, external: "#{callback_url}?token=#{token}")
    else
      # conn
      # |> put_flash(:info, "Please log in to authorize the Shiplio CLI")
      # |> redirect(to: ~p"/login?return_to=#{conn.request_path}&callback=#{callback_url}")
      html(conn, """
         <h1>Login to Shiplio</h1>
         <form action="/login" method="post">
           <input type="email" name="email" placeholder="Email" required />
           <input type="password" name="password" placeholder="Password" required />
           <button type="submit">Login</button>
         </form>
       """)
    end
  end
end
