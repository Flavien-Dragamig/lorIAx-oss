# Architecture — LorIAx

## Vue d'ensemble

LorIAx est une application de gestion de connaissances auto-hébergée pour organismes multi-services.

## Stack technique

| Composant | Choix | Justification |
|-----------|-------|---------------|
| Frontend | Next.js 16 + React 19 (App Router) | SSR, Turbopack, écosystème riche |
| UI | shadcn/ui + Tailwind CSS 4 + Radix | Composants accessibles, thémables |
| Éditeur | TipTap (ProseMirror) | WYSIWYG extensible, slash commands |
| BDD | PostgreSQL 16 + pgvector | FTS français, vector search |
| ORM | Drizzle ORM | Type-safe, migrations SQL |
| Auth | NextAuth.js v5 | Multi-provider, RBAC |
| Stockage fichiers | Garage (S3-compatible, Deuxfleurs FR) | Object storage auto-hébergé souverain |
| Stockage docs | Filesystem + Git | Markdown portable, versionné |
| Git | isomorphic-git | Pure JS, pas de dépendance système |
| IA | Vercel AI SDK | Streaming unifié, multi-provider |
| Graph | D3.js (d3-force) | Force-directed, interactif |
| Canvas | Penpot 2.4 (Docker) | Whiteboard + prototypage, auto-hébergé (AGPL-3.0) |
| Logging | Pino | JSON structuré, léger, compatible standalone |
| Import Excel | exceljs | Lecture XLSX/XLS/ODS, alternative sûre à xlsx |
| Rate limit | ioredis (optionnel) | Redis/Valkey backend pour multi-instance |
| Connection pool | PgBouncer | Transaction pooling en production |
| Cron scheduler | croner | Planification légère (0 dépendance, <10 Ko) |
| Virtualisation | @tanstack/react-virtual | Grandes listes sans DOM bloat |
| Déploiement | Docker Compose | Tout-en-un |

