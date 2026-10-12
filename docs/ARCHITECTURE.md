# Architecture technique

## Vue d'ensemble

Une seule application **Next.js 16 (App Router, TypeScript)** sert le site vitrine, le menu
public et l'administration. Ce choix limite la maintenance (un seul déploiement, un seul
langage) tout en restant découpé en modules indépendants.

```
Navigateur ──► Next.js (Node 22)
                 ├─ /               site vitrine (rendu serveur)
                 ├─ /menu/{slug}    menu public : lit l'instantané publié (1 requête indexée)
                 ├─ /admin/*        administration (sessions, rôles)
                 └─ /api/*          API JSON (administration, événements anonymes, formulaires)
                        │
                        ├─► PostgreSQL (Prisma 7)        données, versions publiées, traductions
                        └─► Stockage fichiers            local (dev) ou S3 + CDN (prod)
                               ▲
Navigateur ── téléversement direct (URL signée) ──┘   les gros fichiers 3D ne passent pas par l'API
```

| Couche | Choix | Raison |
| --- | --- | --- |
| Interface | React 19, Tailwind CSS 4, icônes Lucide | Rapide, accessible, thèmes par restaurant via variables CSS |
| 3D / AR | `@google/model-viewer` 4.2 | Standard du web : GLB (WebXR, Scene Viewer Android), USDZ (AR Quick Look iOS), repli 3D |
| Données | PostgreSQL + Prisma 7 (adaptateur `pg`) | Relationnel, transactions, JSON pour les instantanés |
| Fichiers | Pilote local ou S3 compatible | R2 / Scaleway / AWS : pas de limite de taille, CDN |
| Images | `sharp` | Variantes WebP 480/960/1600 px, miniature floue, orientation EXIF, métadonnées supprimées |
| Documents | `unpdf`, `papaparse`, `read-excel-file`, `fflate` | PDF texte, CSV, Excel, archives ZIP |
| QR / PDF | `qrcode`, `pdf-lib` | QR vectoriel, supports imprimables avec polices embarquées |
| IA (optionnel) | SDK Anthropic (`claude-opus-5-5`) | Lecture de menus scannés, traductions ; repli serveur en cas de refus |
| Tests | Vitest (unitaires + intégration sur PostgreSQL), Playwright (e2e) | |

## Modèle de données (prisma/schema.prisma)

- `User`, `Session`, `LoginAttempt`, `RestaurantMember` — comptes, sessions (jeton haché SHA-256), rôles.
- `Restaurant` — identité, coordonnées, thème, langues, préférences, `slug` (URL stable), version publiée.
- `SlugRedirect` — anciennes adresses : un QR code imprimé fonctionne toujours après un changement d'adresse.
- `Category`, `Dish`, `DishRecommendation` — le **brouillon** du menu. Prix en centimes.
- `Asset` — fichiers (images, GLB, USDZ, documents) avec analyse technique en JSON.
- `Translation` — une ligne par (entité, champ, langue), avec l'empreinte du texte source.
- `MenuVersion` — **instantanés publiés** (JSON) : le menu public ne lit que ceci.
- `QrCode` — URL encodée figée à la création, personnalisation, compteur de téléchargements.
- `ImportJob` — imports intelligents : proposition éditable, compte rendu.
- `DailyStat` — compteurs agrégés par jour (aucune donnée personnelle).
- `Lead`, `AuditLog` — demandes du site, journal des actions sensibles.

## Brouillon, publication, URL stable

1. L'administration modifie uniquement les tables du brouillon.
2. **Prévisualiser** construit l'instantané à la volée (`/menu/{slug}?preview=1`, réservé aux personnes autorisées).
3. **Publier** fige ce même instantané dans `MenuVersion` (avec traductions, références de fichiers, thème)
   et le désigne comme version en ligne. Les versions précédentes restent restaurables.
4. La **disponibilité** d'un plat (rupture) est appliquée immédiatement au brouillon et à la version en ligne.
5. Le QR code encode `APP_URL/menu/{slug}` ; cette URL ne change jamais. Si le slug est modifié,
   l'ancien slug redirige (308) vers le nouveau.

Les instantanés référencent les fichiers par **clé de stockage**, pas par URL : on peut changer de
CDN ou de pilote de stockage sans republier.

## Import intelligent (src/lib/import)

1. Les fichiers sont téléversés directement vers le stockage (URL signée), puis analysés :
   images optimisées, GLB mesurés (dimensions, triangles, textures, extensions), USDZ validés
   (premier fichier USD, archive non compressée, alignement 64 octets). Les ZIP sont décompressés
   avec garde-fous (nombre de fichiers, taille décompressée, chemins).
