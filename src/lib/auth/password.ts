import bcrypt from "bcryptjs";

const COST = 12;

export const PASSWORD_MIN_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Retourne un message d'erreur si le mot de passe est trop faible, sinon null. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  if (password.length > 200) return "Le mot de passe est trop long.";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(password)).length;
  if (classes < 3)
    return "Utilisez au moins trois types de caractères (minuscules, majuscules, chiffres, symboles).";
  return null;
}
