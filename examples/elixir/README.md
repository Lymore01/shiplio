# Elixir/Phoenix API Example

A lightweight Elixir API using Plug and Cowboy.

## Quick Start

### Prerequisites
- Elixir 1.14+
- Mix (comes with Elixir)

### Local Development

```bash
# Install dependencies
mix deps.get

# Run development server
mix run --no-halt
```

The API will be available at `http://localhost:4000`

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user

## Deployment with Shiplio

This example is optimized for automatic detection by Shiplio:

```bash
shiplio init
shiplio deploy
```

Shiplio will automatically:
- Detect Elixir stack
- Set build command: `mix deps.get --only prod && MIX_ENV=prod mix compile`
- Set start command: `MIX_ENV=prod mix run --no-halt`
- Expose port 4000
