# LorIAx — Open Source

Suite collaborative type Notion/Obsidian, auto-hébergée, avec IA intégrée et collaboration temps réel.

> Édition open source publiée par **Dragamig SAS** sous licence MIT.
> Version : **1.21.0**.

## Sommaire

- [À propos](#à-propos)
- [Stack](#stack)
- [Fonctionnalités](#fonctionnalités)
- [Démarrage rapide](#démarrage-rapide)
- [Configuration](#configuration)
- [Différences avec l'édition privée](#différences-avec-lédition-privée)
- [Contribuer](#contribuer)
- [Licence](#licence)

## À propos

LorIAx est une application de gestion de connaissances et de productivité multi-utilisateurs construite pour les organismes qui veulent un Notion-like souverain : édition collaborative, recherche full-text, RAG IA multi-provider, calendrier CalDAV, visioconférence intégrée, et stockage objet auto-hébergé.

L'édition open source contient le cœur d'édition, l'éditeur TipTap riche, l'intégration IA multi-provider, l'authentification (NextAuth + LDAP), le calendrier, la visio LiveKit, le whiteboard collaboratif, et la collaboration temps réel via Yjs/Hocuspocus.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** strict
- **PostgreSQL 16** + pgvector + pg_trgm via **Drizzle ORM**
- **NextAuth v5** + LDAP
- **TipTap 3** (éditeur WYSIWYG) + **Yjs / Hocuspocus** (collab CRDT)
- **Tailwind CSS 4** + **shadcn/ui** (base-ui/react)
- **Vercel AI SDK** — multi-provider Claude / OpenAI / Mistral / Ollama
- **LiveKit** (visio) + **Whisper** (transcription)
- **S3-compatible** (Garage recommandé, fournisseur libre) pour le stockage objet

## Fonctionnalités

- Éditeur WYSIWYG markdown avec blocs riches (tables, mindmaps, whiteboards, charts, spreadsheets, calendriers embarqués)
- Espaces collaboratifs, documents versionnés (isomorphic-git)
- Recherche full-text (FTS PostgreSQL) + recherche sémantique (pgvector)
- IA contextuelle multi-provider avec quotas et logs d'usage
- Calendrier CalDAV + agenda + invitations
- Visio LiveKit avec transcription Whisper
- Whiteboard et mindmaps collaboratifs en temps réel
- Notifications, mentions, commentaires, partages publics
- Mode hors-ligne (Service Worker + IndexedDB)
- API REST publique versionnée + webhooks
- PWA installable

## Démarrage rapide

Prérequis : **Node.js >= 20**, **PostgreSQL 16** avec extensions `pgvector` et `pg_trgm`.

```bash
# 1. Cloner
git clone https://github.com/Flavien-Dragamig/lorIAx-oss.git
cd lorIAx-oss

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env.local
# éditer .env.local (DATABASE_URL, NEXTAUTH_SECRET, ...)

# 4. Initialiser la base
npm run db:fresh    # reset + migrations + seed démo

# 5. Lancer le serveur (Next.js + WebSocket)
npm run dev
```

Comptes de démo (via `db:seed`) :

- `admin@loriax.dev` / `admin123`
- `user@loriax.dev` / `user123`

## Configuration

Toutes les variables d'environnement sont documentées dans `.env.example`.

Variables principales :

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | URL PostgreSQL |
| `NEXTAUTH_SECRET` | Secret session NextAuth |
| `NEXTAUTH_URL` | URL publique de l'app |
| `S3_*` | Stockage objet (optionnel — filesystem par défaut) |
| `LIVEKIT_*` | Visio (optionnel) |
| Clés IA | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `OLLAMA_HOST` — configurables en runtime via l'admin |

## Différences avec l'édition privée

Cette édition open source ne contient **pas** les modules suivants (présents dans la version commerciale de Dragamig SAS) :

- Module **chat** d'équipe
- Module **tasks** (gestion de tâches, vue Gantt)
- **Studio vidéo / audio** (rendu vidéo, banques d'images)
- **Studio design** (Penpot intégré)
- **Réservation de salles** de réunion
- **Gestion d'espaces** côté UI (les espaces existent en base via API/seed, l'UI de création est retirée)

Le rôle `facility_manager` (administration des salles) est également retiré.

## Contribuer

Les contributions sont bienvenues — voir [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Bugs et propositions : [GitHub Issues](https://github.com/Flavien-Dragamig/lorIAx-oss/issues).

## Licence

[MIT](./LICENSE) © Dragamig SAS.

Voir [`NOTICE.md`](./NOTICE.md) pour les licences des dépendances tierces.
