import "dotenv/config";
import { chromium } from "@playwright/test";
const [S, rbase] = process.argv.slice(2);
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, ...a);
async function main() {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, locale: "fr-FR" });
  p.on("pageerror", (e) => log("ERREUR page", e.message));
  p.on("console", (m) => m.type() === "error" && log("console", m.text().slice(0, 200)));
  await p.goto("http://localhost:3000/admin/login");
  await p.getByLabel("E-mail").fill(process.env.ADMIN_EMAIL!);
  await p.getByLabel("Mot de passe").fill(process.env.ADMIN_PASSWORD!);
  await p.getByRole("button", { name: "Se connecter" }).click();
  await p.waitForURL(/\/admin$/);
  await p.goto(`${rbase}/menu?photos3d=1`);
  for (let i = 0; i < 40; i++) {
    const t = await p.getByRole("button", { name: /Photos \d+\/\d+/ }).textContent().catch(() => null);
    log("photos", t);
    if (t && /Photos ([3-9]|\d\d)\//.test(t)) break;
    await p.waitForTimeout(5000);
  }
  await p.screenshot({ path: `${S}/ph.png`, fullPage: false });
  await b.close();
}
main();
