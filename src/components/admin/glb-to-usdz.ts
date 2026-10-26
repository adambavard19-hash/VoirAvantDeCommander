"use client";

/**
 * Recrée le fichier USDZ (réalité augmentée sur iPhone) à partir d'un GLB, dans le
 * navigateur (three.js) : utilisé après une correction du modèle pour que l'iPhone
 * affiche exactement la même géométrie qu'Android et que la vue 3D.
 */
export async function usdzFromGlb(glbUrl: string, name: string): Promise<File> {
  const [{ GLTFLoader }, { USDZExporter }] = await Promise.all([
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/exporters/USDZExporter.js"),
  ]);
  const gltf = await new GLTFLoader().loadAsync(glbUrl);
  const data = await new USDZExporter().parseAsync(gltf.scene, {
    maxTextureSize: 2048,
    quickLookCompatible: true,
    ar: { anchoring: { type: "plane" }, planeAnchoring: { alignment: "horizontal" } },
  });
  return new File([data], name, { type: "model/vnd.usdz+zip" });
}
