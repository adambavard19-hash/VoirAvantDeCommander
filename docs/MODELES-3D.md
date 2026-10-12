# Préparer les modèles 3D des plats

Chaque plat peut avoir deux fichiers :

| Fichier | Utilisé par | Remarques |
| --- | --- | --- |
| `.glb` | Android (Scene Viewer, WebXR), ordinateurs, visionneuse 3D | glTF 2.0 binaire |
| `.usdz` | iPhone / iPad (AR Quick Look) | Archive USD non compressée |

Sans USDZ, l'iPhone utilise une conversion automatique du GLB (qualité variable) : un USDZ dédié est recommandé.

## Nommage

Utilisez le même nom pour tous les fichiers d'un plat, proche du nom sur la carte :

```
burger-maison.glb
burger-maison.usdz
burger-maison.jpg
```

Majuscules, accents, tirets, espaces et mots comme « photo », « final », « v2 » sont ignorés lors de la
comparaison. Les nombres comptent (« pizza-4-fromages » ≠ « pizza-3-fromages »). Un dossier par catégorie
(`Desserts/…`) aide à classer les plats créés à partir des fichiers.

## Échelle et orientation

- Unité : **le mètre** (norme glTF). Un plat de 26 cm de diamètre doit mesurer 0,26 dans le fichier.
- Axe vertical Y, plat posé sur le sol (point le plus bas à Y = 0), centré.
- Le logiciel mesure le GLB et signale les tailles aberrantes (mauvaise unité) ou un plat qui « flotte ».
- La taille réelle doit être validée dans la fiche du plat (et vérifiée sur iPhone pour le USDZ).

## Poids et performance (réseau mobile)

| Critère | Objectif |
| --- | --- |
| Taille de fichier | < 10 Mo (alerte au-delà, forte alerte au-delà de 25 Mo) |
| Triangles | < 200 000 (alerte au-delà de 500 000) |
| Textures | 2048 px maximum |

Outils utiles : Blender (export glTF), Reality Converter ou `usdzip` (Apple) pour le USDZ,
`gltf-transform` pour compresser (Draco / Meshopt) et réduire les textures.

## Modèles de démonstration

Les modèles du restaurant fictif « Atelier Saveurs » (`public/demo/models`) sont générés par
`npm run demo:models` : ce sont des modèles stylisés, pas des numérisations de plats réels.
