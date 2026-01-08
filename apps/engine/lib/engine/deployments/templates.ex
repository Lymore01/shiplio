defmodule Engine.Deployments.Templates do
  @doc """
  Generates a Dockerfile based on the stack and configuration.
  Supports npm, pnpm, yarn, and bun via Corepack.
  """
  def get_dockerfile(stack, config) do
    # 1. Determine Package Manager & Commands
    pm = config["package_manager"] || "npm"
    build_cmd = get_in(config, ["build", "command"]) || default_build(pm)
    start_cmd = get_in(config, ["runtime", "start_command"]) || default_start(pm)

    # 2. Route to specific template
    case stack do
      "nextjs" -> nextjs_template(pm, build_cmd, start_cmd)
      _ -> nodejs_template(pm, build_cmd, start_cmd)
    end
  end

  # --- Node.js Standard Template (Optimized for Docker Layer Caching) ---
  defp nodejs_template(pm, build_cmd, start_cmd) do
    """
    FROM node:20-alpine
    WORKDIR /app

    # Enable Corepack for pnpm/yarn/bun
    RUN corepack enable && corepack prepare #{pm}@latest --activate

    # Copy lockfiles first to leverage Docker cache
    COPY package.json #{lockfile_for(pm)}* ./
    RUN #{pm} install

    # Copy rest of the code and build
    COPY . .
    RUN #{build_cmd}

    # Use non-root user for security
    USER node

    # Shiplio usually maps port 8080 or 3000
    EXPOSE 3000
    CMD [#{format_cmd(start_cmd)}]
    """
  end

  # --- Next.js Multi-Stage Template ---
  defp nextjs_template(pm, build_cmd, start_cmd) do
    """
    FROM node:20-alpine AS base
    RUN corepack enable && corepack prepare #{pm}@latest --activate

    # Stage 1: Dependencies
    FROM base AS deps
    WORKDIR /app
    COPY package.json #{lockfile_for(pm)}* ./
    RUN #{pm} install

    # Stage 2: Builder
    FROM base AS builder
    WORKDIR /app
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    # Next.js telemetry disable is a nice pro touch
    ENV NEXT_TELEMETRY_DISABLED 1
    RUN #{build_cmd}

    # Stage 3: Runner
    FROM base AS runner
    WORKDIR /app
    ENV NODE_ENV production
    ENV NEXT_TELEMETRY_DISABLED 1

    # Security: Don't run as root
    RUN addgroup --system --gid 1001 nodejs
    RUN adduser --system --uid 1001 nextjs

    COPY --from=builder /app/public ./public
    # Support for Next.js standalone output (makes images 10x smaller)
    COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./package.json

    USER nextjs
    EXPOSE 3000
    CMD [#{format_cmd(start_cmd)}]
    """
  end

  # Helpers
  defp lockfile_for("pnpm"), do: "pnpm-lock.yaml"
  defp lockfile_for("yarn"), do: "yarn.lock"
  defp lockfile_for("bun"), do: "bun.lockb"
  defp lockfile_for(_), do: "package-lock.json"

  defp default_build("pnpm"), do: "pnpm install && pnpm build"
  defp default_build(_), do: "npm install && npm run build"

  defp default_start(_), do: "npm start"

  defp format_cmd(cmd) do
    cmd
    |> String.split(" ")
    |> Enum.map(fn arg -> ~s("#{arg}") end)
    |> Enum.join(", ")
  end
end
