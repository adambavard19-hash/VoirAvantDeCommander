import { describe, expect, it } from "vitest";
import { normalizeName, normalizeDishName } from "@/lib/import/normalize";
import { groupMediaFiles, matchName, nameSimilarity } from "@/lib/import/match";

describe("normalizeName", () => {
  it("nettoie extensions, séparateurs, bruit et versions", () => {
    expect(normalizeName("burger-maison.glb").key).toBe("burger maison");
    expect(normalizeName("Burger_Maison_photo_final_v2.JPG").key).toBe("burger maison");
    expect(normalizeName("Desserts/BurgerMaison (1).usdz").key).toBe("burger maison");
    expect(normalizeName("crème-brûlée@2x.png").key).toBe("creme brulee");
    expect(normalizeName("tarte_tatin_1024x1024.jpg").key).toBe("tarte tatin");
  });

  it("rétablit l'apostrophe d'élision", () => {
    expect(normalizeName("Tacos_d_agneau_Los_amigos_.glb").display).toBe("Tacos d'agneau Los amigos");
    expect(normalizeName("Los_amigos_burger.glb").display).toBe("Los amigos burger");
    expect(normalizeName("BURGER_MAISON.glb").display).toBe("Burger maison");
    expect(normalizeName("salade-de-chevre.jpg").display).toBe("Salade de chevre");
    expect(normalizeName("creme_d_anis_l_orange.png").display).toBe("Creme d'anis l'orange");
  });

  it("propose un nom lisible avec accents", () => {
    expect(normalizeName("creme-brulee.jpg").display).toBe("Creme brulee");
    expect(normalizeName("Crème-Brûlée.jpg").display).toBe("Crème brûlée");
  });

  it("conserve les nombres significatifs", () => {
    expect(normalizeName("pizza-4-fromages.glb").key).toBe("pizza 4 fromage");
    expect(normalizeName("pizza-4-fromages.glb").key).not.toBe(normalizeName("pizza-3-fromages.glb").key);
  });

  it("repère les noms d'appareil photo sans information", () => {
    expect(normalizeName("IMG_4821.jpg").anonymous).toBe(true);
    expect(normalizeName("DSC01234.JPG").anonymous).toBe(true);
    expect(normalizeName("tiramisu.jpg").anonymous).toBe(false);
  });

  it("met au singulier et ignore les mots de liaison", () => {
    expect(normalizeDishName("Salade de tomates").key).toBe("salade tomate");
    expect(normalizeName("salade-tomate.jpg").key).toBe("salade tomate");
  });
});

describe("groupMediaFiles", () => {
  it("associe GLB, USDZ et photo du même plat", () => {
    const groups = groupMediaFiles([
      { assetId: "1", name: "burger-maison.glb", kind: "glb" },
      { assetId: "2", name: "burger-maison.usdz", kind: "usdz" },
      { assetId: "3", name: "Burger Maison.jpg", kind: "image" },
      { assetId: "4", name: "tiramisu.glb", kind: "glb" },
    ]);
    expect(groups).toHaveLength(2);
    const burger = groups.find((g) => g.key === "burger maison")!;
    expect(burger.glbs.map((f) => f.assetId)).toEqual(["1"]);
    expect(burger.usdzs.map((f) => f.assetId)).toEqual(["2"]);
    expect(burger.images.map((f) => f.assetId)).toEqual(["3"]);
  });

  it("ne regroupe jamais des noms seulement ressemblants", () => {
    const groups = groupMediaFiles([
      { assetId: "1", name: "burger-maison.glb", kind: "glb" },
      { assetId: "2", name: "burger-maison-classique.usdz", kind: "usdz" },
    ]);
    expect(groups).toHaveLength(2);
  });

  it("garde chaque photo anonyme séparée", () => {
    const groups = groupMediaFiles([
      { assetId: "1", name: "IMG_0001.jpg", kind: "image" },
      { assetId: "2", name: "IMG_0002.jpg", kind: "image" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.anonymous)).toBe(true);
  });

  it("retient le dossier comme indice de catégorie", () => {
    const [g] = groupMediaFiles([{ assetId: "1", name: "tiramisu.jpg", path: "Restaurant/Desserts/tiramisu.jpg", kind: "image" }]);
    expect(g!.folder).toBe("Desserts");
  });
});

describe("matchName", () => {
  const candidates = [
    { ref: "a", name: "Burger maison" },
    { ref: "b", name: "Burger végétarien" },
    { ref: "c", name: "Tiramisu" },
    { ref: "d", name: "Pizza 4 fromages" },
  ];

  it("associe automatiquement une correspondance exacte et unique", () => {
    const r = matchName(normalizeName("burger-maison.usdz"), candidates);
    expect(r.status).toBe("exact");
    if (r.status === "exact") expect(r.candidate.ref).toBe("a");
  });

  it("accepte un ordre de mots différent", () => {
    expect(matchName(normalizeName("maison_burger.glb"), candidates).status).toBe("exact");
  });

  it("propose (sans associer) une correspondance approchante", () => {
    const r = matchName(normalizeName("tiramisou.jpg"), candidates);
    expect(r.status).toBe("suggested");
    if (r.status === "suggested") expect(r.candidate.ref).toBe("c");
    const r2 = matchName(normalizeName("burger.glb"), candidates);
    expect(r2.status).toBe("suggested");
  });

  it("n'associe pas automatiquement en cas de doublon de nom", () => {
    const r = matchName(normalizeName("tiramisu.jpg"), [...candidates, { ref: "e", name: "Tiramisu" }]);
    expect(r.status).toBe("suggested");
  });

  it("ne confond pas deux plats différenciés par un nombre", () => {
    const r = matchName(normalizeName("pizza-3-fromages.glb"), candidates);
    expect(r.status).not.toBe("exact");
  });

  it("ne propose rien pour un fichier sans rapport", () => {
    expect(matchName(normalizeName("logo-restaurant.png"), candidates).status).toBe("none");
  });

  it("donne une similarité élevée pour une faute de frappe", () => {
    expect(nameSimilarity(normalizeName("tiramissu.jpg"), normalizeDishName("Tiramisu"))).toBeGreaterThan(0.6);
  });
});

describe("fichiers réels d'un restaurant (scan 3D GLB + USDZ)", () => {
  const files = [
    { assetId: "1", name: "Los_amigos_burger.glb", kind: "glb" as const },
    { assetId: "2", name: "Los_amigos_burger.usdz", kind: "usdz" as const },
    { assetId: "3", name: "Tacos_d_agneau_Los_amigos_.glb", kind: "glb" as const },
    { assetId: "4", name: "Tacos_d_agneau_Los_amigos_.usdz", kind: "usdz" as const },
  ];

  it("regroupe le GLB et l'USDZ de chaque plat", () => {
    const groups = groupMediaFiles(files);
    expect(groups).toHaveLength(2);
    for (const g of groups) {
      expect(g.glbs).toHaveLength(1);
      expect(g.usdzs).toHaveLength(1);
    }
  });

  it("associe chaque groupe au bon plat de la carte", () => {
    const candidates = [
      { ref: "burger", name: "Los Amigos Burger" },
      { ref: "tacos", name: "Tacos d'agneau Los Amigos" },
    ];
    const byRef = Object.fromEntries(
      groupMediaFiles(files).map((g) => {
        const r = matchName(normalizeName(g.glbs[0]!.name), candidates);
        return [g.glbs[0]!.assetId, r.status === "none" ? null : r.candidate.ref];
      }),
    );
    expect(byRef).toEqual({ "1": "burger", "3": "tacos" });
  });
});
