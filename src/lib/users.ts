import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, conflict } from "@/lib/http";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { randomToken } from "@/lib/crypto";
import { audit } from "@/lib/audit";

const membership = z.object({ restaurantId: z.string(), role: z.enum(["OWNER", "EDITOR"]) });

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().max(120).optional(),
  role: z.enum(["SUPER_ADMIN", "MEMBER"]).default("MEMBER"),
  password: z.string().max(200).optional(),
  memberships: z.array(membership).max(200).default([]),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  role: z.enum(["SUPER_ADMIN", "MEMBER"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().max(200).optional(),
  memberships: z.array(membership).max(200).optional(),
});

/** Mot de passe provisoire lisible, conforme aux règles de robustesse. */
export function generatePassword(): string {
  return `Vadc-${randomToken(9).replace(/[-_]/g, "x")}7`;
}

async function assertRestaurants(ids: string[]) {
  if (!ids.length) return;
  const count = await db.restaurant.count({ where: { id: { in: ids } } });
  if (count !== new Set(ids).size) throw badRequest("Restaurant inconnu.");
}

export async function createUser(input: z.infer<typeof userCreateSchema>, actorId: string) {
  if (await db.user.findUnique({ where: { email: input.email } })) throw conflict("Un compte existe déjà avec cet e-mail.");
  const password = input.password || generatePassword();
  const problem = passwordProblem(password);
  if (problem) throw badRequest(problem);
  await assertRestaurants(input.memberships.map((m) => m.restaurantId));
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name || null,
      role: input.role,
      passwordHash: await hashPassword(password),
      memberships: { create: input.memberships.map((m) => ({ restaurantId: m.restaurantId, role: m.role })) },
    },
  });
  await audit({ userId: actorId, action: "user.create", details: { userId: user.id, email: user.email, role: user.role } });
  return { user, password: input.password ? null : password };
}

export async function updateUser(userId: string, input: z.infer<typeof userUpdateSchema>, actorId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const losingAdmin = user.role === "SUPER_ADMIN" && (input.role === "MEMBER" || input.isActive === false);
  if (losingAdmin) {
    if (userId === actorId) throw badRequest("Vous ne pouvez pas retirer vos propres droits d'administrateur.");
    const admins = await db.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
    if (admins <= 1) throw badRequest("Il doit rester au moins un administrateur principal actif.");
  }
  let passwordHash: string | undefined;
  if (input.password) {
    const problem = passwordProblem(input.password);
    if (problem) throw badRequest(problem);
    passwordHash = await hashPassword(input.password);
  }
  if (input.memberships) await assertRestaurants(input.memberships.map((m) => m.restaurantId));
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { name: input.name, role: input.role, isActive: input.isActive, ...(passwordHash ? { passwordHash } : {}) },
    }),
    ...(input.memberships
      ? [
          db.restaurantMember.deleteMany({ where: { userId } }),
          db.restaurantMember.createMany({ data: input.memberships.map((m) => ({ userId, restaurantId: m.restaurantId, role: m.role })) }),
        ]
      : []),
    // Désactivation ou nouveau mot de passe : toutes les sessions sont fermées.
    ...(input.isActive === false || passwordHash ? [db.session.deleteMany({ where: { userId } })] : []),
  ]);
  await audit({ userId: actorId, action: "user.update", details: { userId, fields: Object.keys(input) } });
}
