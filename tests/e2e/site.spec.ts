import { expect, test } from "@playwright/test";

test("le site vitrine présente le concept et envoie une demande de démonstration", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vos clients ne lisent plus seulement votre menu");
  for (const id of ["concept", "demo", "realite-augmentee", "avantages", "fonctionnement", "demande-demo"]) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  await expect(page.getByRole("link", { name: "Connexion" })).toHaveAttribute("href", "/admin/login");

  const form = page.locator("#demande-demo form");
  await form.scrollIntoViewIfNeeded();
  await form.getByLabel("Nom et prénom *").fill("Camille Test");
  await form.getByLabel("E-mail *").fill(`camille.${Date.now()}@exemple.fr`);
  await form.getByLabel("Restaurant *").fill("Le Bistrot de Test");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Demander ma démonstration" }).click();
  await expect(page.getByText("Demande envoyée")).toBeVisible();
});

test("les pages légales signalent les informations à compléter", async ({ page }) => {
  await page.goto("/mentions-legales");
  await expect(page.getByText("À compléter").first()).toBeVisible();
});
