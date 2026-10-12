import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, clientIp, readJson, route, tooMany } from "@/lib/http";
import { hashIp } from "@/lib/auth/rate-limit";

const schema = z.object({
  type: z.enum(["DEMO", "CONTACT"]),
  name: z.string().trim().min(2, "Indiquez votre nom").max(120),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(200),
  phone: z.string().trim().max(40).optional(),
  restaurantName: z.string().trim().max(160).optional(),
  city: z.string().trim().max(120).optional(),
  message: z.string().trim().max(3000).optional(),
  consent: z.literal(true, { error: "Votre accord est nécessaire pour être recontacté." }),
  /** Champ piège invisible : rempli uniquement par les robots. */
  website: z.string().max(0).optional(),
});

// Limitation simple par instance (complétée par la limite par e-mail en base).
const recent = new Map<string, number[]>();

/** Demande de démonstration ou message de contact depuis le site vitrine. */
export const POST = route(async (request) => {
  const body = await readJson<Record<string, unknown>>(request);
  if (typeof body.website === "string" && body.website.length) return { ok: true }; // robot : réponse neutre
  const input = schema.parse(body);
  const key = hashIp(clientIp(request)) ?? "unknown";
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < 3600_000);
  if (hits.length >= 5) throw tooMany("Trop de demandes envoyées. Réessayez plus tard.");
  recent.set(key, [...hits, now]);
  const sameEmail = await db.lead.count({ where: { email: input.email, createdAt: { gt: new Date(now - 3600_000) } } });
  if (sameEmail >= 3) throw tooMany("Votre demande a bien été reçue, nous revenons vers vous rapidement.");
  if (input.type === "DEMO" && !input.restaurantName) throw badRequest("Indiquez le nom de votre restaurant.");
  await db.lead.create({
    data: {
      type: input.type,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      restaurantName: input.restaurantName || null,
      city: input.city || null,
      message: input.message || null,
      consentAt: new Date(),
    },
  });
  return { ok: true };
});
