export function GET() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  return Response.json({ application: "verbo-next-local" }, { headers: { "Cache-Control": "no-store" } });
}
