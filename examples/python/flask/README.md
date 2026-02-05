# Flask Example

A lightweight Python microframework for building web APIs.

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
flask run --host=0.0.0.0 --port=5000
```

The API will be available at `http://localhost:5000`

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/users` - List all users
- `GET /api/users/<user_id>` - Get user by ID
- `POST /api/users` - Create new user

## Deployment with Shiplio

This example is optimized for automatic detection by Shiplio:

```bash
shiplio init
shiplio deploy
```

Shiplio will automatically:
- Detect Python + Flask stack
- Set build command: `pip install -r requirements.txt`
- Set start command: `gunicorn --bind 0.0.0.0:$PORT --workers 4 app:app`
- Expose port 5000
