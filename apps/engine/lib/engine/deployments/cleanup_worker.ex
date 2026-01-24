defmodule Engine.Deployments.CleanupWorker do
  require Logger

  def run(project, opts \\ [soft: true]) do
    image_tag = "shiplio-app-#{project.id}"
    container_name = "shiplio-container-#{project.id}"
    Logger.info("Starting cleanup for #{project.name}")

    {output, exit_code} =
      System.cmd("docker", ["rm", "-f", container_name], stderr_to_stdout: true)

    case exit_code do
      0 -> Logger.info("Container #{container_name} removed.")
      _ -> Logger.warning("Container cleanup skipped or failed: #{String.trim(output)}")
    end

    unless opts[:soft] do
      System.cmd("docker", ["rmi", image_tag])
    end

    Logger.info("Cleanup finished for #{project.name}")
    :ok
  end
end
