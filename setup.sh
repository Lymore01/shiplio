#!/bin/bash
set -e # Exit on any error

ALERT_ICON="\u26A0\uFE0F"
CHECK_ICON="\u2705"
CONFETTI_ICON="\U0001F389"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DRY_RUN=false

usage() {
    echo "Usage: ./setup.sh [--dry-run]"
    echo "  --dry-run    Show commands without executing them"
    exit 0
}

if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    usage
fi

if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}${ALERT_ICON}  Dry run mode enabled. Commands will be printed but not executed.${NC}"
fi

run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY-RUN]${NC} $1"
    else
        eval "$1"
    fi
}

echo -e "${BLUE}Starting Shiplio v1 Environment Setup...${NC}"

OS_TYPE=$(uname -s)

# --- 1. Tooling & Prerequisites ---

# Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker not found. Installing...${NC}"
    if [ "$OS_TYPE" == "Linux" ]; then
        run_cmd "sudo apt update && sudo apt install -y docker.io"
        run_cmd "sudo systemctl start docker && sudo systemctl enable docker"
    elif [ "$OS_TYPE" == "Darwin" ]; then
        run_cmd "brew install docker"
    fi
else
    echo -e "${GREEN}${CHECK_ICON} Docker is already installed.${NC}"
fi

# Node.js & pnpm
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing...${NC}"
    if [ "$OS_TYPE" == "Linux" ]; then
        run_cmd "sudo apt update && sudo apt install -y nodejs npm"
    elif [ "$OS_TYPE" == "Darwin" ]; then
        run_cmd "brew install node"
    fi
else
    echo -e "${GREEN}${CHECK_ICON} Node.js is already installed.${NC}"
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found. Installing...${NC}"
    run_cmd "npm install -g pnpm"
else
    echo -e "${GREEN}${CHECK_ICON} pnpm is already installed.${NC}"
fi

# Elixir & Erlang
if ! command -v elixir &> /dev/null; then
    echo -e "${YELLOW}Elixir not found. Installing...${NC}"
    if [ "$OS_TYPE" == "Linux" ]; then
        run_cmd "sudo apt update && sudo apt install -y elixir"
    elif [ "$OS_TYPE" == "Darwin" ]; then
        run_cmd "brew install elixir"
    fi
else
    echo -e "${GREEN}${CHECK_ICON} Elixir is already installed.${NC}"
fi

# Caddy
if ! command -v caddy &> /dev/null; then
    echo -e "${YELLOW}Caddy not found. Installing...${NC}"
    if [ "$OS_TYPE" == "Linux" ]; then
        run_cmd "sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https"
        run_cmd "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg"
        run_cmd "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list"
        run_cmd "sudo apt update && sudo apt install caddy"
    elif [ "$OS_TYPE" == "Darwin" ]; then
        run_cmd "brew install caddy"
    fi
else
    echo -e "${GREEN}${CHECK_ICON} Caddy is already installed.${NC}"
fi

# Postgresql
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}Postgresql not found. Installing...${NC}"
    if [ "$OS_TYPE" == "Linux" ]; then
        run_cmd "sudo apt update && sudo apt install -y postgresql postgresql-contrib"
    elif [ "$OS_TYPE" == "Darwin" ]; then
        run_cmd "brew install postgresql"
    fi
else
    echo -e "${GREEN}${CHECK_ICON} Postgresql is already installed.${NC}"
fi

# --- 2. Engine & CLI Initialization ---

echo -e "${BLUE}Setting up Shiplio Engine...${NC}"

if [ ! -f apps/engine/.env ]; then
    echo -e "${YELLOW}Creating default .env file...${NC}"
    if [ "$DRY_RUN" = false ]; then
        echo "DB_USER=postgres" >> apps/engine/.env
        echo "DB_PASSWORD=postgres" >> apps/engine/.env
        echo "DB_HOST=localhost" >> apps/engine/.env
        echo "DB_NAME=shiplio_dev" >> apps/engine/.env
    else
        echo -e "${BLUE}[DRY-RUN]${NC} Create apps/engine/.env with default DB variables"
    fi
else
    echo -e "${GREEN}${CHECK_ICON} .env file already exists.${NC}"
fi

if [ "$DRY_RUN" = false ]; then
    cd apps/engine
    mix local.hex --force
    mix local.rebar --force
    mix deps.get
    mix ecto.setup
    cd ../..
else
    echo -e "${BLUE}[DRY-RUN]${NC} cd apps/engine && mix local.hex --force && mix local.rebar --force && mix deps.get && mix ecto.setup && cd ../.."
fi

echo -e "${BLUE}Setting up Shiplio CLI...${NC}"
if [ "$DRY_RUN" = false ]; then
    cd apps/cli
    pnpm install
    pnpm link --global
    cd ../..
else
    echo -e "${BLUE}[DRY-RUN]${NC} cd apps/cli && pnpm install && pnpm link --global && cd ../.."
fi

# --- 3. Caddy Dynamic Infrastructure Bootstrap ---

echo -e "${BLUE}Bootstrapping Caddy with Global TLS Internal Policy...${NC}"
# Start Caddy in background to apply API changes
run_cmd "caddy start --config apps/engine/Caddyfile --adapter caddyfile"

# Give Caddy a moment to initialize the Admin API
if [ "$DRY_RUN" = false ]; then
    sleep 2
fi

# Push Global TLS Internal Policy to Admin API (Port 20200)
if [ "$DRY_RUN" = false ]; then
    curl -s -X POST http://localhost:20200/config/apps/tls/automation/policies \
      -H "Content-Type: application/json" \
      -d '{
        "subjects": ["shiplio.lvh.me", "*.shiplio.lvh.me"],
        "issuers": [{"module": "internal"}]
      }'
else
    echo -e "${BLUE}[DRY-RUN]${NC} curl -s -X POST http://localhost:20200/config/apps/tls/automation/policies ..."
fi

echo -e "${GREEN}${CHECK_ICON} Global TLS Internal Policy applied.${NC}"

# --- 4. Final Verification ---

echo -e "${BLUE}------------------------------------------------${NC}"
echo -e "${GREEN}${CONFETTI_ICON} Shiplio v1 Setup Complete!${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Ensure Docker Desktop is running."
echo -e "2. Terminal A: cd apps/engine && mix phx.server"
echo -e "3. Terminal B: shiplio login"
echo -e "${BLUE}------------------------------------------------${NC}"