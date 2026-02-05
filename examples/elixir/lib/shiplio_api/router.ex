defmodule ShiplioApi.Router do
  import Plug.Conn

  def init(options) do
    options
  end

  def call(conn, _opts) do
    route(conn, conn.method, conn.request_path)
  end

  defp route(conn, "GET", "/health") do
    send_json(conn, 200, %{
      status: "ok",
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  defp route(conn, "GET", "/api/users") do
    send_json(conn, 200, [
      %{id: 1, name: "Alice", email: "alice@example.com"},
      %{id: 2, name: "Bob", email: "bob@example.com"}
    ])
  end

  defp route(conn, "GET", "/api/users/" <> user_id) do
    id = String.to_integer(user_id)
    send_json(conn, 200, %{
      id: id,
      name: "User",
      email: "user#{id}@example.com"
    })
  end

  defp route(conn, "POST", "/api/users") do
    {:ok, body, conn} = Plug.Conn.read_body(conn)
    %{"name" => name, "email" => email} = Jason.decode!(body)

    send_json(conn, 201, %{
      id: 3,
      name: name,
      email: email
    })
  end

  defp route(conn, _method, _path) do
    send_json(conn, 404, %{error: "Not found"})
  end

  defp send_json(conn, status, body) do
    conn
    |> put_resp_header("content-type", "application/json")
    |> send_resp(status, Jason.encode!(body))
  end
end
