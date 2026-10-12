import { env } from "@/lib/env";
import { verifyPayload } from "@/lib/crypto";
import { isTemplate, renderQr, type QrFormat } from "@/lib/qr/service";

/** Téléchargement du QR code via un lien signé envoyé au restaurateur. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const payload = verifyPayload<{ r: string; f: string; t: string }>(env().APP_SECRET, token);
  if (!payload || !["png", "svg", "pdf"].includes(payload.f)) return new Response("Lien expiré ou invalide.", { status: 410 });
  try {
    const file = await renderQr(payload.r, payload.f as QrFormat, isTemplate(payload.t) ? payload.t : "table-card");
    return new Response(new Uint8Array(file.body), {
      headers: { "Content-Type": file.type, "Content-Disposition": `attachment; filename="${file.filename}"`, "Cache-Control": "private, no-store" },
    });
  } catch {
    return new Response("Restaurant introuvable.", { status: 404 });
  }
}
