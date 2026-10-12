# VoirAvantDeCommander

Plateforme de menus numériques **en 3D et en réalité augmentée** pour les restaurants :
le client scanne un QR code, découvre la carte dans sa langue, fait tourner chaque plat
du bout du doigt et le pose sur sa table, à taille réelle — sans installer d'application.

Le dépôt contient deux produits dans une seule application Next.js :

| Partie | Adresse | Rôle |
| --- | --- | --- |
| Site vitrine | `/` | Présentation, démonstration interactive, demande de démo, contact |
| Menu client | `/menu/{slug}` | Menu public mobile, 3D / AR, 9 langues, favoris, allergènes |
| Logiciel SaaS | `/admin` | Restaurants, import intelligent, éditeur de menu, traductions, QR codes, statistiques |

## Démarrage rapide (développement)

Prérequis : Node.js ≥ 20.19, PostgreSQL ≥ 14.

```bash
npm ci
cp .env.example .env            # puis compléter : APP_SECRET, DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma migrate deploy       # crée les tables
npm run db:seed                 # crée l'administrateur et le restaurant de démonstration (fictif)
npm run dev                     # http://localhost:3000
```

- Administration : http://localhost:3000/admin (identifiants `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Menu de démonstration : http://localhost:3000/menu/demo

`APP_SECRET` doit être une chaîne aléatoire d'au moins 32 caractères (`openssl rand -base64 48`).
Le mot de passe administrateur doit faire au moins 10 caractères et mélanger trois types de caractères.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run lint` · `npm run typecheck` | Qualité du code |
| `npm test` | Tests unitaires + intégration (base `TEST_DATABASE_URL`, par défaut `vadc_test`) |
| `npm run test:e2e` | Tests de bout en bout Playwright (desktop, iPhone, Android émulés) |
| `npm run db:seed` | Administrateur + restaurant de démonstration |
| `npm run admin:create -- email "mot de passe"` | Crée / réinitialise un administrateur principal |
| `npm run demo:models` | Régénère les modèles 3D de démonstration |
| `scripts/backup.sh` | Sauvegarde base + fichiers |

## Documentation

- [Architecture technique](docs/ARCHITECTURE.md) — choix, modèle de données, sécurité, montée en charge
- [Guide d'utilisation](docs/GUIDE.md) — du nouveau restaurant au QR code imprimé
- [Déploiement](docs/DEPLOIEMENT.md) — production, stockage S3, sauvegardes, checklist
- [Préparer les modèles 3D](docs/MODELES-3D.md) — formats, nommage, taille réelle, poids

## Fonctionnalités optionnelles

- **Traduction automatique** et **lecture IA des menus PDF scannés** : définir `ANTHROPIC_API_KEY`
  (modèle `claude-opus-5-5` par défaut, modifiable avec `ANTHROPIC_MODEL`) ou, pour la traduction seule,
  `DEEPL_API_KEY`. Sans clé, tout fonctionne avec la saisie manuelle et l'analyse heuristique intégrée.
- **Stockage S3** (Cloudflare R2, Scaleway, AWS…) : `STORAGE_DRIVER=s3` et variables `S3_*`.
