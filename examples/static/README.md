# Static Site Example

A traditional static HTML/CSS/JS site hosted on a web server.

## Quick Start

### Local Development

Use any local web server:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx serve

# Ruby
ruby -run -ehttpd . -p8000
```

Then visit `http://localhost:8000` (or your chosen port)

## Files

- `index.html` - Main landing page with information about all Shiplio examples

## Deployment with Shiplio

This example is optimized for automatic detection by Shiplio:

```bash
shiplio init
shiplio deploy
```

Shiplio will automatically:
- Detect Static site stack
- No build required
- Serve via nginx or similar
- Expose port 80