### ADR-022 : Migration MinIO → Garage (mars 2026)
- **Contexte** : MinIO Community Edition archivée le 13/02/2026 — plus de mises à jour, renvoi vers AIStor propriétaire
- **Choix** : Garage (https://garagehq.deuxfleurs.fr/) — stockage objet S3-compatible développé par l'association française Deuxfleurs (AGPL-3.0)
- **Raisons** : licence libre pérenne, éditeur européen (français), léger (un seul binaire), distribué, S3 compatible
- **Impact** : aucun changement de code applicatif — LorIAx utilisait déjà AWS SDK v3 (pas minio-js). Seuls les noms de variables d'env (`MINIO_*` → `S3_*`), le fichier client (`minio.ts` → `s3.ts`), et les services Docker ont été modifiés
- **Alternatives écartées** : SeaweedFS (plus complexe), Ceph (surdimensionné), RustFS (trop jeune), AWS S3 (pas auto-hébergé)

## Décisions d'architecture (ADR)

### ADR-001 : Stockage hybride filesystem + BDD
- Markdown sur filesystem (git-backed) pour la portabilité
- Métadonnées en PostgreSQL pour les requêtes rapides
- L'API est le seul point d'écriture

### ADR-002 : TipTap JSON <-> Markdown
- TipTap JSON = format d'édition (WYSIWYG)
- Markdown = format de stockage (git-diffable)
- Conversion bidirectionnelle via tiptap-markdown

### ADR-003 : pgvector pour les embeddings
- Pas de vector DB séparé
- HNSW index, dimension 1536
- Suffisant pour 20-100 utilisateurs

### ADR-004 : isomorphic-git
- Pas de dépendance système
- Opérations : init, add, commit, log, show
- Acceptable pour des documents texte

### ADR-005 : Locking pessimiste (V1)
- Un éditeur par document à la fois
- Lock expire après 15 min d'inactivité
- V2 : Yjs + @tiptap/extension-collaboration

### ADR-006 : Apparence personnalisable (CSS-first)
- Variables CSS custom (`--loriax-accent-light/dark`, `--loriax-editor-bg-light/dark`, etc.)
- Variantes light ET dark posées par JS, bascule automatique via sélecteurs CSS `:root` / `.dark`
- Persistance JSONB dans `users.themePreferences` + cache `localStorage` pour chargement instantané
- `AppearanceProvider` dans le tree React (sync API au montage)
- Presets : 3 prédéfinis + CRUD presets personnalisés (stockés dans le même JSONB)

### ADR-007 : Slash commands avec alias
- Chaque commande slash peut déclarer un tableau `aliases` (ex : `["t1", "h1", "heading1"]`)
- La recherche filtre sur `title`, `description` et `aliases`
- Permet des raccourcis intuitifs sans polluer les titres affichés

### ADR-008 : Sécurité et contrôle d'accès (mars 2026)

Suite à un audit sécurité complet, les mesures suivantes ont été implémentées :

**Autorisation (IDOR)**
- Tous les endpoints documents vérifient les permissions via `checkDocumentViewAccess` / `checkDocumentEditAccess` (`src/lib/auth/check-access.ts`)
- Search, recent, graph filtrent par espaces accessibles (`getAccessibleSpaceIds`)
- Le RBAC existant (`src/lib/auth/rbac.ts`) est utilisé comme socle

**Chiffrement**
- Les clés API des providers IA sont chiffrées en AES-256-GCM (`src/lib/crypto.ts`)
- Variable d'environnement `ENCRYPTION_KEY` requise (base64, 32 octets)

**Rate limiting**
- Protection contre le brute force sur l'inscription (`src/lib/rate-limit.ts`)
- Présets configurés : auth (10/15min), search (60/min), AI (20/min)

**Headers de sécurité**
- X-Frame-Options: DENY, X-Content-Type-Options: nosniff
- Referrer-Policy, Permissions-Policy configurés dans `next.config.ts`

**Validation des uploads**
- Whitelist d'extensions autorisées
- Limite de taille à 50 Mo côté application

**Session**
- JWT 7 jours (réduit depuis 30)
- Emails normalisés en minuscules

**Infrastructure**
- Port PostgreSQL non exposé en production (docker-compose.yml)

### ADR-010 : Email multi-provider (SMTP + Resend)
- Abstraction dans `src/lib/email/provider.ts` : dispatch transparent SMTP ou Resend
- Configuration stockée sous la clé `"email"` dans `systemSettings` (JSONB)
- Rétrocompatibilité automatique avec l'ancienne clé `"smtp"` (migration transparente)
- SMTP : cache du transporter nodemailer, invalidé quand la config change
- Resend : SDK officiel `resend`, vérification via `domains.list()`, envoi via `emails.send()`
- L'UI admin permet de choisir le provider (boutons radio) et de tester la connexion
- Routes de test séparées : `/api/admin/settings/smtp-test` et `/api/admin/settings/resend-test`

### ADR-009 : Notifications in-app (polling)
- Table `notifications` avec enum type (`mention`, `comment`, `reply`, `share`)
- Index composite `(user_id, read)` pour les requêtes fréquentes de comptage non-lus
- Déclencheurs côté serveur (dans les API routes) plutôt que triggers BDD — plus maintenable
- Anti-auto-notification : le helper `createNotification` ignore `userId === actorId`
- Polling côté client (30s) — suffisant pour la V2.0, prêt pour SSE/WebSocket en V2.1
- Navigation : l'API retourne le `spaceSlug` via un JOIN pour éviter une route de redirection

### ADR-011 : Content-Security-Policy (CSP)
- CSP ajouté dans `next.config.ts` via `headers()`
- `unsafe-inline` nécessaire pour `style-src` (TipTap, Recharts, D3 injectent des styles inline)
- `unsafe-eval` autorisé pour `script-src` (requis par certaines libs en dev et en production)
- Sources images : `self`, `data:`, `blob:`, MinIO
- Sources connect : `self`, `ws:`, `wss:` (WebSocket collaboration), MinIO
- `frame-src`, `object-src`, `frame-ancestors` : `none` (protection clickjacking)

### ADR-012 : Émojis (emoji-picker-react)
- Lib `emoji-picker-react` (v4, léger, natif React, thème auto dark/light)
- Composant réutilisable `EmojiPickerPopover` — popover avec 3 tailles (sm/md/lg), clearable
- Émojis natifs du navigateur (`EmojiStyle.NATIVE`) plutôt que sprites — pas de téléchargement supplémentaire
- Champ `icon` (varchar 50) sur `spaces` (existant) et `documents` (ajouté)
- Slash command `/emoji` : import dynamique du picker pour ne pas alourdir le bundle éditeur
- Approche additive : si aucun émoji défini, les icônes Lucide par défaut sont conservées

### ADR-013 : Bases de données utilisateur (Notion-style)
- Tables `user_databases`, `user_database_columns`, `user_database_rows` dans le schéma Drizzle
- Colonnes typées (`text`, `number`, `date`, `select`, `checkbox`, `relation`) via enum PostgreSQL
- Cellules stockées en JSONB (`cells` dans `user_database_rows`) — clé = ID colonne, valeur = donnée
- Configuration de colonne en JSONB (`config` dans `user_database_columns`) — options select, relation cible, etc.
- Cascade delete : base de données → colonnes + lignes
- API REST : CRUD complet (`/api/databases`, `/api/databases/[databaseId]`, `/columns`, `/rows`)
- Extension TipTap `DatabaseBlock` : nœud atom, draggable — le nœud ne stocke que `databaseId` (données en BDD)
- Permissions héritées de l'espace via `getSpacePermission()`
- Édition inline optimistic avec debounce 300ms

### ADR-014 : Tableau blanc et prototypage (Penpot)
- Penpot auto-hébergé (AGPL-3.0) via overlay Docker optionnel (`docker-compose.penpot.yml`), remplace tldraw v4 (licence non libre depuis v4)
- Intégration par iframe en modale plein écran, proxy transparent via Next.js (`/penpot/*`)
- Distinction tableau blanc / prototypage par templates Penpot (pas de modification UI Penpot)
- Dégradation gracieuse : miniatures PNG + SVG dans S3, consultables sans Penpot actif
- Organisation Penpot : 1 projet = 1 espace LorIAx, table `penpot_mappings` pour le suivi bloc → fichier
- Verrous collaboratifs mono-éditeur (TTL 15 min) sur les attributs du nœud TipTap
- Extension unique `PenpotBlock` (remplace WhiteboardBlock + PrototypeBlock), attribut `blockType` pour différencier
- Alternative écartée : tldraw v4 (licence propriétaire depuis v4)

### ADR-052 : Initialisation de l'éditeur TipTap différée jusqu'à la restauration IndexedDB (Sprint 85)
- **Contexte** : les blocs d'application (Penpot, Whiteboard, Mindmap, etc.) n'apparaissaient pas au premier chargement. L'éditeur était créé une seule fois (useEditor sans deps array) avec le contenu markdown du serveur (qui ne contient pas les blocs custom, perdus lors de la conversion Yjs→Markdown). Quand `collabActive` passait à true, l'éditeur ne se recréait pas et le document Yjs (avec les blocs) n'était jamais appliqué.
- **Choix** : (1) Ajout de l'état `ydocReady` dans `use-collaboration.ts` — déclenché par `IndexeddbPersistence.whenSynced` (~50ms) avec guard `mounted` anti-fuite. (2) `collabActive` déclenché par `ydocReady && !!provider && !!ydoc` au lieu d'`isSynced` (WS, 500ms-2s). (3) Clé dynamique `editor-${id}-collab / -solo` sur `LorIAxEditor` — force le remontage en mode collab dès que IndexedDB est prêt, l'éditeur monte directement avec la Collaboration extension et le document Yjs complet. Un squelette "Chargement du document..." masque la transition (~50-100ms). (4) `EditorBlockErrorBoundary` branché sur tous les blocs lazy pour remplacer les disparitions silencieuses par un état d'erreur visible.
- **Alternatives écartées** : ajouter `[isCollab]` comme deps à `useEditor` (flash visible lors de la transition), attendre `isSynced` (trop lent, 500ms-2s), `content: doc.content` initial en mode collab (markdown ne contient pas les blocs custom).

### ADR-051 : Migration tldraw → Excalidraw pour le bloc Tableau blanc (Sprint 83)
- tldraw v4 a introduit une licence commerciale rendant l'interface inutilisable sans clé (toolbar absente, comportement bridé)
- Excalidraw (`@excalidraw/excalidraw` MIT) retenu : licence libre, composant React mature, aucun serveur tiers requis
- Architecture REST pure : chargement via `GET /api/whiteboard/[canvasId]`, sauvegarde debounce 3s via `POST`, flush `keepalive` à la fermeture
- Hocuspocus écarté pour les rooms whiteboard : validation UUID stricte côté serveur incompatible avec le naming `whiteboard-{uuid}`
- Modal rendu via `createPortal(…, document.body)` pour éviter le containing block TipTap qui causait un canvas Excalidraw de taille infinie
- CSS Excalidraw importé explicitement (`@excalidraw/excalidraw/index.css`) — non inclus automatiquement via `next/dynamic`
- Multi-utilisateur prévu sprint suivant : endpoint WebSocket dédié hors pipeline Hocuspocus

### ADR-015 : Audit sécurité & optimisation production (Sprint 28)
- **Logging structuré** : Pino plutôt que Winston — plus léger, JSON natif, compatible Next.js standalone via `serverExternalPackages`
- **Validation env vars** : Zod au démarrage via `instrumentation.ts` (crash-fast) — évite les erreurs silencieuses en runtime
- **xlsx → exceljs** : remplacement de `xlsx` (vulnérabilité HIGH, prototype pollution, pas de fix) par `exceljs` — API différente mais plus sûre et activement maintenue
- **Lazy-load Recharts** : extraction du renderer dans `chart-renderer.tsx` + `React.lazy` — Recharts (~250KB) n'est chargé qu'à l'affichage d'un bloc graphique
- **Lazy-load Lowlight** : import dynamique asynchrone de `@tiptap/extension-code-block-lowlight` + `lowlight` (~180KB) — l'éditeur charge sans attendre la coloration syntaxique
- **CSP dynamique** : env vars `MINIO_PUBLIC_URL` et `WS_URL` dans `next.config.ts` — supprime le hardcode `localhost:9000`
- **Dependabot** : npm weekly (groupement minor+patch) + GitHub Actions weekly

### ADR-016 : Classification de sécurité hiérarchique (Sprint 35)
- **4 niveaux** : `public` (1) < `internal` (2) < `confidential` (3) < `secret` (4) — enum PostgreSQL `classification_level`
- **Plafond par espace** : un document ne peut avoir un niveau inférieur à celui de son espace — fonction `isClassificationAllowed()` dans `classification.ts`
- **Partage externe** : table `public_shares` avec token unique 64 chars, condition stricte (doc+espace = `public`) — pas de lien signé type JWT pour rester simple et révocable instantanément
- **Cohabitation avec `visibility`** : l'ancien champ `visibility` (private/team/public) est conservé temporairement pour rollback, mais `classification` est désormais la source de vérité pour l'accès

### ADR-017 : Avatars VizHash (Sprint 37)
- **Algorithme** : port TypeScript/Canvas de [VizHash GD](https://sebsauvage.net/wiki/doku.php?id=php:vizhash_gd) par sebsauvage — PRNG déterministe (mulberry32) + formes géométriques semi-transparentes
- **Choix vs Gravatar** : pas de dépendance réseau, fonctionne hors-ligne, pas de tracking tiers, déterministe côté client
- **Cache** : Map en mémoire (clé = `text:size`) — évite de recalculer le canvas à chaque render
- **Sidebar redimensionnable** : hook `useSidebarResize` (drag, plier/déplier, localStorage) — séparé du layout pour réutilisabilité

### ADR-018 : Hardening sécurité (Sprint 38)
- **SSRF** : module `src/lib/security/url-validator.ts` — validation centralisée des URLs externes (blocage IPs privées RFC 1918, link-local 169.254.x, cloud metadata, hostnames .local/.internal/.localhost). Intégré dans link-preview et data-proxy.
- **Injection LDAP** : échappement des caractères spéciaux dans les filtres LDAP (RFC 4515) via `escapeLdapFilter()` — empêche la manipulation des requêtes LDAP par des emails malveillants.
- **tsquery injection** : remplacement de la construction manuelle `to_tsquery('french', ...)` par `plainto_tsquery('french', ...)` dans l'API v1/search — la construction manuelle avec concaténation `:*` et `&` était vulnérable à une injection tsquery.
- **CSP frame-src** : ouverture à `https://docs.google.com` pour l'embed de Google Docs — le `'none'` précédent bloquait les iframes légitimes.
- **Logging unifié** : migration systématique des `console.error` restants vers Pino (`src/lib/logger.ts`) — les erreurs sont désormais structurées en JSON dans tous les modules serveur (auth, collab, email, webhooks, notifications, activité).

### ADR-019 : Calcul d'itinéraire via OSRM (Sprint 39)
- **Choix** : OSRM (Open Source Routing Machine) comme moteur de routage. API publique gratuite pour le développement, self-hostable via Docker en production. Pas de clé API nécessaire.
- **Proxy server-side** : `/api/route-proxy` — évite l'exposition de l'URL OSRM au client, applique rate limiting (30 req/min), validation SSRF pour les instances custom, timeout 15s. Conversion [lng,lat] (OSRM/GeoJSON) → [lat,lng] (Leaflet) côté serveur.
- **Géométrie cachée** : la réponse OSRM (GeoJSON overview=full) est stockée dans `config.routes[].geometry` en tant que `[lat,lng][]` — le rendu se fait sans recalcul. La taille du JSON augmente mais évite les appels OSRM à chaque ouverture.
- **Zéro dépendance** : OSRM retourne du GeoJSON natif, Leaflet gère nativement `L.polyline()`, flèches en SVG inline via `L.divIcon`.

### ADR-020 : Calendrier partagé CalDAV (Sprints 40-44)
- **Choix** : Implémentation native CalDAV (RFC 4791) plutôt qu'intégration d'un serveur tiers (Radicale, Baïkal). Le serveur CalDAV est intégré directement dans le serveur Next.js custom via rewrite PROPFIND/REPORT → POST dans `server.ts` (Next.js ne supportant pas les méthodes HTTP non-standard).
- **Modèle** : 3 types de calendriers (personal, team, organization) avec auto-provisioning à la création d'un utilisateur, d'une équipe ou par un super_admin. Permissions héritées de l'espace associé.
- **iCalendar** : bibliothèque `ical.js` pour le parsing/génération des VCALENDAR/VEVENT. Récurrences via la lib `rrule` (expansion RRULE côté serveur).
- **Sync** : sync-token CalDAV (RFC 6578) + CTag/ETag pour la synchronisation incrémentale avec les clients (Thunderbird, Apple Calendar, DAVx⁵). Abonnement à des flux ICS externes avec actualisation périodique.
- **Intégration éditeur** : 2 extensions TipTap — `CalendarBlock` (mini-calendrier intégré dans un document) et `EventInlineNode` (nœud inline comme les mentions).

### ADR-021 : Optimisation chargement page document (Sprint 45)
- **Choix** : Extraction d'un composant client `DocumentPageClient` distinct du server component `page.tsx`. Le server component ne fait plus que le fetch initial (données + auth), le client component gère tout l'état et l'interactivité. Réduit le bundle du server component de ~690 lignes à ~100 lignes.
- **Bundle analyzer** : `@next/bundle-analyzer` pour identifier les dépendances lourdes. L'emoji picker (~300 KB) est désormais chargé en `next/dynamic` (lazy loading).
- **Cache HTTP** : L'API `/api/documents/[id]` renvoie des headers `ETag` et `Cache-Control` avec support des réponses conditionnelles `304 Not Modified`, évitant le re-transfert du contenu quand le document n'a pas changé.

### ADR-022 : Visioconférence LiveKit et comptes-rendus IA (Sprint 46, migré Sprint 52)
- **Choix initial** : Jitsi Meet self-hosted. **Migré vers LiveKit** (SFU Go, Apache 2.0) — plus léger, meilleure qualité WebRTC, SDK React moderne (`@livekit/components-react`), tokens signés côté serveur (`livekit-server-sdk`).
- **Raisons de la migration** : Jitsi nécessitait 4 services Docker (web, prosody, jicofo, jvb) contre 2 pour LiveKit (server + egress). Architecture plus simple, meilleure intégration programmatique, enregistrement natif via Egress.
- **Enregistrement** : LiveKit Egress remplace Jibri — écrit directement `{roomName}_{timestamp}.ogg` dans le répertoire configuré. Plus léger et plus fiable.
- **Pipeline post-réunion** : inchangé — Egress → Whisper (transcription `.json`) → LLM (résumé structuré via Vercel AI SDK) → Création automatique d'un document `.md` dans l'espace.
- **Fichiers `.md` comme base** : Les transcripts et comptes-rendus sont des documents LorIAx classiques stockés dans le workspace filesystem + git — cohérent avec l'architecture existante.
- **Docker** : `docker-compose.livekit.yml` (override optionnel) — LiveKit Server + Egress + Whisper (profil).
- **Services** : `src/lib/meet/` — `livekit-config.ts`, `livekit-token.ts`, `rooms.ts`, `recording.ts`, `transcribe.ts`, `summarize.ts`, `meeting-notes.ts`. API REST sous `/api/meet/`.

### ADR-023 : Geocodeur Photon + fallback Nominatim (Sprint 47)
- **Choix** : Photon (photon.komoot.io) comme geocodeur principal pour la recherche de lieux dans le bloc carte. API rapide, autocomplete, résultats en français, basée sur OSM. Fallback sur Nominatim si Photon est indisponible.
- **Justification** : Nominatim seul était trop lent et mono-résultat. Photon retourne jusqu'à 6 résultats avec debounce 350ms côté client, offrant une UX de type autocomplete. Les deux APIs sont OSM, gratuites, et auto-hébergeables si nécessaire.
- **Variable d'env** : aucune (utilise les APIs publiques par défaut ; self-hosting possible via `PHOTON_API_URL` futur).

### ADR-024 : Calendrier des journées nationales et mondiales (Sprint 47)
- **Choix** : Fichier de données statique (`src/lib/calendar/national-days.ts`) contenant 68 journées officielles (nationales FR, mondiales ONU, européennes). Injecté comme calendrier d'organisation via le seed démo.
- **Justification** : Données stables (changent rarement), pas besoin d'API externe. Utilise `FREQ=YEARLY` pour la récurrence. Le calendrier est supprimable/modifiable par l'utilisateur.

### ADR-025 : Améliorations bloc base de données (Sprint 48)
- **Choix** : Ajout du type de colonne `image` (enum PostgreSQL + TypeScript), upload via Garage S3 (`/api/attachments`) ou URL directe. Mode plein écran via l'API native `requestFullscreen()`. Cadres et toolbars toujours visibles sur tous les blocs complexes, masqués en export/print via `@media print` et classe `.loriax-export`.
- **Justification** : Le débordement horizontal du tableau et l'absence de type image limitaient l'usage du bloc annuaire. Le pattern hover sur les toolbars créait de la confusion — l'utilisateur ne savait pas que des contrôles existaient sans survoler.

### ADR-026 : Audit sécurité et performance (Sprint 51)

- **Contexte** : audit systématique avant mise en production — 22 items identifiés (sécurité + performance)
- **Choix** :
  - CSP nonce-based (middleware) remplace `unsafe-inline`/`unsafe-eval` dans script-src
  - Chiffrement AES-256-GCM des secrets en base (LDAP, SMTP, Resend) via `src/lib/crypto.ts`
  - Journal d'audit admin (table `audit_logs`, fire-and-forget)
  - Cache LRU en mémoire pour `getSpacePermission()` (TTL 30s, max 1000)
  - Rate limiter Redis-compatible (`ioredis`) avec fallback mémoire
  - PgBouncer (connection pooling) en mode transaction
  - Virtualisation des grandes listes (`@tanstack/react-virtual`)
  - Index trigram (`pg_trgm`) pour la recherche courte
- **Impact** : 20/22 items traités. Reste : découpage des composants monolithiques (refactoring massif)

### ADR-027 : Rate limiter multi-backend (Sprint 51)

- **Contexte** : le rate limiter en mémoire ne fonctionne pas en multi-instance
- **Choix** : `ioredis` (compatible Valkey) avec lazy-init + fallback mémoire si `REDIS_URL` absent
- **API** : `checkRateLimit()` (sync, mémoire) + `checkRateLimitAsync()` (async, Redis)
- **Alternative écartée** : `@upstash/ratelimit` (nécessite Upstash cloud, incompatible auto-hébergement)

### ADR-028 : Ollama obligatoire + Whisper automatique avec LiveKit (Sprint 56)

- **Contexte** : le pipeline meeting (Egress → Whisper → LLM → document) était codé mais contourné par les données de démo pré-écrites ; Whisper derrière un profil Docker optionnel, aucun LLM garanti en dev
- **Choix** :
  - Ollama dans `docker-compose.yml` principal (pas dans l'override LiveKit) avec `gemma4:e4b` comme modèle par défaut — LLM local gratuit, multimodal vision (OCR, parsing PDF/UI, schémas), pas de clé API nécessaire
  - Whisper sort du profil optionnel — démarre automatiquement avec LiveKit
  - Configuration des services via `system_settings` (BDD) avec fallback env vars
  - Nouvel onglet admin "Services" centralise LiveKit + Whisper + Ollama avec healthchecks
- **Alternatives écartées** : llama.cpp natif (moins ergonomique qu'Ollama), Whisper.cpp local (l'image Docker onerahmet est plus mature)

### ADR-029 : Enregistrement Egress programmatique + autorisation API Meet (Sprint 59)

- **Contexte** : la migration Jitsi → LiveKit (Sprint 52) avait configuré le service Egress dans Docker mais n'avait jamais implémenté le déclenchement programmatique de l'enregistrement. Résultat : aucun fichier audio n'était créé, la pipeline transcription/résumé ne produisait rien. Par ailleurs, 4 routes API Meet (`/rooms/[id]`, `/status`, `/notes`, `/token`) n'avaient aucun contrôle d'autorisation.
- **Choix** :
  - Module `egress.ts` utilisant `EgressClient` du SDK LiveKit server pour démarrer/arrêter les enregistrements audio-only (OGG)
  - Enregistrement démarré à l'activation de la réunion (non-bloquant), arrêté à la fin avec délai de finalisation (3s)
  - Helper `canAccessMeeting()` centralisé : créateur, participant, admin espace ou super_admin
  - Toutes les routes API Meet sécurisées, création de réunion limitée aux membres de l'espace (minimum editor)
  - `listMeetings()` étendu pour inclure les réunions par participation (pas seulement créées)
- **Alternatives écartées** : auto-egress via webhook LiveKit (nécessite un endpoint exposé, plus complexe à configurer en self-hosted)

### ADR-030 : Gestion avancée IA — Section admin dédiée (Sprint 60)

- **Contexte** : la gestion IA était dispersée sur 3 onglets admin (Credentials IA, Services, Système) sans monitoring, quotas, ni gestion de prompts
- **Choix** :
  - Section admin dédiée `/admin/ai/*` avec 7 sous-pages (dashboard, réglages, providers, prompts, quotas, playground, logs)
  - 2 types de connecteurs SDK : `anthropic` (API Anthropic) et `openai_compatible` (tout provider compatible OpenAI : OpenAI, Ollama, Mistral, Groq, Together, vLLM, LiteLLM, OpenRouter, etc.)
  - Assignation modèle par type d'usage (chat, résumé, transcription, embeddings) avec fallback automatique en cas d'indisponibilité du provider principal
  - Bibliothèque de prompts versionnée avec A/B testing (répartition du trafic entre versions)
  - Quotas hiérarchiques (organisation > équipe > utilisateur) avec blocage côté API et alertes e-mail
  - Playground de test avec comparaison côte à côte de 2 modèles
  - Logging complet des requêtes IA (tokens, latence, coûts estimés) avec rétention configurable
  - 5 nouvelles tables : `ai_usage_logs`, `ai_prompts`, `ai_prompt_versions`, `ai_quotas`, `ai_model_assignments`
- **Alternatives écartées** : méga-onglet unique (trop chargé), micro-apps modulaires (navigation fragmentée)

### ADR-031 : Mistral AI — Connecteur natif dédié

- **Contexte** : Mistral AI est utilisable via le connecteur `openai_compatible` mais nécessite une configuration manuelle de l'URL de base. L'ajout d'un SDK natif simplifie la mise en place et offre un support de premier ordre pour les modèles Mistral (Large, Small, Codestral, Pixtral, Voxtral).
- **Choix** :
  - Nouveau connecteur `mistral` ajouté à l'enum PostgreSQL `connector_type` (3 valeurs : `anthropic`, `openai_compatible`, `mistral`)
  - SDK `@ai-sdk/mistral` (Vercel AI SDK) au lieu de `@ai-sdk/openai` avec URL personnalisée
  - Branchement dans toute la chaîne : provider-resolver, factory legacy, test de connexion, détection de modèles, admin UI
  - Variable d'env `MISTRAL_API_KEY` pour configuration simple sans base de données
- **Alternatives écartées** : utiliser `openai_compatible` avec URL Mistral (fonctionnel mais moins ergonomique, pas de détection automatique de l'URL)

### ADR-032 : Bloc réunion présentielle — composants partagés et diarisation (Sprint 63)

- **Contexte** : le bloc visio cible les réunions distantes (chaque participant rejoint une salle LiveKit). Pour les réunions présentielles (un seul micro sur la table), un nouveau bloc est nécessaire avec un cycle de vie différent : enregistrement solo, diarisation, mapping locuteurs → vrais noms.
- **Choix** :
  - Architecture à composants partagés : extraction de `MeetingToolbar`, `MeetingNotesPreview`, `MeetingStatusSection` (zéro duplication entre les deux blocs)
  - Nouveau nœud TipTap `inPersonMeetingBlock` distinct (pas de polymorphisme)
  - LiveKit en mode solo pour réutiliser l'infrastructure Egress existante
  - Nouveau statut `mapping` : après transcription avec diarisation (WhisperX + pyannote), le pipeline s'arrête pour permettre l'association Speaker N → nom réel
  - VU-mètre via Web Audio API (`AnalyserNode`) pour retour visuel du micro
- **Alternatives écartées** : bloc polymorphe (trop de conditionnels), capture audio navigateur seul sans LiveKit (perd Egress/pipeline), Voxtral comme moteur principal (pas de diarisation native — spec séparée prévue)

### ADR-033 : Mode hors-ligne — Approche cache-first incrémentale

- **Contexte** : LorIAx est une application web collaborative nécessitant une connexion permanente. Les utilisateurs terrain ont besoin d'accéder à leurs documents sans réseau. Benchmark des concurrents : AFFiNE (local-first CRDT), Notion (cache-first opt-in), Obsidian (fichiers locaux), Outline (pas d'offline).
- **Choix** :
  - Approche **cache-first incrémentale** (style Notion) plutôt que local-first complet (trop lourd à implémenter)
  - **Serwist** (`@serwist/next`) pour le Service Worker (successeur de next-pwa, supporte App Router)
  - **y-indexeddb** pour persister l'état Yjs CRDT dans IndexedDB (édition offline via fusion CRDT automatique)
  - **idb** (~1 KB) pour le cache métadonnées (espaces, arbre documents, profil utilisateur)
  - File d'attente IndexedDB pour les opérations différées (sauvegardes markdown, commentaires)
  - SyncManager singleton avec retry × 3 et backoff exponentiel au retour en ligne
  - Endpoint léger `/api/ping` pour le heartbeat réseau (au lieu de `/api/health` qui touche la DB)
  - Documents en verrouillage pessimiste = lecture seule hors-ligne (Yjs seul supporte l'édition offline)
- **Impact bundle** : +4 KB gzip (y-indexeddb + idb), Serwist dans le Service Worker (hors bundle principal)
- **Alternatives écartées** : PowerSync/ElectricSQL (surdimensionné pour 5 tables), RxDB (NoSQL inutile ici), réécriture local-first à la AFFiNE (hors scope)

### ADR-034 : Compression et archivage profond des données binaires

- **Contexte** : LorIAx stocke images, vidéos, audio et documents dans Garage S3 sans compression ni optimisation (sauf avatars WebP via Sharp). Les enregistrements de réunion (OGG), exports Penpot (PNG+SVG), pièces jointes (jusqu'à 50 Mo) et états CRDT Yjs s'accumulent sans politique d'archivage. Sur un serveur auto-hébergé aux ressources limitées, l'espace disque est une contrainte forte.
- **Choix** :
  - **Algorithme principal : Zstandard (zstd)** — meilleur compromis ratio/vitesse/mémoire pour un serveur frugal. Décompression quasi-instantanée (1,5 Go/s), compression rapide en mode streaming, support de dictionnaires entraînés pour les formats récurrents (SVG Penpot, Yjs states). Utilisé par Meta, Linux kernel, PostgreSQL 16+.
  - **Compression à l'ingestion (données actives)** :
    - Images : Sharp → **AVIF** quality 70 (gain 40-60% vs JPEG) avec fallback WebP pour les navigateurs anciens. Sharp supporte AVIF nativement depuis v0.33.
    - Audio réunions : configurer LiveKit Egress en **Opus** au lieu de Vorbis (gain 30-50%, codec natif WebRTC)
    - SVG Penpot : minification **SVGO** + stockage compressé zstd (gain 60-80%)
    - États CRDT Yjs (base64 en BDD) : compression **zstd** avant stockage (gain 70-85% sur données structurées)
    - PDF : **Ghostscript** preset `/ebook` en traitement async (gain 30-70%)
    - Vidéo : transcodage **FFmpeg → H.265/HEVC** async pour fichiers ≤ 50 Mo (gain 40-50% vs H.264) — priorité basse (peu de vidéos)
  - **Archivage profond (données froides)** :
    - Nouveau bucket Garage `loriax-archive` séparé du bucket chaud `loriax-files`
    - Colonne `last_accessed_at` ajoutée à la table `attachments` (mise à jour à chaque accès via URL signée)
    - Colonne `storage_tier` enum (`hot`, `archive`) + `archive_key` varchar sur `attachments`
    - Job CRON périodique : détecte les fichiers non accédés depuis N jours (configurable en admin), les regroupe par espace en archives `.tar.zst` (zstd niveau 19), les déplace dans le bucket archive, supprime les originaux du bucket chaud
    - Restauration à la demande : décompression async avec notification à l'utilisateur, retour dans le bucket chaud
    - Gain estimé : 60-80% d'espace sur les données archivées (PDF, SVG, audio et documents compressent très bien ; images et vidéos déjà compressées gagnent peu mais bénéficient du regroupement tar)
  - **Ordre d'implémentation** : (1) Images AVIF à l'upload, (2) colonne `last_accessed_at` + tracking, (3) Opus pour Egress LiveKit, (4) compression zstd des CRDT states, (5) job d'archivage profond, (6) transcodage vidéo FFmpeg
- **Alternatives écartées** :
  - gzip : ratio inférieur, pas de dictionnaires, vitesse de décompression 3× plus lente que zstd
  - Brotli : excellent ratio mais compression lente (inadapté au traitement temps réel), pas de mode streaming natif côté serveur
  - xz/LZMA : meilleur ratio théorique mais décompression 10× plus lente et consommation mémoire élevée (incompatible serveur frugal)
  - Tiering S3 natif (Glacier-like) : Garage ne supporte pas les classes de stockage — le tiering est implémenté par bucket séparé
  - Déduplication au niveau bloc (ZFS/Btrfs) : surdimensionné, dépendant du filesystem hôte, hors scope applicatif

### ADR-035 : Voxtral — Moteur de transcription Mistral natif (Sprint 64, révisé Sprint 65)

- **Contexte** : Whisper (openai-whisper-asr-webservice) est le moteur STT principal. Mistral propose Voxtral Mini 4B Realtime, un modèle STT temps réel multilingue (13 langues, latence < 500 ms), sous licence Apache-2.0.
- **Choix** :
  - Modèle : `mistralai/Voxtral-Mini-4B-Realtime-2602` — 4B paramètres, BF16, optimisé pour le déploiement embarqué
  - Backend : vLLM (`vllm serve`) avec plugin `vllm-omni` pour le support audio
  - Adaptateur : serveur FastAPI (`docker/voxtral/server.py`) exposant `/asr` compatible Whisper, proxy vers vLLM `/v1/audio/transcriptions`
  - Profil Docker conditionnel (`--profile voxtral`) : ne démarre que sur demande explicite
  - GPU obligatoire : NVIDIA >= 16 Go VRAM (BF16)
  - Fallback bidirectionnel : si Voxtral indisponible → Whisper, et inversement
  - Whisper reste le moteur par défaut (CPU, léger, diarisation native via WhisperX)
- **Révision Sprint 65** : le modèle initialement ciblé (`Voxtral-Mini-Latest`) était un modèle TTS, pas STT. Remplacé par le bon modèle Realtime. Architecture migrée de `transformers.pipeline` vers vLLM.
- **Alternatives écartées** :
  - API Mistral cloud : incompatible avec l'architecture auto-hébergée frugale
  - Remplacement direct de Whisper : Voxtral requiert un GPU, Whisper tourne en CPU — les deux coexistent

### ADR-036 : Purge automatique des enregistrements audio (Sprint 65)

- **Contexte** : les fichiers `.ogg` des réunions restaient indéfiniment dans `data/recordings/` après transcription, consommant du stockage inutilement.
- **Choix** : suppression automatique du fichier audio dans `end/route.ts` après transcription réussie ET création du compte-rendu. Log warning si la suppression échoue (non bloquant). Les fichiers sans transcription (échec ou désactivée) sont conservés.
- **Alternatives écartées** : rétention avec TTL (cron de purge) — complexité injustifiée, le transcript suffit une fois le CR généré.

### ADR-037 : Enregistrement Egress déclenché par le client (Sprint 66)

- **Contexte** : `startRecording()` était appelé dans la route `/activate` (côté serveur) avant que le premier participant ne rejoigne la room LiveKit. La room n'existant pas encore côté LiveKit, `startRoomCompositeEgress` échouait silencieusement → `egressId` restait NULL → pas d'enregistrement → pas de transcription → pas de compte-rendu.
- **Choix** :
  - Nouvel endpoint `POST /api/meet/rooms/[id]/start-recording` déclenché par le client
  - Visio : bouton overlay « Activer la transcription » affiché une fois la connexion LiveKit établie, bascule vers un indicateur 🔴 REC pulsant avec chronomètre
  - Présentiel : auto-start 3s après connexion LiveKit (consentement implicite au lancement du bloc)
  - `egressId` exposé dans `/status` pour détecter un enregistrement en cours au rechargement
- **Alternatives écartées** :
  - Timer côté serveur (retry `startRecording` en boucle) : fragile, délais imprévisibles
  - Webhook LiveKit `room_started` : complexité d'intégration disproportionnée pour le gain

### ADR-038 : Authentification Penpot via Cookie (Sprint 67)

- **Contexte** : le header `Authorization: Token` utilisé par `PenpotService` n'était pas reconnu par Penpot 2.x — le backend Penpot gère l'authentification via un cookie `auth-token` posé au login. Les appels RPC renvoyaient systématiquement 401.
- **Choix** :
  - Auth via cookie `auth-token` extrait du header `Set-Cookie` de la réponse login
  - `ensurePenpotService()` async avec promise de-dupliquée (lazy singleton)
  - Auto-registration via le flow Penpot 2.x (`prepare-register-profile` → token → `register-profile`) si le compte service n'existe pas
  - `defaultTeamId` résolu au login ou lazy au premier `createProject()`
  - `enable-registration` côté backend Docker (requis), `disable-registration` côté frontend (sécurité)
- **Alternatives écartées** :
  - Accès direct à la base Penpot (couplage fort, risque de casse à chaque mise à jour)
  - Token API Penpot (non disponible en Penpot Community 2.x)

### ADR-053 : Module Salles de réunion (Sprint 92)

- **Contexte** : les organisations multi-services (collectivités, associations) ont besoin de gérer des salles physiques et de permettre aux équipes de réserver des créneaux sans passer par un outil externe. Le calendrier CalDAV existant (ADR-020) couvre les événements personnels et d'équipe, mais pas la gestion des ressources physiques avec contrôle des droits fin.
- **Choix** :
  - Module activable via feature flag `meeting_rooms_enabled` stocké dans `system_settings` — 404 sur toutes les routes si désactivé
  - Rôle parallèle `facility_manager` dans l'enum RBAC — donne accès uniquement à l'onglet « Salles » en administration (pas les onglets users, équipes, IA, système, etc.)
  - **Matrice de droits à 3 axes** : par utilisateur (`user`), par équipe (`team`), par rôle global (`role`) — logique OR, un seul axe suffit pour autoriser
  - **Anti-chevauchement garanti** : contrainte PostgreSQL `EXCLUDE USING gist (room_id WITH =, tstzrange(start_time, end_time) WITH &&)` dans la migration `0010_meeting_rooms.sql` — pas de vérification applicative pouvant être contournée par une race condition
  - **Horaires d'ouverture** : table `meeting_room_hours` (jours de la semaine × créneaux multiples) + liste statique `holidays-fr.ts` 2026-2027. La fonction `isSlotAvailable()` dans `opening-hours.ts` vérifie les deux avant de laisser passer une réservation.
  - **Intégration calendrier** : chaque réservation appelle `calendar-link.ts` qui crée/retrouve le calendrier organisation « Salles de réunion » (auto-provisionné à la première réservation) et y insère un VEVENT. L'annulation supprime l'événement et envoie une notification `meeting_room_cancelled` aux participants ayant un compte LorIAx.
  - **Uploads** : photos et plans convertis en WebP 2048px via Sharp avant envoi vers Garage S3 — cohérent avec le pipeline d'upload existant (ADR-034)
  - **Tableau d'occupation** : endpoint `/api/meeting-rooms/stats` — agrégation SQL sur la table `room_bookings`, export CSV BOM UTF-8 compatible Excel
  - 3 nouvelles tables : `meeting_rooms`, `room_bookings`, `meeting_room_permissions`
  - 1 nouvelle table de jointure : `meeting_room_role_permissions`
  - Seed idempotent : `scripts/seed-meeting-rooms.ts` (détection par nom de salle)
- **Alternatives écartées** :
  - Réutiliser les événements CalDAV comme ressources (RFC 4791 `RESOURCE` — pas de droits granulaires, pas de matrice par équipe)
  - Base de données utilisateur (ADR-013) comme liste de salles (pas de logique métier, pas d'horaires)
  - Outil externe type Robin/Skedda (incompatible architecture auto-hébergée frugale)

## Structure des dossiers

Voir le README principal pour l'arborescence complète.


### ADR-039 : Migrations Drizzle automatiques au démarrage (Sprint 69)

- **Contexte** : les migrations étaient appliquées manuellement via `drizzle-kit migrate`. En SaaS auto-hébergé, les instances clientes ne peuvent pas exécuter de commandes manuelles après une mise à jour.
- **Choix** : appel programmatique de `migrate()` (drizzle-orm/node-postgres/migrator) dans `server.ts`, avant `app.prepare()`. Les fichiers SQL de migration sont copiés dans l'image Docker (`COPY migrations/`). La migration est idempotente (journal `__drizzle_migrations`).
- **Alternatives écartées** : init container séparé (complexité Compose), entrypoint shell (fragile en standalone Next.js).

### ADR-040 : Versioning sémantique et Docker Registry (Sprint 69)

- **Contexte** : les instances clientes rebuildaient depuis les sources à chaque déploiement Dokploy. Pas de versioning, pas de canal de mise à jour, version hardcodée "1.5.0" dans l'UI.
- **Choix** :
  - `APP_VERSION` baked dans le Dockerfile via `ARG APP_VERSION=dev` → `ENV APP_VERSION`
  - GitHub Actions publie sur `ghcr.io/flavien-dragamig/loriax:v*.*.*` + `:latest` sur chaque tag semver
  - License manager expose `GET /api/releases/latest` (public, sans auth) pour les checks de version
  - Endpoint `/api/admin/updates/check` dans loriax-app avec cache 24h dans `system_settings`
- **Alternatives écartées** : auto-update (trop risqué sans tests automatisés), webhook Dokploy (spécifique à l'hébergeur).

### ADR-042 : Suppression de CollaborationCursor (Sprint 72)

- **Contexte** : `@tiptap/extension-collaboration-cursor@2.x` utilise `y-prosemirror` directement et crée sa propre instance de `ySyncPluginKey`. `@tiptap/extension-collaboration@3.x` utilise `@tiptap/y-tiptap` (fork interne) avec une instance distincte du même `ySyncPluginKey`. Les deux instances n'étant pas identiques, `CollaborationCursor` 2.x ne trouve pas l'état du plugin de sync et lève `TypeError: can't access property "doc", ystate is undefined` à chaque ouverture de document en mode collaboratif.
- **Choix** : suppression de `@tiptap/extension-collaboration-cursor` jusqu'à la disponibilité d'une version 3.x stable compatible avec `@tiptap/y-tiptap@^3.0.2`. La barre de présence (`CollaboratorsBar` via `usePresence`) affiche toujours les collaborateurs actifs.
- **Alternatives écartées** : downgrade TipTap 2.x (perte de fonctionnalités), installation de `@tiptap/extension-collaboration-cursor@next` (requiert `@tiptap/y-tiptap@^1.0.0`, incompatible avec `^3.0.2`).

### ADR-041 : Sauvegarde BDD vers S3 distant (Sprint 70)

- **Contexte** : le backup existant (pg_dump cron dans un conteneur Docker) stockait les dumps localement avec 7 jours de rétention. Aucune interface admin pour piloter les sauvegardes, pas de destination distante.
- **Choix** :
  - pg_dump -Fc (format custom, compression native ~5×) streaming vers S3 via `@aws-sdk/lib-storage` (multipart upload, pas de fichier temporaire)
  - Séparation Client (30 tables de contenu) / Technique (17 tables de config) / Complet
  - Destination S3 configurable depuis l'admin (séparée du Garage app), credentials chiffrés AES-256-GCM
  - Planification via `croner` (zéro dépendance, <10 Ko), initialisé dans `server.ts`
  - Restauration protégée par re-saisie du mot de passe admin (bcrypt)
- **Alternatives écartées** : rsync (incompatible S3), WAL archiving (complexité disproportionnée pour une instance mono-serveur), pg_basebackup (nécessite accès superuser).

### ADR-043 : Extension TipTap unifiée pour les embeds vidéo (Sprint 73)

- **Contexte** : besoin d'intégrer des vidéos YouTube, Vimeo et Dailymotion dans l'éditeur. TipTap fournit `@tiptap/extension-youtube` mais il ne couvre qu'un seul provider.
- **Choix** : une seule extension custom `VideoEmbed` (`video-embed.tsx`) gérant les trois providers via parsing URL. Même pattern que `GoogleDocsEmbed` : NodeView React avec formulaire de saisie inline, InputRule pour conversion automatique au collé, commandes TipTap. Les attributs stockés (`src`, `provider`, `videoid`) permettent la reconstruction sans réseau.
- **Alternatives écartées** : `@tiptap/extension-youtube` (couvre YouTube uniquement, duplication nécessaire pour Vimeo/Dailymotion), extension séparée par provider (trois blocs distincts dans le menu slash, cohérence UX dégradée).

### ADR-044 : Padding éditeur via CSS custom property + cascade (Sprint 73)

- **Contexte** : nécessité de personnaliser l'espacement vertical de l'éditeur à deux niveaux — espace (preset d'apparence JSONB existant) et document (nouveau champ `properties JSONB`).
- **Choix** : variable CSS `--loriax-editor-padding-y` consommée par `.tiptap-editor .ProseMirror`. Le niveau espace la positionne sur `:root` via `use-space-appearance.ts` (pattern existant). Le niveau document applique un `style` inline sur le wrapper de l'éditeur, qui prend la priorité grâce à la cascade CSS naturelle. Zéro JS de rendu, zéro rechargement.
- **Alternatives écartées** : prop `editorPaddingY` sur `LorIAxEditor` (couplage fort, prop drilling), classe Tailwind dynamique (non purgeable, nécessite safelist).

### ADR-045 : Fortune Sheet pour le bloc tableur natif (Sprint 74)

- **Contexte** : besoin d'un tableur embarqué directement dans les documents, avec formules, mise en forme et persistance côté serveur.
- **Choix** : `@fortune-sheet/react` (v1.0.4) chargé dynamiquement (`next/dynamic`, SSR: false) dans un NodeView TipTap. Les données sont sérialisées en JSON et stockées dans une table `spreadsheet_data` dédiée (non dans le contenu TipTap), adressée par `sheetId` UUID. Même pattern lazy-load que les blocs PenPot et Map.
- **Alternatives écartées** : Handsontable (licence propriétaire), AG Grid (bundle lourd), stockage dans le JSONB `content` du document (taille et diff non maîtrisés).

### ADR-046 : Migration Fortune Sheet → Univer (Sprint 76)

- **Contexte** : Fortune Sheet v1.0.4 n'est plus maintenu activement et présente des limitations de rendu et de compatibilité React 19. Univer est une alternative open-source plus maintenue avec une API de snapshot stable.
- **Choix** : `@univerjs/presets` + `@univerjs/preset-sheets-core` chargés dynamiquement (`import()` asynchrone dans un `useEffect`). Une couche de conversion `src/lib/spreadsheet/fortune-to-univer.ts` assure la rétrocompatibilité des données stockées (format Fortune Sheet détecté à la lecture dans la route GET et converti à la volée). Les données sont désormais stockées au format `IWorkbookData` Univer. La route PUT convertit également tout tableau Fortune Sheet résiduel avant persistance.
- **Alternatives écartées** : migration du schéma SQL (rupture sur les données existantes), conservation de Fortune Sheet en parallèle (deux dépendances lourdes), import statique Univer (SSR incompatible, bundle initial trop lourd).

### ADR-052 : Standardisation des boutons de menu des blocs sur shadcn/ui (Sprint 90)

- **Contexte** : chaque bloc éditeur (chart, table, spreadsheet, penpot, mindmap, whiteboard, map, database, video, google-docs, callout) avait ses propres classes CSS `.{bloc}-action` définies dans `globals.css`, soit ~250 lignes de CSS dupliqué. Les dropdowns custom (table presets, callout type) géraient manuellement le state, un `useRef` et un `useEffect` pour la fermeture au clic extérieur.
- **Choix** : migration complète vers `Button variant="ghost" size="icon-sm|xs"` de shadcn/ui pour tous les boutons de toolbar. Dropdowns remplacés par `DropdownMenu` (base-ui/react) éliminant tout state custom. Couleurs métier (penpot-action-blue/violet, mindmap amber) exprimées via classes Tailwind directement sur `Button` (`className="bg-blue-600 hover:bg-blue-700 text-white"`). Liens de téléchargement (`<a download>`) conservés en balise native mais stylisés via le pattern `render={<a>}` de base-ui.
- **Alternatives écartées** : composant `BlockActionButton` wrapper (abstraction prématurée), garder les classes CSS custom (dette croissante), `asChild` Radix (pas disponible dans @base-ui/react — pattern `render={}` à la place).

### ADR-047 : Graphiques natifs dans la modal tableur (Sprint 77)

- **Contexte** : Univer Pro propose un module graphique (`@univerjs-pro/sheets-chart`) mais il est payant. Le besoin est d'afficher des graphiques à partir des données du tableur sans dépendance propriétaire.
- **Choix** : onglet « Graphique » dans `SpreadsheetModal` réutilisant le `ChartRenderer` existant (Recharts). L'utilisateur saisit une plage de cellules (ex : `A1:D10`), choisit le type de graphique (barres, courbe, aire, camembert) et clique « Actualiser ». La fonction `extractChartData()` lit le snapshot Univer (`getActiveWorkbook().save()`) pour extraire les données de la plage. La première ligne est traitée comme en-têtes.
- **Alternatives écartées** : `@univerjs-pro/sheets-chart` (payant, Univer Pro), re-implémentation d'un renderer sur mesure (Recharts déjà présent), export vers un outil externe (friction utilisateur).

### ADR-048 : Intégration iframe Penpot — bridge d'authentification cookie (Sprint 78)

- **Contexte** : Penpot (tableau blanc / prototype) est intégré en iframe depuis localhost:3000. Deux blocages empêchaient le fonctionnement : (1) `X-Frame-Options: SAMEORIGIN` dans le nginx de `penpot-frontend` bloque l'iframe cross-port, (2) l'utilisateur n'est pas authentifié dans l'iframe car les sessions LorIAx (port 3000) et Penpot (port 9002) sont indépendantes.
- **Choix** : (1) Config nginx custom montée en volume dans `docker-compose.penpot.yml` — suppression du header `X-Frame-Options`. (2) Route `POST /api/penpot/set-browser-session` : récupère le token JWE de la session service Penpot (déjà obtenu côté serveur) et le pose en cookie `auth-token` dans la réponse browser. Per RFC 6265, les cookies ne sont pas liés au port — un cookie pour `localhost` posé par le port 3000 est envoyé aux requêtes vers le port 9002, ce qui authentifie automatiquement l'iframe. Le token est le même JWE émis par Penpot, valide pour `PENPOT_SECRET_KEY`.
- **Alternatives écartées** : proxy Next.js complet pour le frontend Penpot (complexity, chemins relatifs cassés), login via form auto-submit (CORS bloque cross-port en fetch, form submission incompatible JSON API), compte utilisateur Penpot par utilisateur LorIAx (surcharge infrastructure).

### ADR-051 : Re-upload Garage pour les attachments synchronisés Airtable/Notion (Sprint 87)

- **Contexte** : les URLs de fichiers générées par Airtable et Notion expirent (tokens signés temporaires). Stocker l'URL externe directement dans LorIAx rendrait les fichiers inaccessibles après expiration.
- **Choix** : lors d'un sync pull, chaque fichier attaché est téléchargé depuis l'URL externe (`fetch` avec timeout 30s, limite 20 Mo) et re-uploadé vers Garage S3 sous une clé permanente `{spaceId}/sync-{uuid}.{ext}`. Seules les métadonnées `{ key, filename, mimeType, size }` sont stockées dans `cells`. Les URLs signées sont générées à la demande via `GET /api/attachments/signed?key=`.
- **Alternatives écartées** : stocker l'URL externe (expiration), proxy LorIAx vers la source (couplage fort, fragile), cache TTL (complexité supplémentaire sans gain de fiabilité).

### ADR-050 : Miniatures bloc Design — screenshot Playwright ciblé sur artboard (Sprint 82)

- **Contexte** : `get-file-object-thumbnails` retourne `{}` (vide) car Penpot génère les object-thumbnails côté browser client uniquement — ils n'existent pas jusqu'à ce que le client Penpot les uploade. Les stratégies 1 et 2 échouaient systématiquement sur les nouveaux fichiers.
- **Choix** : stratégie 3 via `playwright-core` + Chromium système (`/usr/bin/chromium`) : lancement headless, injection cookie `auth-token`, navigation workspace Penpot (`#/workspace/{projectId}/{fileId}`), détection du premier artboard via `[id^="frame-container-"]`, clip précis sur le bounding rect + 24px padding. Screenshot haute résolution (1920×1080) → resize 800px thumbnail (data URL) + 1600px export (S3 `penpot-exports/{fileId}/export.png`). Fallback sur clip canvas fixe si aucun artboard détecté.
- **Alternatives écartées** : singleton Chromium dans `server.ts` (complexité lifecycle), parser le SVG `#render` (coordonnées SVG ≠ screen coordinates), exporter service Penpot pour thumbnails (conçu pour export format Penpot, pas screenshots).

### ADR-049 : Miniatures bloc Design — data URL via Transit+JSON Penpot (Sprint 81)

- **Contexte** : le bloc Design (Penpot) n'affichait jamais de miniature après fermeture de la modale. L'API `export-thumbnails` retournait `{ thumbnailUrl: "" }` systématiquement.
- **Cause racine** : `rpcCall` utilisait `res.json()` sur les réponses Penpot qui sont en Transit+JSON (`["^ ", key, val, ...]`), pas en JSON standard. `get-file-object-thumbnails` retournait un array Transit interprété comme plain array — `entries[0]` valait `"^ "` (marqueur Transit), pas une URL.
- **Choix** : (1) `fetchThumbnailViaApi` refactorisée avec fetch brut + `parseTransitMap` existant → extraction UUID `~u{id}` → `/assets/by-id/{id}` sur le frontend Penpot (200 image/png confirmé). (2) `exportViaExporter` : extraction `pageId`/`objectId` depuis la clé Transit du map thumbnails (`fileId/pageId/objectId/frame`), suppression de l'appel `get-page` (aussi Transit non parsé). (3) PNG redimensionné à 800px via `sharp` et retourné en data URL → indépendant de S3 pour l'affichage, cohérent avec MindMap. (4) Route `GET /api/attachments/[...key]` pour rétrocompatibilité des clés S3 existantes.
- **Alternatives écartées** : parser Transit complet (surcharge, lib externe), utiliser l'exporteur Puppeteer (non lancé dans la configuration actuelle), pré-signer l'URL S3 (dépendance S3 au rendu, inutile avec data URL).

### ADR-054 : Licence — cache `unstable_cache`, abonnement Stripe récurrent, cron rappels

- **Contexte** : la lecture de licence déclenchait une requête SQL à chaque chargement de page. Le checkout Stripe était en `mode: "payment"` (one-shot), sans gestion du renouvellement ni révocation automatique. Aucun rappel d'expiration n'était envoyé.
- **Choix** : (1) `getLicenseForClient` enveloppé dans `unstable_cache` (TTL 4h, tag "license") — invalidation explicite via `revalidateTag("license")` à l'import et à la révocation. (2) Checkout passé en `mode: "subscription"` avec `STRIPE_PRICE_ID_TEAM` ; trois webhooks gérés : `checkout.session.completed` (création licence, idempotence via `stripeCheckoutSessionId`), `invoice.payment_succeeded` (renouvellement `expiresAt = max(now, expiresAt) + 365j`), `customer.subscription.deleted` (révocation). (3) Scheduler `node-cron` (`"0 8 * * *"`) démarré via `instrumentation.ts` (natif Next.js 16, sans flag expérimental) ; rappels J-30 et J-7, anti-doublon via `lastReminderSentAt`.
- **Alternatives écartées** : Redis pour le cache (overkill en mono-instance, Redis déjà disponible si migration future), Stripe `mode: "payment"` avec renouvellement manuel (perte revenus récurrents), bull/BullMQ pour le cron (dépendance lourde inutile pour un cron quotidien).

### ADR-053 : Prompts IA et templates de documents natifs — pattern builtin (Sprint 94)

- **Contexte** : les prompts IA et les templates de documents étaient uniquement en base de données. Une installation fraîche ne disposait d'aucun contenu par défaut, obligeant l'admin à saisir manuellement tous les prompts avant de pouvoir utiliser le chat, le résumé ou les embeddings. Les templates devaient être importés ou créés un par un.
- **Choix** : (1) `src/lib/ai/builtin-prompts.ts` — constantes TypeScript exportant `BUILTIN_PROMPTS[]` avec les prompts opérationnels (chat RAG, résumé doc, résumé réunion, embeddings, playground). `prompt-resolver.ts` cherche d'abord en BDD puis retombe sur le builtin correspondant. (2) `src/lib/templates/builtin.ts` — même pattern pour les templates : Markdown (comptes-rendus, fiches, rapports) et `database` (nom + colonnes prédéfinies). `GET /api/templates` fusionne BDD + builtins en excluant les noms déjà présents. (3) `POST /api/databases` accepte un paramètre `columns` optionnel pour créer directement une base avec le schéma du template. (4) Le template picker détecte `content.database` et crée un `DatabaseBlock` au lieu d'insérer du Markdown.
- **Alternatives écartées** : seed SQL obligatoire au premier démarrage (ordre d'exécution fragile, perd les modifications admin), fichiers JSON chargés à froid (pas typés, pas validés au build), migrations Drizzle avec données initiales (mélange schéma et données métier).

### ADR-052 : Tableau de bord Services — composant ServiceCard et extension health endpoint (Sprint 92)

- **Contexte** : la page Admin → Services était une page de configuration LiveKit monolithique, illisible une fois le nombre de modules internes grandissant. L'endpoint `/api/admin/services/health` ne couvrait que LiveKit, Whisper, Voxtral et Ollama (services IA externes).
- **Choix** : (1) Grille de 8 `ServiceCard` réutilisables avec poll health 30s — séparation claire entre modules toggleables (LiveKit, Collab, Salles, LDAP, IA) et modules auto-détectés (Whisper, Email, Backup). (2) Prop `onToggle?: () => void` — `undefined` masque le toggle et affiche la pill "Auto-détecté" pour les modules sans activation manuelle. (3) `isFrenchHoliday()` corrigée pour utiliser `getFullYear/getMonth/getDate` (heure locale) au lieu de `toISOString()` (UTC), qui décalait la date d'un jour en UTC+1/+2.
- **Alternatives écartées** : toggle pour tous les modules même en lecture seule (trompeur), merge config + dashboard dans la même page (contraire à l'objectif lisibilité).

### ADR-056 : Multi-organisations (Sprint ~92)

- **Contexte** : LorIAx était mono-organisation implicite. Pour supporter plusieurs clients sur une même instance (SaaS ou self-hosted multi-tenant), une isolation par organisation était nécessaire.
- **Décision** : migration vers un modèle multi-tenant avec :
  - Table `organizations` (slug unique, plan, quotas)
  - Table pivot `organization_members` (owner/admin/member)
  - Colonnes `organization_id` sur `spaces`, `teams`, `ai_providers`, `webhooks`
  - Résolution de l'org depuis le sous-domaine (`acme.loriax.app`) ou le path (`/org/acme/`), fallback `default`
  - Header `x-org-slug` propagé par le middleware à tous les handlers
  - Helper `getOrgId(slug)` avec cache 60s
- **Conséquences** :
  - Chaque requête DB filtre par `organizationId`
  - Nouvelle interface admin `/admin/organizations` (super_admin uniquement)
  - Variable d'env `NEXT_PUBLIC_ROOT_DOMAIN` requise pour le mode sous-domaine
  - Migration progressive en 3 fichiers SQL (0012–0014) sans downtime
  - Hors périmètre : isolation S3/git par org, facturation par org

### ADR-057 : Composant EmptyState unifié + animations CSS globales (Sprint 96)

- **Contexte** : les empty states étaient dispersés dans chaque page avec du HTML inline non cohérent. L'interface IA manquait de feedback visuel (shimmer loading, typing indicator).
- **Décision** : créer un composant `EmptyState` partagé (`src/components/ui/empty-state.tsx`) avec props `icon/title/description/action/size`. Toutes les animations CSS (`es-float`, `shimmer`, `typing-dot`, `prompt-glow`) centralisées dans `globals.css` pour éviter l'injection répétée de balises `<style>` dans le DOM.
- **Conséquences** :
  - 4 pages utilisent `EmptyState` (dashboard, espace/dossier, recherche, résumé IA)
  - `AISummaryPanel` : `SummaryShimmer` utilise les classes globales `shimmer-line`
  - Page chat IA : `TypingIndicator` utilise les classes globales `typing-dot`, prompt box utilise `.prompt-input:focus`
  - Zéro nouvelle dépendance externe

### ADR-058 : Enrichissement bibliothèque de templates — 7 nouveaux modèles métier (Sprint 97)

- **Contexte** : la bibliothèque de templates couvrait bien les cas génériques (CR réunion, fiche projet, rapport) mais manquait de modèles métier courants dans un contexte organisationnel : réunion d'équipe interne, suivi commercial, pilotage agile, bases de données RH/CRM/achats.
- **Décision** : ajouter 7 templates dans `scripts/seed-templates.ts`, appliqués via le script idempotent existant : (1) 4 templates Markdown — CR réunion interne (🔒, catégorie réunion), Suivi client (🏢, commercial), TOP 5 hebdo (🎯, réunion), Sprint Meeting (🏃, projet) ; (2) 3 templates DatabaseBlock — Base de données clients (8 colonnes + select Prospect/Actif/Inactif/Archivé), Base de données utilisateurs (7 colonnes + select statut), Base de données fournisseurs (8 colonnes + select étoiles). Le template-picker était déjà capable de gérer `content.database` (ADR-053) — aucune modification de code UI requise.
- **Conséquences** :
  - 34 templates au total en base (seed idempotent — `⏭` si déjà présent)
  - Nouvelle catégorie « base de données » visible dans le picker
  - Zéro migration BDD, zéro nouveau composant

### ADR-059 : Robustesse API meeting-rooms + vérification migrations au démarrage dev (Sprint 98)

- **Contexte** : les méthodes PATCH et DELETE de `/api/meeting-rooms/[id]` et la méthode GET de `/api/meeting-rooms/[id]/bookings` n'avaient pas de try/catch — une erreur DB retournait une réponse HTML 500 non structurée. Le client UI affichait alors un message générique ("Erreur de création") au lieu du détail serveur. Par ailleurs, les développeurs démarrant l'app sans avoir lancé les migrations ne recevaient aucune alerte.
- **Décision** : (1) Entourer toutes les requêtes DB des routes PATCH, DELETE (salle) et GET, POST (réservations) d'un try/catch retournant `{ error: message }` au format JSON, cohérent avec le pattern POST existant. (2) Dans `meeting-rooms-tab.tsx`, la suppression extrait maintenant `data.error` au lieu de lancer une erreur générique. (3) Dans `instrumentation.ts`, en mode `development`, interroger `information_schema.tables` au démarrage et logguer un `console.warn` listant les tables manquantes parmi `users, spaces, documents, templates, system_settings`. Le bloc est silencieux si la BDD est inaccessible (Docker non démarré).
- **Conséquences** :
  - Erreurs DB meeting-rooms remontées proprement jusqu'à l'UI
  - Développeurs alertés si `npm run db:migrate` n'a pas été exécuté
  - Aucun impact en production (`NODE_ENV !== "development"`)

### ADR-060 : Messagerie live — ChatServer WebSocket, schéma chat, notifications et rétention (Sprint 99)

- **Contexte** : LorIAx disposait déjà d'un serveur WebSocket Hocuspocus (`/ws/collab`) et d'un système de notifications en base. L'objectif était d'ajouter une messagerie temps réel (style Slack) sans dépendance externe, en réutilisant la même infrastructure.
- **Décision** :
  - (1) `ChatServer` (`src/lib/chat/chat-server.ts`) monté dans `server.ts` sur le path `/ws/chat`, en parallèle de Hocuspocus. Authentification WS : le client envoie `{ type: "auth", token }` via un JWT court (60s) obtenu sur `/api/auth/ws-token`  ; connexion fermée si délai > 5s ou token invalide. Fan-out mémoire : `Map<channelId, Set<AuthedWs>>` + `Map<userId, AuthedWs>`. Trois types de messages : `message`, `typing` (debounce 2s), `read`.
  - (2) Migration `0015_chat.sql` : tables `chat_channels` (type enum `direct/team/space`), `chat_channel_members` (clé composite + `last_read_at` pour le compteur non-lu), `chat_messages` (soft delete via `deleted_at`). Index `(channel_id, created_at DESC)` pour la pagination.
  - (3) Auto-création de canaux : hooks post-création d'équipe et d'espace (`src/lib/chat/channel-hooks.ts`), appelés depuis les routes API correspondantes.
  - (4) API REST complémentaire : `GET /api/chat/channels` (liste + compteurs non-lus via `COALESCE(last_read_at, '-infinity'::timestamptz)`), `GET /api/chat/channels/[id]/messages` (pagination curseur `?before=<createdAt>&limit=50`), `POST /api/chat/channels/direct`, `PATCH/DELETE /api/chat/messages/[id]`, `POST /api/chat/messages/[id]/pour`.
  - (5) "Verser dans document" : la route `/pour` retourne un nœud TipTap `blockquote` avec attributs `data-chat-*`. L'éditeur (`loriax-editor.tsx`) écoute l'événement DOM `loriax:insert-block` et insère le nœud via `editor.commands.insertContent()`.
  - (6) Notifications : `notifyChannelMembers()` insère des notifications in-app pour les membres hors ligne ; `sendChatDigests()` envoie un email récapitulatif quotidien (cron croner `0 8 * * *`). Rétention configurable via `system_settings` (`chat_retention_days`, défaut 365) ; cron quotidien à 3h00 supprime les messages expirés.
- **Alternatives écartées** : Socket.io (dépendance externe, polling fallback inutile en self-hosted), Redis pub/sub inter-instances (hors périmètre mono-instance, prévu si `REDIS_URL` présent), stockage de messages dans Yjs (mauvaise séparation des responsabilités).
- **Conséquences** :
  - `src/lib/chat/` (5 fichiers), `src/app/api/chat/` (6 routes), `src/components/chat/` (7 composants), `src/hooks/use-chat-ws.ts`
  - Variable d'env `NEXTAUTH_SECRET` déjà requise, réutilisée pour signer les JWT WS
  - Colonne `organization_id` sur `chat_channels` — isolation multi-tenant native
  - Interface admin `GET/PUT /api/admin/chat/retention` pour configurer la rétention

### ADR-060 : Présence et statut utilisateurs (2026-05-08)

- **Contexte** : Besoin d'afficher le statut en temps réel des membres d'équipe (en ligne, en pause, hors ligne) en tenant compte de l'emploi du temps CalDAV pour déduire la disponibilité.
- **Décision** :
  - (1) Table `user_status` (un row par user) avec `last_seen` (timestamptz), `status` enum (`online/away/offline/dnd`), champs custom JSONB pour extensibilité future. Index sur `last_seen` pour les requêtes d'expiration.
  - (2) Polling côté client 30s via SWR pour `GET /api/team/status` + heartbeat 60s pour `PATCH /api/me/status`. Réduction des appels via ETag et gestion du cache SWR (déduplication automatique).
  - (3) `effectiveStatus` déduit côté serveur : `last_seen` (seuils 3 min = away, 10 min = offline) + vérification CalDAV si `status !== dnd`. CalDAV via requêtes Drizzle directes sur `calendar_events` (pas de protocole CalDAV lourd, récupération événements du jour courant).
  - (4) Statut `absent` = weekend OU événement all-day couvrant le jour courant (détection via `start_date <= TODAY AND end_date >= TODAY`).
  - (5) API `PATCH /api/me/status` accepte `{ status, customMessage? }` — permet l'override manuel, invalide après 8h (reconnexion requise pour remettre à jour).
- **Alternatives écartées** :
  - Hocuspocus awareness global : état éphémère stocké dans Yjs (perte au rechargement), pas d'intégration CalDAV native.
  - SSE (Server-Sent Events) : infrastructure supplémentaire injustifiée pour un polling 30s accepté en UX.
  - Redis pub/sub : complexité multi-instance non requise en mono-instance.
- **Conséquences** :
  - +1 table (`user_status`)
  - +2 API routes (`GET /api/team/status`, `PATCH /api/me/status`)
  - +2 hooks React (`useUserStatus`, `useTeamStatus`)
  - +3 composants (`UserStatusBadge`, `TeamStatusGrid`, `StatusIndicator`)
  - Seed mis à jour : données de démo incluent statuts variés
  - Colonne `organization_id` sur `user_status` — isolation multi-tenant native

## ADR-061 — Attribution des tâches

**Date :** 2026-05-08  
**Statut :** Adopté

### Contexte
LorIAx possède deux surfaces de tâches : les `taskItem` TipTap dans les documents et les événements Gantt dans le calendrier. Besoin d'assigner un responsable et d'avoir une vue "Mes tâches".

### Décision
Table unifiée `tasks` avec `kind` (`document_item` | `gantt_event`). Les tâches inline TipTap sont synchronisées vers la BDD via `POST /api/tasks/sync-document` (déclenché à chaque sauvegarde, debounce 2 s). Les tâches Gantt sont créées/mises à jour via `PATCH /api/events/[id]`. La page `/tasks` agrège les deux via `GET /api/tasks/my`.

### Conséquences
- Un seul modèle de requête pour "Mes tâches"
- Extension `TaskItemAssignable` remplace `TaskItem` dans l'éditeur
- Notifications `task_assigned` via `createNotification` existant
- Co-responsables laissés hors périmètre (sprint ultérieur)

## ADR-062 — @ai-sdk/openai v3 : Chat Completions vs Responses API

**Date :** 2026-05-09  
**Statut :** Adopté

### Contexte
Après la mise à jour vers `@ai-sdk/openai` v3, l'assistant IA ne répondait plus à partir du deuxième message de la conversation. La première réponse fonctionnait, mais les suivantes retournaient un stream 200 OK vide.

### Cause racine
Dans `@ai-sdk/openai` v3, `provider.languageModel()` crée toujours un `OpenAIResponsesLanguageModel` (API Responses, `POST /v1/responses`). La réponse du modèle inclut un `providerMetadata: {openai: {itemId: "msg_xxx"}}`. Lors du second message, `convertToModelMessages` préserve ce `providerMetadata` comme `providerOptions` dans l'historique — le SDK l'interprète comme un contexte Responses API et tente `POST /v1/responses`. Ollama (et tout provider `openai_compatible`) ne supporte que `POST /v1/chat/completions` → le stream échoue silencieusement.

L'option `compatibility: "compatible"` ne contourne pas ce routage : `languageModel()` pointe toujours vers `createResponsesModel()` indépendamment de ce paramètre.

### Décision
Ajouter un champ `connectorType` (`"anthropic" | "mistral" | "openai_compatible"`) dans `ResolvedProvider`. Dans `getLanguageModelForUsage`, utiliser `provider.chat(model)` (Chat Completions) pour les providers `openai_compatible`, et `provider.languageModel(model)` pour Anthropic et Mistral (APIs natives).

### Alternatives écartées
- Stripping du `providerMetadata` côté route : fragile, dépend du format interne du SDK.
- Downgrade `@ai-sdk/openai` v2 : introduit une dette de mise à jour.

### Conséquences
- Les providers Ollama/LM Studio/OpenAI-compatible fonctionnent correctement en multi-tours
- Les providers natifs (Anthropic, Mistral) conservent leur intégration d'origine
- Extension future : ajouter `connectorType: "openai_native"` si un provider OpenAI natif veut la Responses API

## ADR-063 — Preset Terminal : thème global via `data-preset` sur `<html>`

**Date :** 2026-05-10  
**Statut :** Adopté

### Contexte
Ajouter un preset d'apparence "Terminal" (phosphore CRT rétro-futuriste) qui s'applique à l'ensemble de l'application — sidebar, topbar, éditeur — et non uniquement à l'éditeur TipTap. Le système de presets existant fonctionnait via des CSS custom properties injectées dynamiquement sur `:root`, limitées aux tokens de la charte graphique normale.

### Décision
Utiliser un attribut `data-preset="terminal"` posé directement sur `document.documentElement` (`<html>`). Les sélecteurs CSS `html[data-preset="terminal"]` surchargent **tous** les tokens shadcn/ui et loriax en une seule passe CSS statique dans `globals.css`. Les effets CRT (scanlines, beam vertical, glitch) sont contrôlés par des attributs complémentaires (`data-glitch`, `data-scan-vertical`) et une CSS var (`--terminal-scan-opacity`). Un pseudo-élément `::before` fixe en `z-index: 9998` applique le filtre scanlines + vignette sans perturber le DOM applicatif.

### Alternatives écartées
- **Classe CSS sur `<body>`** : ciblage moins direct, conflits potentiels avec les classes Tailwind utilitaires.
- **Theme provider React** : contexte additionnel, re-renders, ne couvre pas les portails hors de l'arbre React.
- **CSS-in-JS** : incompatible avec l'approche statique Tailwind CSS 4 du projet.

### Conséquences
- Le preset Terminal ne suit pas le pipeline normal (`applyAppearancePrefs` retourne immédiatement après avoir posé `data-preset`) : les contrôles d'apparence individuels n'ont aucun effet visuel et sont masqués dans l'UI
- `AppearanceProvider` doit détecter `specialMode: "terminal"` au démarrage pour éviter un flash du thème par défaut
- Extension future : d'autres presets "spéciaux" peuvent utiliser le même pattern `data-preset="<nom>"` avec leur propre bloc CSS

## ADR-064 — Alias des commandes slash : variable module-level + `system_settings` JSONB

**Date :** 2026-05-10  
**Statut :** Adopté

### Contexte
Les commandes slash TipTap sont définies statiquement à l'initialisation de l'extension. Les options de suggestion (`items`, `render`) sont fixées lors de la création du plugin ProseMirror et ne peuvent pas être mises à jour sans réinitialiser l'éditeur. Or les alias doivent être chargeables dynamiquement depuis l'API admin.

### Décision
Utiliser une **variable module-level** `_customAliases` dans `slash-extension.tsx`. La fonction `setCustomAliases()` (exportée) met à jour cette variable à n'importe quel moment ; la fonction `getEffectiveAliases(title)` est appelée à chaque frappe dans la liste `items`, lisant toujours la valeur courante. Les alias personnalisés sont stockés dans `system_settings` (JSONB, clé `slash_command_aliases`) et chargés via un `useEffect` dans `LorIAxEditor` au montage. La source de vérité des défauts est l'export `defaultAliases` dans `commands.tsx`.

### Alternatives écartées
- **Options Tiptap** : les options sont gelées à la création de l'extension, pas de mise à jour sans recréer l'éditeur.
- **Contexte React** : les extensions TipTap vivent hors de l'arbre React, inaccessibles au contexte.
- **Table dédiée** : `system_settings` JSONB suffit pour un nombre fixe de clés admin, évite une migration de schéma.

### Conséquences
- Les alias sont effectifs dès le premier appui sur `/` après le chargement de l'éditeur (latence API négligeable)
- L'admin peut remplacer entièrement les alias d'une commande ou revenir aux défauts commande par commande
- Si la clé `slash_command_aliases` n'existe pas en base, les défauts s'appliquent silencieusement

## ADR-065 — Proxy unifié des banques d'images : adaptateurs + chiffrement clé API

**Date :** 2026-05-10  
**Statut :** Adopté

### Contexte
LorIAx doit permettre de rechercher des images depuis plusieurs fournisseurs (Unsplash, Pexels, Pixabay, Shutterstock, Getty). Chaque fournisseur a une API différente (structures de réponse, auth, URL). Les clés API sont sensibles et doivent être stockées chiffrées.

### Décision
Un **proxy unifié** `GET /api/images/search?provider=X&q=Y&page=N` est exposé côté serveur. Il dispatch vers des **adaptateurs** (`src/lib/images/`) qui normalisent les réponses vers `ImageSearchResult`. Les clés API sont chiffrées en base (`apiKeyEnc`) via `src/lib/crypto`. La fallback `UNSPLASH_ACCESS_KEY` env est scoped uniquement à Unsplash. Le tracking de téléchargement Unsplash (obligation légale API) se fait via un endpoint séparé `GET /api/studio/unsplash/track`.

### Alternatives écartées
- **Appels directs depuis le client** : expose les clés API dans le bundle front.
- **Un endpoint par fournisseur** : duplication de la logique d'auth, de la vérification de session et du chiffrement.

### Conséquences
- Ajouter un nouveau fournisseur = créer un adaptateur dans `src/lib/images/adapters.ts` et ajouter une branche dans `/api/images/search/route.ts`
- Les clés API ne transitent jamais côté client
- Le fallback env `UNSPLASH_ACCESS_KEY` reste utilisable pour les démos sans BDD configurée

## ADR-066 — Éditeur vidéo/son : FFmpeg.wasm (client) + fluent-ffmpeg (serveur) + file `video_jobs`

**Date :** 2026-05-10  
**Statut :** Adopté

### Contexte
LorIAx avait besoin d'un éditeur vidéo/son auto-hébergé, sur le modèle de Kapwing, sans service séparé à maintenir.

### Décision
Architecture intégrée dans loriax-app : **`@ffmpeg/ffmpeg` (WASM)** pour les previews trim temps réel côté client (isolé derrière COEP/COOP), **`fluent-ffmpeg` + `ffmpeg-static`** pour l'export MP4 côté serveur via un worker async (`startRenderWorker()` au démarrage de `server.ts`). La file d'attente est la table `video_jobs` (Drizzle), avec polling toutes les 5 secondes côté client. L'état de la timeline (`TimelineData`) est stocké en `jsonb` dans `video_projects`. L'upload des sources se fait directement vers Garage S3 via URL signée PUT (bypass de la limite corps Next.js). Le proxy Pexels Vidéo télécharge les clips côté serveur (protection SSRF, limite 500 Mo, AbortController 60 s).

### Alternatives écartées
- **Service rendu séparé** : overhead infra, complexité déploiement Dokploy.
- **Re-encode côté client uniquement** : impossible pour les exports longue durée (dépasse la mémoire WASM).

### Conséquences
- COEP/COOP activés uniquement sur `/video-editor/*` (évite de casser le reste de l'app)
- Le worker n'est pas concurrent-safe en multi-instance (acceptable pour déploiement mono-nœud Dokploy)
- La migration `0017_sweet_betty_ross.sql` doit être appliquée (`npm run db:migrate`) avant utilisation

## ADR-067 — Purge Penpot : intégration trop couplée, remplacée par design-canvas agnostique

**Date :** 2026-05-10  
**Statut :** Adopté

### Contexte
L'intégration Penpot (Docker, API, service, hook, table `penpot_mappings`) était maintenue mais non utilisée. Elle ajoutait de la complexité et des dépendances de déploiement.

### Décision
Suppression complète de tout ce qui référençait Penpot. Les classes CSS `penpot-block-*` ont été renommées `editor-block-*` (neutres). La table `penpot_mappings` et sa migration ont été supprimées. Le bloc éditeur `design-canvas` reste intact (agnostique du backend de design).

### Conséquences
- Déploiements Dokploy existants : supprimer le service Penpot du `docker-compose`
- Aucun impact fonctionnel côté utilisateur (le bloc Studio était déjà autonome)

## ADR-068 — Proxy CORS pour images externes dans le Studio (canvas taché)

**Date :** 2026-05-11  
**Statut :** Adopté

### Contexte
Charger une image cross-origin directement dans un `<canvas>` Fabric.js (via `FabricImage.fromURL(..., { crossOrigin: "anonymous" })`) tache le canvas si le serveur tiers ne renvoie pas `Access-Control-Allow-Origin`. Tout appel ultérieur à `canvas.toDataURL()` lève alors `SecurityError: The operation is insecure`. Les banques d'images (Pexels, Pixabay, Shutterstock, Getty) ne garantissent pas ces headers CORS.

### Décision
Ajout de `GET /api/images/proxy?url=...` (`src/app/api/images/proxy/route.ts`) : endpoint serveur qui fetche l'image côté Next.js et la renvoie avec `Access-Control-Allow-Origin: *`. La fonction `resolveImageUrl()` dans `design-canvas.tsx` redirige automatiquement toute URL externe vers ce proxy ; les data-URIs, URLs locales et S3 passent directement. Une allowlist de domaines autorisés et `isPrivateUrl()` protègent contre le SSRF.

### Conséquences
- Plus de `SecurityError` lors de l'export ou de la miniature du canvas Studio
- Latence légèrement supérieure pour la première insertion (double requête : client → proxy → CDN tiers)
- Tout nouveau domaine d'image doit être ajouté à l'allowlist dans `proxy/route.ts`

## ADR-070 — Architecture SaaS multi-tenant via sous-domaines `*.loriax.fr`

**Date :** 2026-05-11
**Statut :** Planifié (spec + plan écrits, implémentation à venir)

### Contexte
LorIAx était mono-tenant (une instance par client). Pour proposer une offre hébergée (freemium, self-service signup), il faut une architecture multi-tenant : plusieurs organisations sur une même instance, isolées par sous-domaine.

### Décision
Chaque organisation reçoit un sous-domaine `slug.example.tld` (configurable via `NEXT_PUBLIC_ROOT_DOMAIN`). Le middleware (`src/middleware.ts`) résout le slug via `resolveOrgSlug()`. La session NextAuth est scoped sur le domaine racine pour être valide sur tous les sous-domaines. L'inscription est atomique (`POST /api/auth/register-org`) : user + org + membership + espace "Général" en une transaction Drizzle. Le certificat wildcard est géré par Traefik avec le challenge DNS-01 (exemple : provider lego Infomaniak).

### Conséquences
- L'instance unique sert toutes les orgs — économie de ressources VPS
- `NEXTAUTH_COOKIE_DOMAIN=<domaine racine>` casse le déploiement mono-tenant local si activé par erreur — laisser vide en dev
- Les plans (free/starter/pro/team) sont définis dans `src/lib/billing/plans.ts` — source de vérité unique
- La synchronisation des plans/abonnements avec un service de facturation externe (optionnel, non distribué) se fait via webhook ; sans ce service, les hooks `src/lib/billing/*` restent inactifs.


