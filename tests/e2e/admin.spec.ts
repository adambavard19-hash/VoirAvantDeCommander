import { expect, test, type Page } from "@playwright/test";

const email = process.env.ADMIN_EMAIL!;
const password = process.env.ADMIN_PASSWORD!;

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("de la création du restaurant au menu publié avec QR code", async ({ page }) => {
  test.skip(!email || !password, "ADMIN_EMAIL / ADMIN_PASSWORD requis");
  await login(page);
  const name = `Bistrot E2E ${Date.now()}`;
  await page.getByRole("link", { name: "Créer un restaurant" }).first().click();
  await page.getByLabel("Nom du restaurant *").fill(name);
  await page.getByRole("button", { name: "Créer le restaurant" }).click();
  await expect(page.getByText("L'espace du restaurant est prêt")).toBeVisible();
  const base = page.url().split("?")[0]!;

  // Ajout d'un plat dans la catégorie « Plats ».
  await page.goto(`${base}/menu`);
  const plats = page.locator("[id^=edit-cat-]").filter({ has: page.getByRole("heading", { name: "Plats" }) });
  await plats.getByRole("button", { name: "Plat", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom du plat *").fill("Entrecôte grillée");
  await dialog.getByLabel("Prix (EUR)").fill("24,50");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Entrecôte grillée")).toBeVisible();

  // Publication.
  await page.getByRole("button", { name: "Publier le menu" }).click();
  await page.getByRole("button", { name: "Publier maintenant" }).click();
  await expect(page.getByText(/Menu publié \(version 1\)/)).toBeVisible();

  // Le menu public est en ligne et le QR code pointe vers lui.
  const slug = (await page.getByRole("link", { name: /\/menu\// }).first().textContent())!.split("/menu/")[1]!.trim();
  const menu = await page.request.get(`/menu/${slug}`);
  expect(menu.status()).toBe(200);
  expect(await menu.text()).toContain("Entrecôte grillée");
  const qr = await page.request.get(`${base.replace("/admin/restaurants", "/api/admin/restaurants")}/qr?format=pdf&template=table-card`);
  expect(qr.headers()["content-type"]).toBe("application/pdf");
});

test("les pages d'administration exigent une connexion", async ({ page, request }) => {
  await page.goto("/admin/restaurants");
  await expect(page).toHaveURL(/\/admin\/login/);
  const res = await request.get("/api/admin/restaurants");
  expect(res.status()).toBe(401);
});
