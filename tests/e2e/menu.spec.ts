import { expect, test, type Page } from "@playwright/test";

/** Les démos rejouent l'entrée à chaque ouverture : on la passe pour arriver au menu. */
async function openMenu(page: Page, url = "/menu/demo") {
  await page.goto(url);
  await page.getByRole("button", { name: "Passer" }).click();
  await expect(page.locator("[data-entrance]")).toHaveCount(0);
}

test.describe("menu client (restaurant de démonstration)", () => {
  test("affiche le menu, ouvre un plat en 3D et prépare la réalité augmentée", async ({ page }) => {
    await openMenu(page);
    await expect(page.getByRole("heading", { level: 1, name: "Atelier Saveurs" })).toBeVisible();
    // Langue du téléphone (fr-FR) détectée automatiquement.
    await expect(page.locator("[lang=fr][dir=ltr]").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Catégories" })).toBeVisible();

    await page.getByRole("button", { name: /Burger signature/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Burger signature" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("19 €")).toBeVisible();
    await expect(dialog.getByText("Gluten")).toBeVisible();

    const viewer = dialog.locator("model-viewer");
    await expect(viewer).toBeAttached({ timeout: 30_000 });
    await expect(viewer).toHaveAttribute("src", /\/files\/.+\.glb$/);
    await expect(viewer).toHaveAttribute("ios-src", /\/files\/.+\.usdz$/);
    await expect(viewer).toHaveAttribute("ar-modes", "webxr scene-viewer quick-look");
    await expect(viewer).toHaveAttribute("ar-scale", "fixed"); // taille réelle validée
    await expect(dialog.getByRole("button", { name: "Voir ce plat sur ma table" })).toBeVisible();

    // Le fichier USDZ est servi avec le type exigé par AR Quick Look.
    const usdz = await viewer.getAttribute("ios-src");
    const res = await page.request.get(usdz!);
    expect(res.headers()["content-type"]).toBe("model/vnd.usdz+zip");

    // « Parfait avec… » ouvre le plat recommandé.
    await dialog.getByRole("button", { name: /Cocktail agrumes/ }).click();
    await expect(page.getByRole("dialog", { name: "Cocktail agrumes" })).toBeVisible();
  });

  test("change de langue (arabe, de droite à gauche) sans modifier les prix", async ({ page }) => {
    await openMenu(page);
    await page.getByRole("button", { name: "Choisir la langue" }).click();
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page).toHaveURL(/lang=ar/);
    await expect(page.locator("[lang=ar][dir=rtl]").first()).toBeVisible();
    await expect(page.getByText("برغر المطعم المميز").first()).toBeVisible();
    await expect(page.getByText("19 €").first()).toBeVisible();
  });

  test("garde des plats dans « Mes envies »", async ({ page }) => {
    await openMenu(page);
    await page.getByRole("button", { name: /Tiramisu maison/ }).first().click();
    const dish = page.getByRole("dialog", { name: "Tiramisu maison" });
    await dish.getByRole("button", { name: "Ajouter à mes envies" }).click();
    await dish.getByRole("button", { name: "Fermer" }).click();
    await expect(dish).toBeHidden();
    await page.getByRole("button", { name: "Mes envies" }).click();
    await expect(page.getByRole("dialog", { name: "Mes envies" }).getByText("Tiramisu maison")).toBeVisible();
  });
});

test.describe("entrée animée", () => {
  test("joue la devanture puis la salle, peut être passée et se rejoue sur la démo", async ({ page }) => {
    await page.goto("/menu/demo");
    const intro = page.locator("[data-entrance]");
    await expect(intro).toBeVisible();
    await expect(intro.getByText("Atelier Saveurs")).toBeAttached();
    await page.getByRole("button", { name: "Passer" }).click();
    await expect(intro).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Atelier Saveurs" })).toBeVisible();
    // Lien commercial : l'entrée se rejoue à chaque ouverture.
    await page.reload();
    await expect(page.locator("[data-entrance]")).toBeVisible();
  });

  test("se termine seule et laisse place au menu", async ({ page }) => {
    await page.goto("/menu/demo");
    await expect(page.locator("[data-entrance]")).toHaveCount(0, { timeout: 15_000 });
    await page.getByRole("button", { name: /Burger signature/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Burger signature" })).toBeVisible();
  });
});
