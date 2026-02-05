import express, { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.example",
});

const app = express();
const port = process.env.PORT;

app.use(express.json());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Simple API endpoints
app.get("/api/users", (req: Request, res: Response) => {
  res.json([
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" },
  ]);
});

app.get("/api/users/:id", (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  res.json({ id: userId, name: "User", email: `user${userId}@example.com` });
});

app.post("/api/users", (req: Request, res: Response) => {
  const { name, email } = req.body;
  res.status(201).json({ id: 3, name, email });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
