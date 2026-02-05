export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = parseInt(params.id);
  return Response.json({
    id: userId,
    name: "User",
    email: `user${userId}@example.com`,
  });
}
