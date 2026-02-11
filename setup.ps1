param (
    [switch]$DryRun
)

$check=[char]::ConvertFromUtf32(0x2705)
$alert=[char]::ConvertFromUtf32(0x26A0)
$confetti=[char]::ConvertFromUtf32(0x1F389)

# Stop on any error
$ErrorActionPreference = "Stop"

if ($DryRun) {
    Write-Host "$alert  Dry run mode enabled. Commands will be printed but not executed." -ForegroundColor Yellow
}

Write-Host "Starting Shiplio v1 Native Windows Setup..." -ForegroundColor Cyan

# Helper for running commands
function Invoke-Cmd {
    param(
        [ScriptBlock]$Script,
        [string]$Display
    )
    if ($DryRun) {
        Write-Host "[DRY-RUN] $Display" -ForegroundColor Blue
    } else {
        & $Script
    }
}

# --- 1. Tooling & Prerequisites ---

# Check for Winget (Standard on Win 10/11)
if (!(Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error "Winget not found. Please install the App Installer from the Microsoft Store."
}

# Docker (Requires manual confirmation for UAC)
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker not found. Installing Docker Desktop..." -ForegroundColor Yellow
    Invoke-Cmd { winget install Docker.DockerDesktop } "winget install Docker.DockerDesktop"
} else {
    Write-Host "$check Docker is already installed." -ForegroundColor Green
}

# Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Installing..." -ForegroundColor Yellow
    Invoke-Cmd { winget install OpenJS.NodeJS } "winget install OpenJS.NodeJS"
} else {
    Write-Host "$check Node.js is already installed." -ForegroundColor Green
}

# pnpm
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "pnpm not found. Installing..." -ForegroundColor Yellow
    Invoke-Cmd { npm install -g pnpm } "npm install -g pnpm"
} else {
    Write-Host "$check pnpm is already installed." -ForegroundColor Green
}

# Elixir & Erlang
if (!(Get-Command elixir -ErrorAction SilentlyContinue)) {
    Write-Host "Elixir/Erlang not found. Installing..." -ForegroundColor Yellow
    Invoke-Cmd { winget install Elixir.Elixir } "winget install Elixir.Elixir"
} else {
    Write-Host "$check Elixir is already installed." -ForegroundColor Green
}

# Caddy
if (!(Get-Command caddy -ErrorAction SilentlyContinue)) {
    Write-Host "Caddy not found. Installing..." -ForegroundColor Yellow
    Invoke-Cmd { winget install Caddy.Caddy } "winget install Caddy.Caddy"
} else {
    Write-Host "$check Caddy is already installed." -ForegroundColor Green
}

# PostgreSQL
if (!(Get-Service postgresql* -ErrorAction SilentlyContinue)) {
    Write-Host "PostgreSQL not found. Installing..." -ForegroundColor Yellow
    Invoke-Cmd { winget install PostgreSQL.PostgreSQL } "winget install PostgreSQL.PostgreSQL"
} else {
    Write-Host "$check PostgreSQL is already installed." -ForegroundColor Green
}

# --- 2. Engine & CLI Initialization ---

Write-Host "Setting up Shiplio Engine..." -ForegroundColor Cyan

if (!(Test-Path apps/engine/.env)) {
    Write-Host "Creating default .env file..." -ForegroundColor Yellow
    if ($DryRun) {
        Write-Host "[DRY-RUN] Create apps/engine/.env with default DB variables" -ForegroundColor Blue
    } else {
        @"
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_NAME=shiplio_dev
"@.Trim() | Out-File -FilePath apps/engine/.env -Encoding UTF8
    }
} else {
    Write-Host "$check .env file already exists." -ForegroundColor Green
}

Invoke-Cmd {
    Set-Location apps/engine
    mix local.hex --force
    mix local.rebar --force
    mix deps.get
    mix ecto.setup
    Set-Location ../..
} "Initialize Shiplio Engine (mix deps.get, ecto.setup, etc.)"

Write-Host "Setting up Shiplio CLI..." -ForegroundColor Cyan
Invoke-Cmd {
    Set-Location apps/cli
    pnpm install
    pnpm link --global
    Set-Location ../..
} "Initialize Shiplio CLI (pnpm install, pnpm link)"

# --- 3. Caddy Dynamic Infrastructure Bootstrap ---

Write-Host "Bootstrapping Caddy with Global TLS Internal Policy..." -ForegroundColor Cyan

# Start Caddy in a separate process
Invoke-Cmd {
    Start-Process caddy -ArgumentList "run --config apps/engine/Caddyfile" -NoNewWindow
    Write-Host "Waiting for Caddy Admin API..."
    Start-Sleep -Seconds 5
} "Start Caddy and wait for API"

# Push Global TLS Internal Policy to Admin API
$tlsBody = @{
    subjects = @("shiplio.lvh.me", "*.shiplio.lvh.me")
    issuers = @(@{ module = "internal" })
} | ConvertTo-Json

if ($DryRun) {
    Write-Host "[DRY-RUN] Push Global TLS Internal Policy to Caddy API" -ForegroundColor Blue
} else {
    try {
        Invoke-RestMethod -Method Post -Uri "http://localhost:20200/config/apps/tls/automation/policies" -Body $tlsBody -ContentType "application/json"
        Write-Host "$check Global TLS Internal Policy applied." -ForegroundColor Green
    } catch {
        Write-Host "$alert Could not reach Caddy API. Ensure port 20200 is open." -ForegroundColor Red
    }
}

# --- 4. Final Verification ---

Write-Host "`n------------------------------------------------" -ForegroundColor White
Write-Host "$confetti Shiplio v1 Windows Setup Complete!" -ForegroundColor Green
Write-Host "Next Steps:" -ForegroundColor White
Write-Host "1. Ensure Docker Desktop is running." -ForegroundColor White
Write-Host "2. Terminal A: cd apps/engine; mix phx.server" -ForegroundColor White
Write-Host "3. Terminal B: shiplio login" -ForegroundColor White
Write-Host "------------------------------------------------" -ForegroundColor White