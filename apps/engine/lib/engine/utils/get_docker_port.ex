defmodule Engine.Utils.GetDockerPort do
  def get_docker_port(container_name, internal_port) do
    {raw_port, 0} = System.shell("docker port #{container_name} #{internal_port}")

    raw_port
    |> String.trim()
    |> String.split(":")
    |> List.last()
  end
end
