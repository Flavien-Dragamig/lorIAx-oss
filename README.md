<div align="center">

# LorIAx

**Une suite collaborative type Notion/Obsidian, auto-hébergée, avec IA intégrée.**

Édition open source · Licence MIT · v1.21.0

[Fonctionnalités](#-fonctionnalités) · [Démarrage rapide](#-démarrage-rapide) · [Déploiement](#-déploiement) · [Configuration](#-configuration) · [Stack & crédits OSS](#-stack--crédits-oss) · [Contribuer](#-contribuer)

</div>

---

## 📖 À propos

LorIAx est une plateforme de **gestion de connaissances et de productivité collaborative**, conçue pour les organismes qui veulent un Notion-like **souverain** et **auto-hébergeable**, sans verrou cloud.

Le projet vise trois objectifs :

1. **Souveraineté** — tout tourne sur ton infrastructure : base, stockage objet, visio, IA locale.
2. **Polyvalence** — édition riche, calendrier, visio, whiteboard, mindmap, base de données, charts, le tout dans un seul outil cohérent.
3. **Frugalité** — peu de dépendances cloud propriétaires, des composants OSS éprouvés, un déploiement Docker Compose en une commande.

Cette **édition open source** est publiée par [Dragamig SAS](https://dragamig.fr) sous licence MIT. Une [édition commerciale](#différences-avec-lédition-commerciale) ajoute des modules métier (chat, tasks, studio vidéo, design, réservation de salles).

---

## ✨ Fonctionnalités

### 📝 Édition collaborative temps réel

- **Éditeur WYSIWYG markdown** propulsé par [TipTap](https://tiptap.dev) avec slash-commands, mentions `@`, wiki-links `[[doc]]`, callouts, tables, code highlighting.
- **Collaboration CRDT** via [Yjs](https://yjs.dev) + [Hocuspocus](https://tiptap.dev/hocuspocus) : édition simultanée, curseurs partagés, historique sans conflit.
- **Versioning Git natif** : chaque document est versionné via [isomorphic-git](https://isomorphic-git.org), historique navigable, diff visuel.
- **Mode hors-ligne** : Service Worker [Serwist](https://serwist.pages.dev) + IndexedDB, synchronisation différée.

### 🧩 Blocs riches

- **Whiteboard** infini avec [Excalidraw](https://excalidraw.com)
- **Mindmaps** avec [Mind Elixir](https://mind-elixir.com)
- **Spreadsheets** avec [Univer](https://univer.ai) (compatible Excel/CSV)
- **Charts** avec [Recharts](https://recharts.org)
- **Cartes** avec [Leaflet](https://leafletjs.com) + react-leaflet
- **Bases de données** style Notion (vues table, kanban, calendrier)
- **Calendriers embarqués** (CalDAV) directement dans un document
- **Visio inline** (LiveKit) + **réunions présentielles** avec captation audio

### 🤖 IA multi-provider

- **Chat contextuel** sur tes documents avec [Vercel AI SDK](https://sdk.vercel.ai)
- **Providers** : Anthropic Claude, OpenAI, Mistral, [Ollama](https://ollama.com) (local)
- **RAG** sémantique sur ta base via [pgvector](https://github.com/pgvector/pgvector)
- **Quotas** par utilisateur/organisation, logs d'usage, prompts personnalisables
- **Résumés**, traductions, génération de blocs depuis un prompt

### 🔗 Graphe de connaissances

- **Wiki-links** `[[document]]` automatiques avec backlinks
- **Visualisation D3** interactive du graphe documentaire
- **Recherche full-text** PostgreSQL (FTS + pg_trgm) + **recherche sémantique** pgvector

### 📅 Calendrier & visio

- **Serveur CalDAV** intégré, synchronisable avec Apple Calendar, Thunderbird, DAVx⁵
- **Visioconférence** [LiveKit](https://livekit.io) en self-host
- **Transcription** automatique via [Whisper](https://github.com/openai/whisper) ou [Voxtral](https://github.com/voxtral/voxtral) (CPU)
- Vues mois / semaine / jour / agenda, invitations, rappels

### 👥 Multi-tenants & accès

- **Authentification** [NextAuth v5](https://authjs.dev) : credentials, OAuth, magic links
- **LDAP** natif (ldapjs)
- **RBAC** : super_admin, admin, editor, viewer
- **Multi-organisations** avec permissions par espace
- **Partages publics** révocables avec expiration

### 🗄️ Stockage & infrastructure

- **PostgreSQL 16** + extensions pgvector + pg_trgm
- **S3 compatible** : [Garage](https://garagehq.deuxfleurs.fr) recommandé (auto-hébergé, FR), ou MinIO, AWS S3, Backblaze B2, etc.
- **Mode filesystem** pour les petites installations
- **Sauvegardes** automatiques planifiées via croner
- **Webhooks** sortants pour intégration avec n'importe quel système

### 📱 PWA

Installable comme app native (Android, iOS, desktop), avec push notifications, badge d'icône, et plein-écran.

---

## 🚀 Démarrage rapide

### Prérequis

- **Node.js ≥ 20** ([nvm](https://github.com/nvm-sh/nvm) recommandé — un fichier `.nvmrc` est fourni)
- **PostgreSQL 16** avec extensions `pgvector` et `pg_trgm` activées
- (optionnel) **Docker** ≥ 24 + Docker Compose v2 si tu utilises le mode tout-en-un

### Installation locale (Node only)

```bash
# 1. Cloner
git clone https://github.com/Flavien-Dragamig/lorIAx-oss.git
cd lorIAx-oss

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local : a minima DATABASE_URL et NEXTAUTH_SECRET

# 4. Initialiser la base (migrations + comptes de démo + templates)
npm run db:fresh

# 5. Lancer le serveur (Next.js + WebSocket collaboration)
npm run dev
```

L'app est accessible sur **http://localhost:3000**.

**Comptes de démo** (créés par `db:seed`) :

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| `admin@loriax.dev` | `admin123` | super_admin |
| `user@loriax.dev` | `user123` | editor |

⚠ **Changer ces mots de passe avant tout déploiement public.**

---

## 🐳 Déploiement

### Option A — Docker Compose (recommandé pour démarrer)

Le fichier `docker-compose.yml` à la racine embarque **tous les services nécessaires** : app, PostgreSQL (avec pgvector), Garage (S3), Ollama (IA locale), backup planifié.

```bash
cp .env.example .env.local
# Éditer .env.local : NEXTAUTH_SECRET, POSTGRES_PASSWORD, etc.

docker compose up -d
```

Variantes fournies :

| Fichier | Usage |
|---------|-------|
| `docker-compose.yml` | Dev local tout-en-un |
| `docker-compose.prod.yml` | Production avec Traefik, healthchecks renforcés |
| `docker-compose.livekit.yml` | Ajout du stack LiveKit (visio) |
| `docker-compose.registry.yml` | Pull depuis un registry privé (GHCR) |
| `docker/docker-compose.dev.yml` | Stack de dépendances uniquement (BDD + S3, sans app) |

### Option B — Reverse proxy + Node directement

Idéal pour un VPS avec [Caddy](https://caddyserver.com), [Traefik](https://traefik.io) ou [Nginx](https://nginx.org).

```bash
# Build production
npm run build

# Démarrer en production (Next.js + WebSocket sur le port défini)
npm start
```

Faire pointer le reverse proxy vers `localhost:3000`. Activer le **WebSocket upgrade** sur les chemins `/ws/collab`. Exemple Caddy :

```caddyfile
loriax.example.com {
    reverse_proxy localhost:3000
}
```

### Option C — PaaS Self-host (Dokploy, Coolify, Easypanel)

Le `Dockerfile` à la racine est compatible avec [Dokploy](https://dokploy.com), [Coolify](https://coolify.io), [Easypanel](https://easypanel.io). Configurer :

- **Build** : Dockerfile
- **Port exposé** : `3000`
- **Variables** : voir `.env.example`
- **Volumes** : `/app/workspaces` (documents), `/app/migrations` (déjà bundlés)
- **Healthcheck** : `GET /api/health`

### Migrations en production

Les migrations Drizzle sont **exécutées automatiquement au démarrage** par `server.ts`. Pour forcer manuellement :

```bash
npm run db:migrate
```

### Sauvegardes

Le service `backup` du docker-compose effectue un `pg_dump` quotidien + snapshot S3 dans un volume dédié. Configurable via :

```
BACKUP_SCHEDULE=0 3 * * *
BACKUP_RETENTION_DAYS=14
```

---

## 🔧 Configuration

Toutes les variables d'environnement sont documentées **dans `.env.example`** avec leurs valeurs par défaut et leur caractère `[REQUIRED]` / `[OPTIONAL]`.

### Variables essentielles

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL (pgvector + pg_trgm requis) |
| `NEXTAUTH_SECRET` | Secret de signature des sessions (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL publique pour les redirections OAuth |
| `NEXT_PUBLIC_APP_URL` | URL publique (emails, webhooks, QR codes) |

### Stockage objet (optionnel)

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT` | Endpoint S3 (Garage, MinIO, AWS, …) |
| `S3_BUCKET` | Bucket cible |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Credentials |

Sans S3 configuré, LorIAx bascule sur le filesystem (`WORKSPACES_PATH`).

### IA (optionnel)

Les clés peuvent être définies **en variables d'env** ou **en runtime via l'admin** (chiffrées en base) :

| Variable | Provider |
|----------|----------|
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | OpenAI |
| `MISTRAL_API_KEY` | Mistral |
| `OLLAMA_HOST` | Ollama local (ex: `http://ollama:11434`) |

### Visio LiveKit (optionnel)

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | WebSocket LiveKit (`wss://livekit.example.com`) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Credentials serveur |

### LDAP (optionnel)

| Variable | Description |
|----------|-------------|
| `LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_CREDENTIALS`, `LDAP_SEARCH_BASE` | Connexion annuaire |

---

## 🛠️ Stack & crédits OSS

LorIAx n'existerait pas sans la communauté open source. Voici les briques principales et leurs auteurs.

### Cœur applicatif

- **[Next.js 16](https://nextjs.org)** (Vercel) — framework React/serveur
- **[React 19](https://react.dev)** (Meta) — UI
- **[TypeScript](https://www.typescriptlang.org)** (Microsoft) — typage statique
- **[Tailwind CSS 4](https://tailwindcss.com)** + **[shadcn/ui](https://ui.shadcn.com)** + **[@base-ui/react](https://base-ui.com)** — design system
- **[Drizzle ORM](https://orm.drizzle.team)** + **drizzle-kit** — ORM SQL typé
- **[PostgreSQL](https://www.postgresql.org)** + **[pgvector](https://github.com/pgvector/pgvector)** (Andrew Kane) + **pg_trgm**
- **[NextAuth v5](https://authjs.dev)** — authentification
- **[Zod](https://zod.dev)** (Colin McDonnell) — validation runtime

### Édition & collaboration

- **[TipTap](https://tiptap.dev)** — éditeur WYSIWYG headless
- **[Yjs](https://yjs.dev)** (Kevin Jahns) — CRDT temps réel
- **[Hocuspocus](https://tiptap.dev/hocuspocus)** — serveur de collaboration Yjs
- **[Excalidraw](https://excalidraw.com)** — whiteboard
- **[Mind Elixir](https://mind-elixir.com)** — mindmap
- **[Univer](https://univer.ai)** — tableur compatible Excel
- **[Recharts](https://recharts.org)** — visualisations de données
- **[Leaflet](https://leafletjs.com)** + **react-leaflet** — cartes
- **[lowlight](https://github.com/wooorm/lowlight)** + **[highlight.js](https://highlightjs.org)** — coloration syntaxique

### IA & media

- **[Vercel AI SDK](https://sdk.vercel.ai)** — abstraction multi-provider
- **[Ollama](https://ollama.com)** — LLM locaux
- **[LiveKit](https://livekit.io)** — visioconférence WebRTC
- **[Whisper](https://github.com/openai/whisper)** (OpenAI) / **[Voxtral](https://github.com/voxtral/voxtral)** — transcription audio
- **[FFmpeg](https://ffmpeg.org)** + **[Sharp](https://sharp.pixelplumbing.com)** (Lovell Fuller) — média

### Infrastructure & stockage

- **[Garage](https://garagehq.deuxfleurs.fr)** ([Deuxfleurs](https://deuxfleurs.fr), AGPL-3.0) — stockage objet S3 distribué auto-hébergé recommandé
- **[isomorphic-git](https://isomorphic-git.org)** — Git en pur JavaScript
- **[Serwist](https://serwist.pages.dev)** — Service Worker
- **[ioredis](https://github.com/redis/ioredis)** — client Redis
- **[croner](https://github.com/Hexagon/croner)** — scheduler
- **[pino](https://getpino.io)** — logger structuré

### Auth & sécurité

- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)**, **[jose](https://github.com/panva/jose)** (Filip Skokan), **[ldapjs](http://ldapjs.org)**

### Icônes & UX

- **[Lucide](https://lucide.dev)** — iconographie
- **[Sonner](https://sonner.emilkowal.ski)** (Emil Kowalski) — toasts
- **[cmdk](https://cmdk.paco.me)** (Paco Coursey) — command palette
- **[@dnd-kit](https://dndkit.com)** (Claudéric Demers) — drag & drop

La liste complète des dépendances et leurs licences est consultable dans [`NOTICE.md`](./NOTICE.md) et `package.json`.

---

## 🔀 Différences avec l'édition commerciale

Cette édition open source ne contient **pas** les modules suivants, réservés à l'édition commerciale de [Dragamig SAS](https://dragamig.fr) :

- **Chat** d'équipe (canaux, DM, digest)
- **Tasks** & vue Gantt
- **Studio vidéo / audio** (rendu vidéo, banques d'images intégrées)
- **Studio design** ([Penpot](https://penpot.app) embarqué)
- **Réservation de salles** de réunion (et rôle `facility_manager`)
- **UI de gestion d'espaces** (le modèle de données est conservé, l'UI de création/admin est retirée)

Si tu as besoin de ces modules ou d'un support entreprise, contacte `contact@dragamig.fr`.

---

## 🤝 Contribuer

Les contributions sont bienvenues. Lire [`CONTRIBUTING.md`](./CONTRIBUTING.md) pour les conventions (Conventional Commits, TypeScript strict, frugalité).

Bugs et propositions : [GitHub Issues](https://github.com/Flavien-Dragamig/lorIAx-oss/issues).

---

## 📜 Licence

[MIT](./LICENSE) © 2026 [Dragamig SAS](https://dragamig.fr).

Voir [`NOTICE.md`](./NOTICE.md) pour les licences des dépendances tierces.

> **Mention IA** : ce projet a été préparé pour publication open source par **Studio Dragamig avec l'aide de Claude d'Anthropic**.
