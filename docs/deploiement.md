# Déploiement — LorIAx

## Prérequis

- Docker et Docker Compose
- Node.js 22+ (pour le développement)

## Développement local (méthode rapide)

```bash
cd loriax-app
npm run dev:full
```

Ce script unique fait tout :
1. Vérifie les pré-requis (docker, node, npm)
2. Crée `.env.local` depuis `.env.example` (avec NEXTAUTH_SECRET auto-généré)
3. Crée le dossier `workspaces/`
4. Installe les dépendances npm
5. Démarre PostgreSQL + Garage S3 via Docker
6. Applique le schéma BDD (drizzle push)
7. Seed les utilisateurs de dev (admin + user)
8. Lance le serveur Next.js sur http://localhost:3000

### Comptes de dev

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin (super_admin) | admin@loriax.dev | admin123 |
| User (editor) | user@loriax.dev | user123 |

Les credentials sont affichés sur la page de login en mode dev (clic pour remplir).

### Arrêt

```bash
npm run dev:stop    # Arrêt des services Docker
# ou Ctrl+C pour le serveur Next.js seul
```

## Développement local (méthode manuelle)

```bash
# 1. Copier la configuration
cp .env.example .env.local
# Éditer NEXTAUTH_SECRET avec une valeur aléatoire

# 2. Installer les dépendances
npm install

# 3. Lancer PostgreSQL + Garage S3
docker compose up postgres garage garage-init -d

# 4. Appliquer le schéma
npm run db:push

# 5. Seeder les utilisateurs
npm run db:seed

# 6. Lancer l'app
npm run dev
```

## Production (Docker Compose)

```bash
# 1. Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec les valeurs de production :
# - NEXTAUTH_SECRET (générer avec `openssl rand -base64 32`)
# - ENCRYPTION_KEY (générer avec `openssl rand -base64 32`)
# - Clés API IA (ANTHROPIC_API_KEY, OPENAI_API_KEY)
# - Credentials S3 sécurisés
# - Credentials PostgreSQL sécurisés

# 2. Lancer tous les services
docker compose up -d

# 3. Vérifier les logs
docker compose logs -f
```

### Checklist sécurité production

