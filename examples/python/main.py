#!/usr/bin/env python3
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
from urllib.parse import urlparse
import sys

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {'status': 'ok', 'timestamp': datetime.now().isoformat()}
            self.wfile.write(json.dumps(response).encode())

        elif path == '/api/users':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            users = [
                {'id': 1, 'name': 'Alice', 'email': 'alice@example.com'},
                {'id': 2, 'name': 'Bob', 'email': 'bob@example.com'}
            ]
            self.wfile.write(json.dumps(users).encode())

        elif path.startswith('/api/users/'):
            user_id = path.split('/')[-1]
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            user = {'id': int(user_id), 'name': 'User', 'email': f'user{user_id}@example.com'}
            self.wfile.write(json.dumps(user).encode())

        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not found'}).encode())

    def log_message(self, format, *args):
        print(f'[{datetime.now().isoformat()}] {format % args}')

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    server = HTTPServer(('0.0.0.0', port), APIHandler)
    print(f'Server running at http://0.0.0.0:{port}')
    server.serve_forever()
