export async function GET() {
  return Response.json([
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" },
  ]);
}

export async function POST(request: Request) {
  const { name, email } = await request.json();
  return Response.json(
    { id: 3, name, email },
    { status: 201 }
  );
}
