defmodule EngineWeb.RegisterHTML do
  use EngineWeb, :html

  def translate_error({msg, opts}) do
  Enum.reduce(opts, msg, fn {key, value}, acc ->
    String.capitalize(String.replace(acc, "%{#{key}}", to_string(value)))
  end)
end

  embed_templates "register_html/*"
end
