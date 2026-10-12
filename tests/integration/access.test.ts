import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkRestaurantAccess, restaurantScope } from "@/lib/auth/guards";
import { updateUser } from "@/lib/users";
import { createTestRestaurant, createUser } from "./helpers";

describe("isolation des restaurants et rôles", () => {
  it("un restaurateur n'accède qu'à ses restaurants, avec les droits de son rôle", async () => {
    const admin = await createUser("SUPER_ADMIN");
    const owner = await createUser("MEMBER");
    const editor = await createUser("MEMBER");
    const mine = await createTestRestaurant(admin.id);
    const other = await createTestRestaurant(admin.id);
    await db.restaurantMember.createMany({
      data: [
        { userId: owner.id, restaurantId: mine.id, role: "OWNER" },
        { userId: editor.id, restaurantId: mine.id, role: "EDITOR" },
      ],
    });
    const as = (u: typeof owner) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

    expect(await checkRestaurantAccess(as(owner), mine.id, "PUBLISH")).toBe(true);
    expect(await checkRestaurantAccess(as(editor), mine.id, "EDIT")).toBe(true);
    expect(await checkRestaurantAccess(as(editor), mine.id, "PUBLISH")).toBe(false);
    expect(await checkRestaurantAccess(as(owner), other.id, "VIEW")).toBe(false);
    expect(await checkRestaurantAccess(as(admin), other.id, "PUBLISH")).toBe(true);

    const visible = await db.restaurant.findMany({ where: restaurantScope(as(owner)), select: { id: true } });
    expect(visible.map((r) => r.id)).toEqual([mine.id]);
  });

  it("empêche de supprimer le dernier administrateur et ferme les sessions d'un compte désactivé", async () => {
    const admin = await createUser("SUPER_ADMIN");
    await expect(updateUser(admin.id, { role: "MEMBER" }, admin.id)).rejects.toThrow(/propres droits/);
    const member = await createUser("MEMBER");
    await db.session.create({ data: { id: `s-${member.id}`, userId: member.id, expiresAt: new Date(Date.now() + 3600_000) } });
    await updateUser(member.id, { isActive: false }, admin.id);
    expect(await db.session.count({ where: { userId: member.id } })).toBe(0);
  });
});
