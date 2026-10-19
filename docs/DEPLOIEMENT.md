# Déploiement en production

## Option A — Serveur unique (VPS) avec Docker

Adaptée au démarrage (quelques dizaines de restaurants). Hébergeurs en France : Scaleway, OVHcloud, Clever Cloud…

```bash
git clone … && cd VoirAvantDeCommander
cp .env.example .env
# Compléter .env : APP_URL=https://voiravantdecommander.fr, APP_SECRET (openssl rand -base64 48),
# POSTGRES_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD, et éventuellement S3_* / ANTHROPIC_API_KEY.
docker compose up -d db
docker compose --profile tools run --rm migrate
docker compose up -d app
# Premier administrateur :
docker compose --profile tools run --rm migrate npx tsx --conditions=react-server scripts/create-admin.ts admin@exemple.fr "Mot-De-Passe-Solide-1"
```

Placez un reverse proxy HTTPS devant le port 3000 (Caddy, Nginx, Traefik). Exemple Caddy :

```
voiravantdecommander.fr {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

L'HTTPS est **obligatoire** : la réalité augmentée (WebXR, Scene Viewer) et les cookies sécurisés l'exigent.

## Option B — Plateforme gérée

- Application : Vercel ou tout hébergeur Node.js (`npm run build` puis `npm start`).
- Base : PostgreSQL managé (Neon, Supabase, Scaleway, AWS RDS…). Appliquer `npx prisma migrate deploy` à chaque déploiement.
- Fichiers : **obligatoirement S3** (`STORAGE_DRIVER=s3`), le disque des plateformes serverless n'est pas persistant.
- Vercel : le script `vercel-build` applique les migrations et installe les démos à chaque déploiement.
  Réglages à vérifier :
  - **Settings → Environments → Production → Branch Tracking** = `main` (sinon les déploiements de `main`
    restent des « Preview » et le nom de domaine garde l'ancienne version) ;
  - **Settings → Git** : dépôt connecté, et application GitHub Vercel autorisée sur ce dépôt
    (sinon les nouveaux commits ne déclenchent aucun déploiement).

## Stockage S3 (recommandé dès que possible)

Cloudflare R2 (sans frais de bande passante sortante, idéal pour les modèles 3D) ou Scaleway Object Storage (France).

1. Créer un bucket, une clé d'accès limitée à ce bucket.
2. Rendre publics en lecture les fichiers **publics** uniquement : `restaurants/*/public/*`
   (les documents sources des imports sont sous `restaurants/*/private/*` et ne doivent pas être publics).
3. Brancher un domaine CDN (ex. `cdn.voiravantdecommander.fr`) → `S3_PUBLIC_URL`.
4. Configurer le CORS du bucket pour les téléversements directs depuis l'administration :

```json
[{ "AllowedOrigins": ["https://voiravantdecommander.fr"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["Content-Type", "Cache-Control"], "MaxAgeSeconds": 3600 }]
```

5. Vérifier que les `.usdz` sont servis en `model/vnd.usdz+zip` (le type est fixé au téléversement).

## Sauvegardes

- Base : `scripts/backup.sh` (pg_dump + archive du stockage local, rotation 30 jours), à planifier chaque nuit,
  **et** copier les sauvegardes hors du serveur. Les bases managées proposent aussi des sauvegardes automatiques.
- Fichiers S3 : activer le versionnage du bucket ou une réplication.
- Tester une restauration au moins une fois : `pg_restore --clean --no-owner --dbname="$DATABASE_URL" db-….dump`.

## Checklist avant ouverture

- [ ] `APP_URL` définitive (elle est encodée dans les QR codes : ne plus la changer ensuite)
- [ ] `APP_SECRET` long et aléatoire, jamais commité
- [ ] HTTPS actif, redirection HTTP → HTTPS
- [ ] Mot de passe administrateur robuste, comptes inutiles désactivés
- [ ] Stockage S3 + CDN configurés, CORS testé (import d'un fichier depuis l'administration)
- [ ] Sauvegardes planifiées et restauration testée
- [ ] Mentions légales et politique de confidentialité complétées (passages « À compléter »)
- [ ] Test réel de la réalité augmentée sur un iPhone (Safari) et un Android (Chrome)
- [ ] Sonde de santé surveillée : `GET /api/health`

## Mises à jour

```bash
git pull
docker compose build app migrate
docker compose --profile tools run --rm migrate
docker compose up -d app
```