2. Les documents de menu sont lus : CSV/Excel par reconnaissance des colonnes (FR/EN/IT/ES),
   PDF par reconstruction de la mise en page (lignes, prix alignés, colonnes), texte par analyse
   heuristique (catégories, prix, déclinaisons, descriptions, mentions explicites d'allergènes).
   Si un PDF n'a pas de texte et qu'une clé IA est configurée, Claude lit le document.
3. Les fichiers sont regroupés par **nom normalisé** (accents, séparateurs, CamelCase, mots parasites
   comme « photo », « final », « v2 »), puis rapprochés des plats.
4. **Règle de sécurité** : association automatique uniquement si les mots significatifs sont
   identiques et qu'un seul plat correspond. Toute ressemblance (faute de frappe, nom partiel,
   doublon) devient une **suggestion à valider**. Les photos anonymes (`IMG_1234.jpg`) ne sont jamais associées seules.
5. La proposition est relue et corrigée dans l'interface, puis appliquée **au brouillon** uniquement.

## Menu client

- Rendu serveur dans la langue choisie (paramètre `lang`, sinon langue du navigateur, sinon langue du restaurant).
- `dir="rtl"` pour l'arabe. Les prix sont toujours formatés selon la langue du restaurant, chiffres latins.
- Une traduction n'est affichée que si son empreinte correspond au texte source actuel.
- `model-viewer` est chargé à la demande (préchargé dès la première interaction) ; les photos sont servies en `srcset` WebP.
- AR : `ar-modes="webxr scene-viewer quick-look"`, `ios-src` = USDZ ; sans USDZ, model-viewer convertit le GLB pour iOS.
  `ar-scale="fixed"` seulement si la taille réelle a été validée par un humain.
- Repli : navigateur intégré (Instagram, Facebook…) → invitation à ouvrir Safari/Chrome ; ordinateur → invitation à utiliser
  un téléphone ; appareil incompatible → visionneuse 3D.

## Sécurité

- Sessions : jeton aléatoire de 256 bits, seule son empreinte est stockée ; cookie `HttpOnly`, `SameSite=Lax`,
  `Secure` et préfixe `__Host-` en production ; expiration glissante de 14 jours.
- Mots de passe : bcrypt (coût 12), règles de robustesse ; limitation des tentatives par e-mail et par IP (empreinte HMAC).
- Contrôle d'origine sur toutes les requêtes modifiantes (défense CSRF en profondeur).
- **Isolation des restaurants** : chaque route d'administration passe par `requireRestaurantAccess`
  (`src/lib/auth/guards.ts`) ; chaque fichier ou plat référencé est vérifié comme appartenant au restaurant.
  Un accès refusé répond « introuvable » (pas de fuite d'existence).
- Rôles : `SUPER_ADMIN` (tout), membre `OWNER` (modifie et publie ses restaurants), membre `EDITOR` (modifie le brouillon).
- Fichiers : types autorisés en liste blanche (pas de SVG téléversé), tailles maximales, documents sources privés,
  clés de stockage non devinables, `X-Content-Type-Options: nosniff`.
- En-têtes : `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` (WebXR autorisé), HSTS, `noindex` sur l'administration.
- Statistiques : compteurs agrégés sans cookie ni IP ; respect de Global Privacy Control et Do Not Track.

## Montée en charge

- Le menu public lit une seule ligne indexée (instantané JSON) : facile à mettre en cache (CDN avec `s-maxage`,
  ou cache applicatif invalidé à la publication) si le trafic l'exige.
- Les fichiers 3D sont servis par le CDN du stockage S3, avec des clés immuables (cache d'un an).
- Les téléversements vont directement au stockage ; seul le traitement (optimisation, analyse) passe par le serveur.
  Pour de très gros volumes, ce traitement peut être déplacé dans une file de tâches (ex. pg-boss) sans changer l'API.
- L'application est sans état (sessions en base) : plusieurs instances peuvent tourner derrière un répartiteur de charge
  (avec `STORAGE_DRIVER=s3`).

## Limites connues

- L'échelle d'un USDZ n'est pas mesurable automatiquement (format binaire) : elle doit être vérifiée sur iPhone avant validation.
- La correction d'échelle automatique s'applique au GLB (un nouveau fichier est créé) ; le USDZ doit être réexporté à la même échelle.
- Les photos HEIC (iPhone) ne sont pas acceptées : les exporter en JPEG.
- Les polices des PDF imprimables couvrent l'alphabet latin ; un nom de restaurant en écriture non latine est filtré.
