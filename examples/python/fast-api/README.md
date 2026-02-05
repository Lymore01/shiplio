# FastAPI Example

A high-performance async Python API built with FastAPI.

## Quick Start

### Prerequisites

- Python 3.8+
- pip, pipenv, or poetry

### Local Development

```bash

# Create virtual environment (Optional)
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/users` - List all users
- `GET /api/users/{user_id}` - Get user by ID
- `POST /api/users` - Create new user

## Interactive Docs

FastAPI auto-generates interactive API documentation:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Deployment with Shiplio

This example is optimized for automatic detection by Shiplio:

```bash
shiplio init
shiplio deploy
```

Shiplio will automatically:

- Detect Python + FastAPI stack
- Set build command: `pip install -r requirements.txt`
- Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Expose port 8000
