defmodule Engine.Deployments.Templates do
  def get_dockerfile("nodejs", config) do
    """
    FROM node:20-alpine
    WORKDIR /app
    COPY . .
    RUN #{config["scripts"]["build"] || "npm install"}
    EXPOSE 8080
    CMD [#{format_cmd(config["scripts"]["start"] || "npm start")}]
    """
  end

  def get_dockerfile("nextjs", _config) do
    # Multi-Stage Build
    """
    FROM node:20-alpine AS builder
    WORKDIR /app
    COPY package*.json ./
    RUN npm install
    COPY . .
    RUN npm run build

    FROM node:20-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    EXPOSE 8080
    CMD ["node", "server.js"]
    """
  end

  defp format_cmd(cmd), do: cmd |> String.split(" ") |> Enum.map_inspect() |> Enum.join(", ")
end
