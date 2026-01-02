# contract for storage implementations
defmodule Engine.Storage do
  @callback upload(String.t(), binary()) :: {:ok, String.t()} | {:error, any()}
  @callback download(String.t()) :: {:ok, binary()} | {:error, any()}
end
