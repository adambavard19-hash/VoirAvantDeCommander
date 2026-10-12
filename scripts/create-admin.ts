/**
 * Crée (ou réinitialise) un compte administrateur principal.
 * Usage : npm run admin:create -- admin@exemple.fr "Mot-de-passe-solide-1"
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/auth/password";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage : npm run admin:create -- <email> "<mot de passe>"');
    process.exit(1);
  }
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, role: "SUPER_ADMIN", isActive: true },
    create: { email: email.toLowerCase(), passwordHash, role: "SUPER_ADMIN", name: "Administrateur" },
  });
  await db.session.deleteMany({ where: { userId: user.id } });
  console.log(`✓ Administrateur prêt : ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
