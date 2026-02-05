# Django Example

A full-featured Python web framework with ORM and admin panel.

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

# Run migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Run development server
python manage.py runserver 0.0.0.0:8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

- `GET /health/` - Health check endpoint
- `GET /api/users/` - List all users
- `GET /api/users/<user_id>/` - Get user by ID
- `POST /api/users/create/` - Create new user

## Deployment with Shiplio

This example is optimized for automatic detection by Shiplio:

```bash
shiplio init
shiplio deploy
```

Shiplio will automatically:
- Detect Python + Django stack
- Set build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- Set start command: `gunicorn --bind 0.0.0.0:$PORT --workers 4 wsgi:application`
- Expose port 8000