- [ ] `NEXTAUTH_SECRET` : valeur aléatoire unique (pas la valeur par défaut)
- [ ] `ENCRYPTION_KEY` : 32 octets base64 (`openssl rand -base64 32`)
- [ ] Changer les mots de passe PostgreSQL et S3 dans docker-compose
- [ ] Configurer HTTPS (reverse proxy nginx/Traefik avec Let's Encrypt)
- [ ] Le port PostgreSQL (5432) n'est pas exposé (seulement réseau Docker interne)
- [ ] Vérifier les headers de sécurité : `curl -I https://votre-domaine.fr`

## Migrations

### Sprint 51 — Audit sécurité et performance (mars 2026)

Trois migrations sont nécessaires après la mise à jour du code. Elles sont idempotentes (ré-exécutables sans risque).

#### 1. Schéma BDD (audit_logs + tokenInvalidatedAt)

Ajoute la table `audit_logs` (journal d'audit admin) et la colonne `token_invalidated_at` sur `users` (invalidation des tokens WebSocket après changement de mot de passe ou de rôle).

```bash
# Via Docker (recommandé en production)
docker compose exec -T postgres psql -U loriax -d loriax -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_invalidated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  details JSONB,
  ip VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
"

# Alternative via drizzle-kit (dev local)
DATABASE_URL=postgresql://loriax:loriax_secret@localhost:5432/loriax npx drizzle-kit push
```

#### 2. Chiffrement des secrets existants

Chiffre les identifiants LDAP, SMTP et Resend déjà stockés en clair dans `system_settings`. N'a aucun effet si aucun secret n'est configuré ou s'ils sont déjà chiffrés.

**Prérequis** : `ENCRYPTION_KEY` définie (32 octets base64, la même que dans `.env`).

```bash
# Avec les variables d'environnement explicites
DATABASE_URL=postgresql://... ENCRYPTION_KEY=... npx tsx scripts/migrate-encrypt-secrets.ts

# Ou en production via docker exec
docker compose exec app node scripts/migrate-encrypt-secrets.js
```

#### 3. Index trigram pour la recherche courte

Accélère les recherches de moins de 4 caractères (qui utilisent `ILIKE` au lieu du full-text search). Utilise `CREATE INDEX CONCURRENTLY` — pas de verrouillage de table.

```bash
# Via Docker
docker compose exec -T postgres psql -U loriax -d loriax < scripts/migrate-trigram.sql

# Ou manuellement
psql $DATABASE_URL -f scripts/migrate-trigram.sql
```

### Nouvelles variables d'environnement (optionnelles)

| Variable | Défaut | Description |
|----------|--------|-------------|
| `TRUSTED_PROXY_COUNT` | `1` | Nombre de proxys de confiance devant l'app (pour le rate limiting) |
| `REDIS_URL` | — | URL Redis/Valkey pour le rate limiting multi-instance (ex: `redis://valkey:6379`) |
| `UNSPLASH_ACCESS_KEY` | — | Clé d'accès Unsplash (optionnel) — active l'onglet Unsplash dans le panneau Images du Studio. Obtenir sur [unsplash.com/developers](https://unsplash.com/developers). |

---

## Services

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Application Next.js |
| pgbouncer | 6432 | Connection pooling PostgreSQL (prod uniquement) |
| postgres | 5432 | Base de données PostgreSQL 16 + pgvector |
| garage | 3900 | Stockage objet S3-compatible (Garage by Deuxfleurs) |
| penpot-frontend | 9001 | Interface web Penpot (optionnel) |
| penpot-backend | interne | API RPC Penpot (optionnel) |
| penpot-exporter | interne | Export PDF/SVG/PNG (optionnel) |
| penpot-valkey | interne | Cache Redis-compatible (optionnel) |
| livekit | 7880 | Serveur SFU WebRTC LiveKit (optionnel) |
| livekit-egress | interne | Enregistrement audio/vidéo (optionnel) |

### Drizzle Studio

```bash
npm run db:studio    # Interface web d'exploration de la BDD
```

## Scripts npm disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur Next.js seul |
| `npm run dev:full` | Tout lancer (Docker + BDD + seed + Next.js) |
| `npm run dev:stop` | Arrêter les services Docker |
| `npm run build` | Build production |
| `npm run db:push` | Appliquer le schéma à la BDD |
| `npm run db:generate` | Générer une migration SQL |
| `npm run db:studio` | Interface Drizzle Studio |
| `npm run db:seed` | Seeder les utilisateurs de dev |
| `npm run lint` | ESLint |
| `npm run test` | Tests unitaires (vitest) |

## Healthcheck

L'application expose un endpoint `/api/health` qui vérifie la connectivité PostgreSQL et le stockage S3 :

```bash
curl http://localhost:3000/api/health
# {"status":"healthy","timestamp":"...","version":"...","checks":{"database":{"status":"ok","latency":3},"storage":{"status":"ok","latency":5}}}
```

- **200** : tous les services sont opérationnels
- **503** : un ou plusieurs services sont dégradés

Le Dockerfile inclut un `HEALTHCHECK` qui interroge cet endpoint toutes les 30s.

## CI/CD (GitHub Actions)

Le workflow `.github/workflows/ci.yml` exécute automatiquement :

1. **Sur chaque PR** : lint (ESLint) + typecheck (tsc) + build Next.js
2. **Sur merge main** : build de l'image Docker (avec cache GitHub Actions)

## Backup

### Automatique (recommandé)

Le service `backup` dans `docker-compose.yml` effectue un `pg_dump` quotidien à 2h du matin avec rétention de 7 jours. Les dumps sont stockés dans le volume `backup_data`.

```bash
# Voir les backups disponibles
docker compose exec backup ls -la /backups/

# Restaurer un backup
docker compose exec -i postgres pg_restore -U loriax -d loriax < backup.dump
```

### Manuel

```bash
# Base de données
docker compose exec postgres pg_dump -U loriax -Fc loriax > backup.dump

# Fichiers stockage S3 (Garage)
# Utiliser rclone ou un client S3 compatible pour copier le bucket
# rclone sync garage:loriax-files ./backup-files/

# Workspaces (repos git des documents)
tar -czf workspaces-backup.tar.gz workspaces/
```

## Penpot — Tableau blanc et prototypage (optionnel)

L'intégration Penpot est activée via un overlay Docker Compose séparé.

### Activation

```bash
# 1. Configurer les variables d'environnement
cat >> .env.local << 'EOF'
PENPOT_INTERNAL_URL=http://penpot-backend:6060
PENPOT_SECRET_KEY=$(openssl rand -hex 32)
EOF

# 2. Lancer avec l'overlay Penpot
docker compose -f docker-compose.yml -f docker-compose.penpot.yml up -d
```

### Désactivation

Ne pas utiliser l'overlay — les blocs existants restent consultables en lecture seule (miniatures PNG/SVG).

### Variables d'environnement Penpot

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PENPOT_INTERNAL_URL` | — | URL interne du backend Penpot (vide = désactivé) |
| `PENPOT_SECRET_KEY` | — | Mot de passe du compte service `loriax-system@local` |
| `PENPOT_PUBLIC_URI` | `http://localhost:9002` | URI publique de Penpot exposée dans le navigateur — utilisée pour construire les URLs de téléchargement des assets (définie dans `docker-compose.penpot.yml`) |

## LiveKit + Whisper — Visioconférence (optionnel)

L'intégration visioconférence est activée via un override Docker Compose séparé.

### Activation

```bash
# 1. Configurer les variables d'environnement
cat >> .env.local << 'EOF'
LIVEKIT_ENABLED=true
LIVEKIT_URL=ws://livekit:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
WHISPER_ENABLED=true
WHISPER_DIARIZE=true
EOF

# 2. Lancer avec l'overlay LiveKit
docker compose -f docker-compose.yml -f docker-compose.livekit.yml up -d

# 3. Avec Whisper (optionnel)
docker compose -f docker-compose.yml -f docker-compose.livekit.yml --profile whisper up -d
```

### Services déployés

| Service | Port | Rôle |
|---------|------|------|
| livekit | 7880, 7881, 7882/udp | Serveur SFU WebRTC (LiveKit) |
| livekit-egress | interne | Enregistrement audio/vidéo |
| whisper | interne | Transcription audio (WhisperX, profil optionnel) |

### Diarization (identification des locuteurs)

Pour activer la diarization via pyannote.audio :

1. Créer un compte sur [huggingface.co](https://huggingface.co)
2. Accepter la licence du modèle [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
3. Générer un token : [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
4. Ajouter dans `.env.local` : `HF_TOKEN=hf_...`

### Variables d'environnement LiveKit/Whisper

| Variable | Défaut | Description |
|----------|--------|-------------|
| `LIVEKIT_ENABLED` | `false` | Activer l'intégration visioconférence |
| `LIVEKIT_URL` | `ws://localhost:7880` | URL WebSocket du serveur LiveKit |
| `LIVEKIT_API_KEY` | — | Clé API LiveKit |
| `LIVEKIT_API_SECRET` | — | Secret API LiveKit |
| `LIVEKIT_EGRESS_PATH` | `/recordings` | Répertoire des enregistrements Egress |
| `WHISPER_ENABLED` | `false` | Activer la transcription |
| `WHISPER_API_URL` | `http://localhost:9000` | URL du service Whisper |
| `WHISPER_MODEL` | `base` | Modèle Whisper (tiny/base/small/medium/large) |
| `WHISPER_LANGUAGE` | `fr` | Langue par défaut |
| `WHISPER_DIARIZE` | `false` | Identification des locuteurs |
| `HF_TOKEN` | — | Token HuggingFace (requis pour la diarization) |

> **Note** — La version open-source de LorIAx fonctionne sans gestion de licences. Un service propriétaire optionnel (gestion de licences commerciales + Stripe) existe côté Dragamig SAS pour le SaaS hébergé ; il n'est pas distribué dans ce dépôt. Les hooks de facturation dans le code (`src/lib/billing/*`) sont inactifs sans ce service.

## Vérification des migrations au démarrage (dev)

En mode développement, `loriax-app` vérifie automatiquement l'existence des tables requises au démarrage via `src/instrumentation.ts`. Si des tables sont manquantes, un avertissement est affiché dans la console :

```
[migrations] Tables manquantes : templates, system_settings. Lancez : npm run db:migrate
```

Ce mécanisme est silencieux si la BDD est inaccessible (par exemple avant que Docker soit démarré).

---

## Structure du repo

```
lorIAx-oss/                 # Application Next.js (ce dépôt)
├── src/
├── public/
├── scripts/
├── docker/
├── docs/
└── …
```
