from fastapi import FastAPI
from datetime import datetime

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello from Shiplio!", "stack": "FastAPI"}

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/api/users")
def get_users():
    return [
        {"id": 1, "name": "Alice", "email": "alice@example.com"},
        {"id": 2, "name": "Bob", "email": "bob@example.com"}
    ]

@app.get("/api/users/{user_id}")
def get_user(user_id: int):
    return {"id": user_id, "name": "User", "email": f"user{user_id}@example.com"}

@app.post("/api/users")
def create_user(name: str, email: str):
    return {"id": 3, "name": name, "email": email}