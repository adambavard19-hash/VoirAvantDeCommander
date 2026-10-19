import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createAssetFromBuffer } from "@/lib/assets/service";
import { analyzeImport, proposalStats } from "@/lib/import/analyze";
import { applyImport } from "@/lib/import/apply";
import { createTestRestaurant, createUser } from "./helpers";
import { makeGlb, makeImage, makeUsdz } from "../helpers/fixtures";

async function addFile(restaurantId: string, jobId: string, userId: string, name: string, buffer: Buffer, path?: string) {
  const a = await createAssetFromBuffer({ restaurantId, userId, name, buffer, importJobId: jobId, path });
  expect(a?.status, `${name}: ${a?.error}`).toBe("READY");
  return a!;
}

describe("import intelligent (de bout en bout)", () => {
  it("associe menu CSV, photos, GLB et USDZ, puis applique au brouillon", async () => {
    const user = await createUser();
    const r = await createTestRestaurant(user.id);
    const job = await db.importJob.create({ data: { restaurantId: r.id, createdById: user.id } });

    const csv = "Catégorie;Nom;Description;Prix;Allergènes\nEntrées;Burrata crémeuse;Tomates anciennes;14,50;lait\nPlats;Burger maison;Bœuf, cheddar;19;gluten, lait\nPlats;Tiramisu;;8,5;\n";
    await addFile(r.id, job.id, user.id, "carte.csv", Buffer.from(csv));
    await addFile(r.id, job.id, user.id, "burger-maison.glb", makeGlb(0.26));
    await addFile(r.id, job.id, user.id, "burger-maison.usdz", makeUsdz());
    await addFile(r.id, job.id, user.id, "Burger_Maison_photo.jpg", await makeImage());
    await addFile(r.id, job.id, user.id, "tiramissu.jpg", await makeImage("#7a4a2a")); // faute de frappe → suggestion
    await addFile(r.id, job.id, user.id, "pizza-margherita.glb", makeGlb(0.3), "Plats/pizza-margherita.glb"); // plat absent du menu
    await addFile(r.id, job.id, user.id, "IMG_4821.jpg", await makeImage("#222222")); // photo anonyme

    const proposal = await analyzeImport({ restaurantId: r.id, jobId: job.id, userId: user.id });
    expect(proposal.documents[0]).toMatchObject({ name: "carte.csv", status: "parsed", dishes: 3 });

    const burger = proposal.dishes.find((d) => d.name === "Burger maison")!;
    expect(burger.action).toBe("create");
    expect(burger.priceCents).toBe(1900);
    expect(burger.allergens).toEqual(["gluten", "milk"]);
    expect(burger.media.glb).toMatchObject({ name: "burger-maison.glb", confidence: "exact", confirmed: true });
    expect(burger.media.usdz).toMatchObject({ name: "burger-maison.usdz", confidence: "exact", confirmed: true });
    expect(burger.media.photo).toMatchObject({ name: "Burger_Maison_photo.jpg", confirmed: true });

    // Ressemblance seulement : jamais associée sans validation humaine.
    const tiramisu = proposal.dishes.find((d) => d.name === "Tiramisu")!;
    expect(tiramisu.media.photo).toMatchObject({ name: "tiramissu.jpg", confidence: "suggested", confirmed: false });

    // Fichier sans plat correspondant : nouveau plat proposé, rangé grâce au dossier.
    const pizza = proposal.dishes.find((d) => d.media.glb?.name === "pizza-margherita.glb")!;
    expect(pizza).toMatchObject({ action: "create", name: "Pizza margherita" });
    expect(proposal.categories.find((c) => c.ref === pizza.categoryRef)!.name).toBe("Plats");

    // Photo anonyme : laissée au choix de l'utilisateur.
    expect(proposal.unmatched.map((u) => u.name)).toContain("IMG_4821.jpg");

    const stats = proposalStats(proposal);
    expect(stats.toValidate).toBe(1);

    // Application sans valider la suggestion : la photo du tiramisu n'est PAS associée.
    const report = await applyImport({ restaurantId: r.id, jobId: job.id, userId: user.id, proposal });
    expect(report.errors).toEqual([]);
    expect(report.dishesCreated).toBe(4);
    expect(report.skippedSuggestions).toBe(1);

    const dishes = await db.dish.findMany({ where: { restaurantId: r.id }, include: { category: true } });
    const savedBurger = dishes.find((d) => d.name === "Burger maison")!;
    expect(savedBurger.glbAssetId).toBeTruthy();
    expect(savedBurger.usdzAssetId).toBeTruthy();
    expect(savedBurger.photoAssetId).toBeTruthy();
    expect(savedBurger.category.name).toBe("Plats");
    expect(dishes.find((d) => d.name === "Tiramisu")!.photoAssetId).toBeNull();

    // Rien n'est publié par l'import.
    const fresh = await db.restaurant.findUniqueOrThrow({ where: { id: r.id } });
    expect(fresh.publishedVersionId).toBeNull();
  });

  it("met à jour un plat existant au lieu de le dupliquer", async () => {
    const user = await createUser();
    const r = await createTestRestaurant(user.id);
    const cat = await db.category.findFirstOrThrow({ where: { restaurantId: r.id } });
    const existing = await db.dish.create({ data: { restaurantId: r.id, categoryId: cat.id, name: "Burger Maison", priceCents: 1800 } });
    const job = await db.importJob.create({ data: { restaurantId: r.id, createdById: user.id } });
    await addFile(r.id, job.id, user.id, "burger-maison.glb", makeGlb());
    await addFile(r.id, job.id, user.id, "menu.csv", Buffer.from("Nom,Prix\nBurger maison,19,50\n".replace("19,50", '"19,50"')));

    const proposal = await analyzeImport({ restaurantId: r.id, jobId: job.id, userId: user.id });
    const update = proposal.dishes.find((d) => d.existingDishId === existing.id)!;
    expect(update.action).toBe("update");
    expect(update.priceCents).toBe(1950);
    expect(update.media.glb?.confirmed).toBe(true);
    expect(proposal.dishes.filter((d) => d.action === "create")).toHaveLength(0);

    await applyImport({ restaurantId: r.id, jobId: job.id, userId: user.id, proposal });
    const after = await db.dish.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after.priceCents).toBe(1950);
    expect(after.glbAssetId).toBeTruthy();
    expect(after.name).toBe("Burger Maison");
    expect(await db.dish.count({ where: { restaurantId: r.id } })).toBe(1);
  });

  it("refuse un fichier appartenant à un autre restaurant", async () => {
    const user = await createUser();
    const a = await createTestRestaurant(user.id);
    const b = await createTestRestaurant(user.id);
    const jobA = await db.importJob.create({ data: { restaurantId: a.id } });
    const jobB = await db.importJob.create({ data: { restaurantId: b.id } });
    const foreign = await addFile(b.id, jobB.id, user.id, "secret.glb", makeGlb());
    await addFile(a.id, jobA.id, user.id, "burger.glb", makeGlb());
    const proposal = await analyzeImport({ restaurantId: a.id, jobId: jobA.id, userId: user.id });
    proposal.dishes[0]!.media.glb = { assetId: foreign.id, name: "secret.glb", confidence: "manual", score: 1, confirmed: true };
    await expect(applyImport({ restaurantId: a.id, jobId: jobA.id, userId: user.id, proposal })).rejects.toThrow(/invalide/);
  });

  it("extrait une archive ZIP en conservant les dossiers", async () => {
    const { zipSync } = await import("fflate");
    const user = await createUser();
    const r = await createTestRestaurant(user.id);
    const job = await db.importJob.create({ data: { restaurantId: r.id } });
    const zip = Buffer.from(
      zipSync({
        "Desserts/fondant-chocolat.glb": new Uint8Array(makeGlb(0.22)),
        "Desserts/fondant-chocolat.usdz": [new Uint8Array(makeUsdz()), { level: 0 }],
        "__MACOSX/._fondant": new Uint8Array([1, 2, 3]),
        "notes.docx": new Uint8Array([1]),
      }),
    );
    await addFile(r.id, job.id, user.id, "restaurant.zip", zip);
    const proposal = await analyzeImport({ restaurantId: r.id, jobId: job.id, userId: user.id });
    const fondant = proposal.dishes.find((d) => d.name === "Fondant chocolat")!;
    expect(fondant.media.glb?.confirmed).toBe(true);
    expect(fondant.media.usdz?.confirmed).toBe(true);
    expect(proposal.categories.find((c) => c.ref === fondant.categoryRef)!.name).toBe("Desserts");
    expect(proposal.warnings.join(" ")).toMatch(/ignoré/);
  });
  it("import en masse de fichiers 3D : un plat par nom, même proches, et sous-catégories proposées", async () => {
    const user = await createUser();
    const r = await createTestRestaurant(user.id);
    const plats = await db.category.create({ data: { restaurantId: r.id, name: "Plats", position: 0 } });
    await db.category.create({ data: { restaurantId: r.id, name: "Pizzas", parentId: plats.id, position: 1 } });
    const job = await db.importJob.create({ data: { restaurantId: r.id, createdById: user.id } });
    const names = ["Pizza_margherita", "Pizza_reine", "Burger_poulet", "Burrito_poulet", "Milkshake_vanille", "Milkshake_fraise", "Tacos_d_agneau_Los_amigos_"];
    for (const n of names) {
      await addFile(r.id, job.id, user.id, `${n}.glb`, makeGlb(0.2));
      await addFile(r.id, job.id, user.id, `${n}.usdz`, makeUsdz());
    }
    const proposal = await analyzeImport({ restaurantId: r.id, jobId: job.id, userId: user.id });
    expect(proposal.unmatched).toEqual([]);
    expect(proposal.dishes).toHaveLength(names.length);
    for (const d of proposal.dishes) {
      expect(d.media.glb?.confirmed).toBe(true);
      expect(d.media.usdz?.confirmed).toBe(true);
    }
    expect(proposal.dishes.map((d) => d.name)).toContain("Tacos d'agneau Los amigos");
    // La sous-catégorie existante est proposée avec sa parente.
    expect(proposal.categories.find((c) => c.name === "Pizzas")).toMatchObject({ parentName: "Plats" });
  });
});
