defmodule Engine.Deployments.Templates do
  @doc """
  Generates a Dockerfile based on the stack and configuration.
  Supports npm, pnpm, yarn, and bun via Corepack.
  """
  def get_dockerfile(project_path, stack, config) do
    pm = config["package_manager"] || "npm"

    build_cmd = get_in(config, ["build", "command"])
    start_cmd = get_in(config, ["runtime", "start_command"]) || default_start(pm)
    port = get_in(config, ["runtime", "port"]) || 3000

    case stack do
      "nextjs" ->
        nextjs_template(pm, build_cmd, start_cmd, port)

      "elixir" ->
        elixir_template(port)

      "static" ->
        static_template(port)

      stack when stack in ["python", "fastapi", "django", "flask"] ->
        python_template(project_path, start_cmd, build_cmd, port)

      _ ->
        nodejs_template(pm, build_cmd, start_cmd, port)
    end
  end

  defp python_template(project_path, start_cmd, build_cmd, port) do
    has_requirements = File.exists?(Path.join(project_path, "requirements.txt"))

    requirements_block =
      if has_requirements do
        """
        # Optimized Layer Caching: Install dependencies first
        COPY requirements.txt .
        RUN #{build_cmd}
        """
      else
        "# No requirements.txt found, skipping pip install"
      end

    """
    FROM python:3.10-slim

    # Install system-level dependencies
    RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc && rm -rf /var/lib/apt/lists/*

    WORKDIR /app

    # Ensure logs are visible in the CLI immediately
    ENV PYTHONUNBUFFERED=1
    # Default port if none is provided at runtime
    ENV PORT=#{port}

    #{requirements_block}

    # Copy the rest of the app
    COPY . .

    # Security: Create and switch to a non-root user
    RUN useradd -m shiplio_user && chown -R shiplio_user /app
    USER shiplio_user

    EXPOSE #{port}

    CMD ["sh", "-c", "#{start_cmd}"]
    """
  end

  defp static_template(port) do
    """
    FROM nginx:alpine
    # Remove default nginx static assets
    RUN rm -rf /usr/share/nginx/html/*
    # Copy static resources from the uploaded source to the nginx serve directory
    COPY . /usr/share/nginx/html
    EXPOSE #{port}
    """
  end

  defp nodejs_template(pm, build_cmd, start_cmd, port) do
    """
    FROM node:20-alpine
    WORKDIR /app

    RUN corepack enable && corepack prepare #{pm}@latest --activate

    COPY package.json #{lockfile_for(pm)}* ./
    RUN #{pm} install

    COPY . .

    # Only run build if a command is actually provided
    #{if build_cmd && build_cmd != "", do: "RUN #{build_cmd}", else: "# Skipping build step"}

    USER node

    # Dynamically inject the port from shiplio.json
    ENV PORT=#{port}
    EXPOSE #{port}

    CMD [#{format_cmd(start_cmd)}]
    """
  end

  defp nextjs_template(pm, build_cmd, start_cmd, port) do
    final_build_cmd = build_cmd || default_build(pm)

    """
    FROM node:20-alpine AS base
    RUN corepack enable && corepack prepare #{pm}@latest --activate

    FROM base AS deps
    WORKDIR /app
    COPY package.json #{lockfile_for(pm)}* ./
    RUN #{pm} install

    FROM base AS builder
    WORKDIR /app
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    ENV NEXT_TELEMETRY_DISABLED 1
    RUN #{final_build_cmd}

    FROM base AS runner
    WORKDIR /app
    ENV NODE_ENV production
    ENV NEXT_TELEMETRY_DISABLED 1
    ENV PORT #{port}

    RUN addgroup --system --gid 1001 nodejs
    RUN adduser --system --uid 1001 nextjs

    COPY --from=builder /app/public ./public
    COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./package.json

    USER nextjs
    EXPOSE #{port}
    CMD [#{format_cmd(start_cmd)}]
    """
  end

  defp elixir_template(_port) do
    """

    """
  end

  # --- Helpers ---

  defp lockfile_for("pnpm"), do: "pnpm-lock.yaml"
  defp lockfile_for("yarn"), do: "yarn.lock"
  defp lockfile_for("bun"), do: "bun.lockb"
  defp lockfile_for(_), do: "package-lock.json"

  defp default_build("pnpm"), do: "pnpm build"
  defp default_build(_), do: "npm run build"

  defp default_start(_), do: "npm start"

  defp format_cmd(cmd) do
    cmd
    |> String.split(" ")
    |> Enum.map(fn arg -> ~s("#{arg}") end)
    |> Enum.join(", ")
  end
end
