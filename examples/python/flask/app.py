from flask import Flask, jsonify, request
from datetime import datetime

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify(status='ok', timestamp=datetime.now().isoformat())

@app.route('/api/users', methods=['GET'])
def get_users():
    return jsonify([
        {'id': 1, 'name': 'Alice', 'email': 'alice@example.com'},
        {'id': 2, 'name': 'Bob', 'email': 'bob@example.com'}
    ])

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    return jsonify({'id': user_id, 'name': 'User', 'email': f'user{user_id}@example.com'})

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()
    return jsonify({'id': 3, 'name': data.get('name'), 'email': data.get('email')}), 201

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
