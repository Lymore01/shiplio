# Next.js API Example

A lightweight Next.js API built with the App Router.

## Quick Start

### Prerequisites
- Node.js 18+
- npm, yarn, pnpm, or bun

### Local Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
```

The API will be available at `http://localhost:3000`

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/users` - List all users
- `GET /api/users/[id]` - Get user by ID
- `POST /api/users` - Create new user

## Deployment with Shiplio

This example is optimized for automatic detection by Shiplio:

```bash
shiplio init
shiplio deploy
```

Shiplio will automatically:
- Detect Next.js stack
- Set build command: `npm ci && npm run build`
- Set start command: `npm start`
- Expose port 3000
