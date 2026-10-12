import { expect, test } from "@playwright/test";

test.describe("menu client (restaurant de démonstration)", () => {
  test("affiche le menu, ouvre un plat en 3D et prépare la réalité augmentée", async ({ page }) => {
    await page.goto("/menu/demo");
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
    await page.goto("/menu/demo");
    await page.getByRole("button", { name: "Choisir la langue" }).click();
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page).toHaveURL(/lang=ar/);
    await expect(page.locator("[lang=ar][dir=rtl]").first()).toBeVisible();
    await expect(page.getByText("برغر المطعم المميز").first()).toBeVisible();
    await expect(page.getByText("19 €").first()).toBeVisible();
  });

  test("garde des plats dans « Mes envies »", async ({ page }) => {
    await page.goto("/menu/demo");
    await page.getByRole("button", { name: /Tiramisu maison/ }).first().click();
    const dish = page.getByRole("dialog", { name: "Tiramisu maison" });
    await dish.getByRole("button", { name: "Ajouter à mes envies" }).click();
    await dish.getByRole("button", { name: "Fermer" }).click();
    await expect(dish).toBeHidden();
    await page.getByRole("button", { name: "Mes envies" }).click();
    await expect(page.getByRole("dialog", { name: "Mes envies" }).getByText("Tiramisu maison")).toBeVisible();
  });
});
