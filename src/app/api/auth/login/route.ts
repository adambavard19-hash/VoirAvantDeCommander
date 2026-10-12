import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, readJson, route, tooMany, unauthorized } from "@/lib/http";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { hashIp, isLoginBlocked, recordLoginAttempt } from "@/lib/auth/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

// Empreinte factice : le temps de réponse est le même que l'e-mail existe ou non.
const DUMMY_HASH = "$2b$12$Okf17ZUP7lPKcHnZISBfu.2imiatzoL0NRqJlcHd/xTbozzH/etkG";

export const POST = route(async (request) => {
  const { email, password } = schema.parse(await readJson(request));
  const ipHash = hashIp(clientIp(request));
  if (await isLoginBlocked(email, ipHash)) throw tooMany("Trop de tentatives. Patientez 15 minutes avant de réessayer.");

  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.isActive) {
    await recordLoginAttempt(email, ipHash, false);
    throw unauthorized("E-mail ou mot de passe incorrect.");
  }
  await recordLoginAttempt(email, ipHash, true);
  await createSession(user.id, request.headers.get("user-agent"));
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { ok: true };
});
