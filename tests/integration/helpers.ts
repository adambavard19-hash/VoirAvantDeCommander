import { db } from "@/lib/db";
import { createRestaurant, restaurantInputSchema } from "@/lib/restaurants";
import { hashPassword } from "@/lib/auth/password";

let counter = 0;

export async function createUser(role: "SUPER_ADMIN" | "MEMBER" = "SUPER_ADMIN") {
  counter++;
  return db.user.create({
    data: { email: `user${Date.now()}${counter}@test.local`, passwordHash: await hashPassword("Test-password-123"), role },
  });
}

export async function createTestRestaurant(userId: string, name = `Restaurant test ${Date.now()} ${++counter}`) {
  return createRestaurant(restaurantInputSchema.parse({ name, locales: ["fr", "en"] }), userId);
}
