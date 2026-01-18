defmodule Engine.Deployments.LogBuffer do
  @table :build_logs

  def init_table do
    if :ets.whereis(@table) == :undefined do
      :ets.new(@table, [:named_table, :public, :duplicate_bag])
    end
  end

  def add_log(project_id, message) do
    :ets.insert(@table, {project_id, System.system_time(:millisecond), message})
  end

  def get_logs(project_id) do
    @table
    |> :ets.lookup(project_id)
    |> Enum.sort_by(fn {_pid, time, _msg} -> time end)
    |> Enum.map(fn {_pid, _time, msg} -> msg end)
  end

  def clear_logs(project_id) do
    :ets.delete(@table, project_id)
  end

  def clear_logs_delayed(project_id, delay_ms \\ 10_000) do
    spawn(fn ->
      Process.sleep(delay_ms)
      :ets.delete(@table, project_id)
    end)
  end
end
