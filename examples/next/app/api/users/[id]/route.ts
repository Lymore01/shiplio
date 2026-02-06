export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await params.then((p) => p.id);
  return Response.json({
    id: userId,
    name: "User",
    email: `user${userId}@example.com`,
  });
}
