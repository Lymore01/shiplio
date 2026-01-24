defmodule Engine.Utils.PathGuard do
  require Logger

  @base_uploads_path "uploads"

  def safe_delete_project(project_id) do
    if is_nil(project_id) || project_id == "" do
      Logger.error("PathGuard: Attempted to delete project with empty ID")
      {:error, :invalid_id}
    else
      target_path = Path.expand("#{@base_uploads_path}/#{project_id}")
      base_path = Path.expand(@base_uploads_path)

      if String.starts_with?(target_path, base_path) and target_path != base_path do
        File.rm_rf!(target_path)
        Logger.info("PathGuard: Safely deleted #{target_path}")
        :ok
      else
        Logger.error("PathGuard: Blocked suspicious deletion attempt on #{target_path}")
        {:error, :unsafe_path}
      end
    end
  end
end
