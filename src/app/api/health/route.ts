import { db } from "@/lib/db";

/** Sonde de santé : application et base de données joignables. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
