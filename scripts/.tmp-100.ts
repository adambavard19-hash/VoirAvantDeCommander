import "dotenv/config";
import { readdirSync } from "node:fs";
import { chromium } from "@playwright/test";
const S = process.argv[2];
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, ...a);
async function main() {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, locale: "fr-FR" });
  p.on("pageerror", (e) => log("ERREUR page", e.message));
  const base = "http://localhost:3000";
  await p.goto(`${base}/admin/login`);
  await p.getByLabel("E-mail").fill(process.env.ADMIN_EMAIL!);
  await p.getByLabel("Mot de passe").fill(process.env.ADMIN_PASSWORD!);
  await p.getByRole("button", { name: "Se connecter" }).click();
  await p.waitForURL(/\/admin$/);
  await p.getByRole("link", { name: "Créer un restaurant" }).first().click();
  await p.getByLabel("Nom du restaurant *").fill(`Test 100 fichiers ${Date.now()}`);
  await p.getByRole("button", { name: "Créer le restaurant" }).click();
  await p.getByText("L'espace du restaurant est prêt").waitFor();
  const rbase = p.url().split("?")[0]!;
  log("restaurant", rbase);

  // Sous-catégories « Burgers » et « Tacos » dans « Plats », via l'éditeur.
  await p.goto(`${rbase}/menu`);
  for (const name of ["Burgers", "Tacos"]) {
    const plats = p.locator("[id^=edit-cat-]").filter({ has: p.getByRole("heading", { name: "Plats", exact: true }) });
    await plats.getByRole("button", { name: "Sous-catégorie" }).click();
    const dlg = p.getByRole("dialog");
    await dlg.getByLabel("Nom").fill(name);
    await dlg.getByRole("button", { name: /Enregistrer|Créer/ }).click();

    await dlg.waitFor({ state: "hidden" });
    await p.waitForTimeout(1500);
  }
  await p.screenshot({ path: `${S}/c1-souscat.png`, fullPage: true });
  log("sous-catégories créées");

  await p.goto(`${rbase}/import`);
  const files = readdirSync(`${S}/files100`).map((f) => `${S}/files100/${f}`);
  await p.locator("input[type=file]:not([webkitdirectory])").first().setInputFiles(files);
  log("fichiers déposés", files.length);
  const analyse = p.getByRole("button", { name: /Analyser et associer/ });
  await analyse.waitFor({ timeout: 120000 });
  for (let i = 0; i < 1800 && !(await analyse.isEnabled()); i++) await p.waitForTimeout(1000);
  log("envoi terminé");
  await p.screenshot({ path: `${S}/c2-envoi.png`, fullPage: false });
  await analyse.click();
  await p.getByRole("button", { name: /Appliquer au brouillon/ }).waitFor({ timeout: 300000 });
  log("analyse terminée");
  await p.getByRole("button", { name: /Tous les plats/ }).click();
  await p.screenshot({ path: `${S}/c3-analyse.png`, fullPage: false });
  // Rangement groupé : les burgers puis les tacos.
  const rows = p.locator("li").filter({ has: p.getByLabel("Nom du plat") });
  log("plats proposés", await rows.count());
  for (const [word, label] of [["Burger", "Plats › Burgers"], ["Tacos", "Plats › Tacos"]] as const) {
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i);
      const name = await row.getByLabel("Nom du plat").inputValue();
      if (name.toLowerCase().includes(word.toLowerCase())) await row.getByRole("checkbox").check();
    }
    await p.getByLabel("Ranger les plats sélectionnés dans").selectOption({ label });
  }
  await p.screenshot({ path: `${S}/c4-range.png`, fullPage: false });
  await p.getByRole("button", { name: /Appliquer au brouillon/ }).click();
  await p.getByRole("link", { name: "Vérifier le menu" }).waitFor({ timeout: 300000 });
  log("import appliqué");
  await p.screenshot({ path: `${S}/c5-applique.png`, fullPage: false });
  await p.getByRole("link", { name: "Vérifier le menu" }).click();
  await p.waitForURL(/photos3d=1/);
  // Photos créées depuis la 3D (rendu logiciel ici : plus lent qu'un vrai ordinateur).
  for (let i = 0; i < 120; i++) {
    const t = await p.getByRole("button", { name: /Photos \d+\/\d+/ }).textContent().catch(() => null);
    if (i % 6 === 0) log("photos", t);
    if (!t && i > 3) break;
    await p.waitForTimeout(5000);
  }
  await p.screenshot({ path: `${S}/c6-menu.png`, fullPage: true });
  log("fin");
  console.log("RBASE", rbase);
  await b.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
