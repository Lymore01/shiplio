# Python Example

A minimal Python HTTP API with zero external dependencies, using only the standard library.

## Quick Start

### Prerequisites
- Python 3.8+

### Local Development

```bash
# No installation needed!
python main.py
```

The API will be available at `http://localhost:3000`

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/users` - List all users
- `GET /api/users/<user_id>` - Get user by ID

## Deployment with Shiplio

This example is optimized for automatic detection by Shiplio:

```bash
shiplio init
shiplio deploy
```

Shiplio will automatically:
- Detect Python stack
- Set build command: (skipped - no dependencies)
- Set start command: `python main.py`
- Expose port 3000
