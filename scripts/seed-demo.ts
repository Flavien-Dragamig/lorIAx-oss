/**
 * Seed démo "InnoDev" — contenu pseudo-réel pour démos et captures
 *
 * Crée :
 *  - 5 utilisateurs fictifs InnoDev (en plus du couple admin/user)
 *  - 1 espace équipe "InnoDev" avec dépôt git initialisé
 *  - ~13 documents inter-liés via wiki-links
 *  - 1 base de données utilisateur "Clients InnoDev" (5 colonnes, 10 lignes)
 *  - 1 calendrier équipe + événements de la semaine (dont 2 visios)
 *  - 2 réunions visio LiveKit reliées aux événements
 *  - Réservations de salles pour les événements présentiels
 *  - 8 tâches assignées aux membres
 *
 * Idempotent : ne fait rien si l'espace "InnoDev" existe déjà.
 *
 * Prérequis : seed-dev-users.ts (admin@loriax.dev) + seed-meeting-rooms.ts (Salle Atlas/Mercure)
 *
 * Usage : npm run db:seed:demo
 */
import { db } from "../src/lib/db";
import {
  users,
  spaces,
  spacePermissions,
  documents,
  documentLinks,
  calendars,
  calendarEvents,
  calendarEventAttendees,
  meetings,
  meetingRooms,
  meetingRoomBookings,
  userDatabases,
  userDatabaseColumns,
  userDatabaseRows,
  tasks,
  systemSettings,
} from "../src/lib/db/schema";
import { organizations, organizationMembers } from "../src/lib/db/schema-org";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { initRepository, commitFile } from "../src/lib/git/repository";
import { writeDocument } from "../src/lib/storage/filesystem";
import { parseWikiLinks } from "../src/lib/graph/links";

const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const TEAM_SPACE_SLUG = "innodev";

const DEMO_USERS = [
  { id: "00000000-0000-0000-0000-000000000101", email: "marie.lambert@innodev.dev", name: "Marie Lambert", role: "editor" as const },
  { id: "00000000-0000-0000-0000-000000000102", email: "thomas.bernard@innodev.dev", name: "Thomas Bernard", role: "editor" as const },
  { id: "00000000-0000-0000-0000-000000000103", email: "sophie.roux@innodev.dev", name: "Sophie Roux", role: "editor" as const },
  { id: "00000000-0000-0000-0000-000000000104", email: "leo.martin@innodev.dev", name: "Léo Martin", role: "editor" as const },
  { id: "00000000-0000-0000-0000-000000000105", email: "elodie.petit@innodev.dev", name: "Élodie Petit", role: "editor" as const },
];

interface DemoDoc {
  title: string;
  slug: string;
  content: string;
  createdBy: string;
}

const docs: DemoDoc[] = [
  {
    title: "Manuel d'accueil InnoDev",
    slug: "manuel-accueil",
    content: `# Bienvenue chez InnoDev

InnoDev est une startup parisienne fondée en 2022 spécialisée dans les plateformes de connaissance d'entreprise.
Nous sommes une équipe pluridisciplinaire de 18 personnes répartie entre Paris (siège) et Lyon (annexe).

## Premiers pas

1. Lis le [[onboarding-ingenieur|guide d'onboarding ingénieur]] (ou demande le tien à ton manager).
2. Consulte la [[politique-teletravail|politique de télétravail]] pour comprendre nos rythmes hybrides.
3. Découvre notre [[roadmap-2026|roadmap produit 2026]] et nos objectifs trimestriels.
4. Familiarise-toi avec l'[[architecture-technique|architecture technique]] de la plateforme.

## Valeurs

- **Frugalité** — chaque ligne de code et chaque dépendance se justifient.
- **Transparence** — décisions documentées dans cet espace.
- **Soin** — qualité visuelle et accessibilité avant tout.

## Référents

- Direction : Flavien (CEO)
- Produit : Marie Lambert
- Ingénierie : Thomas Bernard
- Design : Sophie Roux
- Commercial : Léo Martin
- RH & Office : Élodie Petit

Voir aussi : [[charte-graphique]] · [[plan-continuite]] · [[procedure-incident-securite]]
`,
    createdBy: ADMIN_ID,
  },
  {
    title: "Roadmap produit 2026",
    slug: "roadmap-2026",
    content: `# Roadmap produit 2026

Document de pilotage produit — mis à jour mensuellement par [[manuel-accueil|Marie Lambert]].

## T1 2026 — Fondations
- Refonte de l'éditeur collaboratif (TipTap v3).
- Système de permissions granulaires par classification.
- Migration des embeddings vers pgvector 0.7.

## T2 2026 — Expansion (en cours)
- Visio LiveKit + transcription Whisper temps réel.
- Plateforme de bases de données utilisateur (style Notion).
- Module de gestion des salles physiques — voir [[plan-continuite]].
- Marketplace de templates partagés.

## T3 2026 — Verticalisation
- Conformité ISO 27001 — voir [[procedure-incident-securite]].
- Plugin Microsoft 365 + Google Workspace.
- Tarification entreprise sur mesure.

## T4 2026 — Scale
- Multi-régions FR + UE.
- Backups différentiels chiffrés AES-256.
- Programme de partenariats intégrateurs.

## Indicateurs clés
- MRR cible : 180 k€ fin 2026.
- NPS produit : > 60.
- Disponibilité : 99,95 %.

Voir : [[strategie-commerciale-q2]] · [[comex-12-mai]]
`,
    createdBy: "00000000-0000-0000-0000-000000000101",
  },
  {
    title: "Charte graphique",
    slug: "charte-graphique",
    content: `# Charte graphique InnoDev

Sources d'inspiration : éditeurs minimalistes (Linear, Notion) avec une touche éditoriale française.

## Couleurs

| Rôle | Hex | Usage |
|---|---|---|
| Primaire | \`#1f3a5f\` | Boutons, liens actifs |
| Accent | \`#f59e0b\` | Mises en avant, badges |
| Fond clair | \`#fafaf7\` | Surface principale |
| Texte | \`#0f172a\` | Corps de texte |
| Erreur | \`#dc2626\` | Avertissements |

## Typographies

- **Display** : Inter Tight, semi-bold, -0.02em.
- **Corps** : Inter, 16px, line-height 1.6.
- **Mono** : JetBrains Mono, 14px.

## Logo

Le logo "InnoDev" se compose du wordmark Inter Tight Bold + d'un symbole "I" inscrit dans un carré arrondi.
Voir la maquette dans la [[presentation-logo|présentation logo]].

## Iconographie

Icônes Lucide à 1.5px de trait. Pas d'icônes pleines sauf pour les indicateurs d'état.

Voir aussi : [[manuel-accueil]] · [[architecture-technique]]
`,
    createdBy: "00000000-0000-0000-0000-000000000103",
  },
  {
    title: "Processus de recrutement",
    slug: "processus-recrutement",
    content: `# Processus de recrutement

Notre processus est court et respectueux — 5 étapes maximum sur 2 semaines.

## Étapes

1. **Candidature** — lecture sous 48h ouvrées par [[manuel-accueil|Élodie Petit]].
2. **Échange découverte** — 30 min visio avec le manager.
3. **Étude de cas** — exercice asynchrone de 2h max, jamais de travail gratuit.
4. **Restitution** — 1h avec 2 collègues du futur métier.
5. **Échange culture & rémunération** — 45 min avec Flavien.

## Postes ouverts T2 2026

- Ingénieur·e logiciel senior (back Node/TypeScript) — voir [[onboarding-ingenieur]].
- Designer produit confirmé·e — voir [[charte-graphique]].
- Account executive France — voir [[strategie-commerciale-q2]].

## Politique
- Salaires publiés dès la 1ère annonce.
- Décision finale sous 5 jours après la dernière étape.
- Feedback systématique aux candidat·es non retenu·es.

Voir : [[politique-teletravail]]
`,
    createdBy: "00000000-0000-0000-0000-000000000105",
  },
  {
    title: "Politique de télétravail",
    slug: "politique-teletravail",
    content: `# Politique de télétravail

InnoDev fonctionne en **mode hybride équilibré** : 2 jours bureau / 3 jours libres par défaut.

## Règles

- Jours d'ancrage : **mardi** et **jeudi** au bureau pour favoriser les rituels d'équipe.
- Télétravail intégral possible 4 semaines / an (à poser en avance).
- Indemnité forfaitaire de 60 €/mois pour l'équipement domicile.
- Outils : LorIAx pour la connaissance, Linear pour les tâches, Slack pour la conversation.

## Réunions

- Toute réunion > 3 participants est **enregistrée et transcrite** automatiquement (voir [[architecture-technique]]).
- Les comptes rendus sont déposés dans l'espace InnoDev (voir [[comex-12-mai]]).

## Bureaux

- Paris : 12 rue du Faubourg, 75010 — Salle Atlas et Salle Mercure (cf. [[plan-continuite]]).
- Lyon : Espace de coworking Anticafé — places négociées pour 6 personnes.

Voir aussi : [[manuel-accueil]] · [[processus-recrutement]]
`,
    createdBy: "00000000-0000-0000-0000-000000000105",
  },
  {
    title: "Architecture technique",
    slug: "architecture-technique",
    content: `# Architecture technique

> Document maintenu par [[manuel-accueil|Thomas Bernard]]. Dernière revue : 2026-05-10.

## Vue d'ensemble

\`\`\`
Front  : Next.js 16 App Router + React 19 + TypeScript
Back   : Routes Next + WebSocket Hocuspocus + isomorphic-git
BDD    : PostgreSQL 16 + pgvector + Drizzle ORM
S3     : Garage (Deuxfleurs) — sécurisé, FR, AGPL-3.0
IA     : Vercel AI SDK multi-provider (Claude, OpenAI, Ollama)
Visio  : LiveKit + transcription Whisper
\`\`\`

## Choix structurants

1. **Frugalité d'abord** — pas de Kafka, pas de microservices, pas de cloud lock-in.
2. **Fichiers Markdown comme base** — versionning git par espace, durable.
3. **Sécurité par défaut** — classification documentaire, SSRF, CSP nonce, rate limiting.
4. **Auto-hébergement** — Docker Compose + Dokploy + Traefik.

## Modules clés

- **Éditeur TipTap** : extensions custom dans \`src/components/editor/extensions/\`.
- **Graphe de liens** : parsing \`[[wiki-link]]\` (cf. [[onboarding-ingenieur]]).
- **Studio** : canvas vectoriel + presets ; canvas stocké sur S3.
- **Bases de données utilisateur** : tables \`user_databases\` / \`columns\` / \`rows\`.

## Sécurité & sauvegardes

- Backups quotidiens chiffrés vers Backblaze B2 (cf. [[plan-continuite]]).
- Réponse aux incidents : [[procedure-incident-securite]].

Voir : [[charte-graphique]] · [[roadmap-2026]]
`,
    createdBy: "00000000-0000-0000-0000-000000000102",
  },
  {
    title: "Plan de continuité d'activité",
    slug: "plan-continuite",
    content: `# Plan de continuité d'activité (PCA)

Objectif : reprise complète de service en moins de 4h après un incident majeur.

## Scénarios couverts

| Scénario | RTO | RPO | Procédure |
|---|---|---|---|
| Panne base de données | 1h | 5 min | Restauration depuis B2 + replay WAL |
| Incendie data center | 4h | 1h | Re-déploiement Dokploy sur VPS de secours Hetzner |
| Compromission credentials | 30 min | 0 | Rotation immédiate + invalidation JWT |
| Cyber-attaque DDoS | 15 min | 0 | Bascule Cloudflare + rate-limit Traefik |

## Responsables d'astreinte

- **Astreinte technique** : Thomas Bernard (voir [[architecture-technique]]).
- **Astreinte communication** : Marie Lambert.
- **Astreinte clients** : Léo Martin.

## Exercices

- Test de restauration mensuel le 3ᵉ vendredi.
- Exercice complet trimestriel (voir [[comex-12-mai]]).

## Locaux secours

En cas d'indisponibilité du siège, repli sur l'espace de coworking Anticafé (12 places, équipé visio).
Bureaux principaux : Salle Atlas et Salle Mercure (cf. [[politique-teletravail]]).

Voir : [[procedure-incident-securite]]
`,
    createdBy: "00000000-0000-0000-0000-000000000102",
  },
  {
    title: "Onboarding ingénieur logiciel",
    slug: "onboarding-ingenieur",
    content: `# Onboarding ingénieur logiciel

> Compagnon de la première semaine — préparé par [[architecture-technique|Thomas Bernard]].

## Jour 1 — Setup

- Compte créé sur LorIAx (admin Élodie).
- Clé SSH ajoutée à GitHub + Dokploy.
- Onboarding sécurité : 1Password, 2FA, signature commits GPG.
- Café avec ton parrain de pair-programming.

## Jour 2 — Découverte produit

- Lecture de la [[roadmap-2026]] et du [[manuel-accueil]].
- Tour rapide du repo : structure du code (\`src\`, \`docker\`, \`scripts\`, \`docs\`).
- Première pull request : correction d'un bug mineur étiqueté \`good-first-issue\`.

## Jour 3-5 — Immersion

- Pair-prog sur un sprint en cours.
- Lecture des ADR (Architecture Decision Records).
- Démo de l'éditeur TipTap et des slash commands custom.

## Conventions de code

- Branches : \`type/scope-courte-description\` (ex : \`fix/auth-refresh-loop\`).
- Commits Conventional Commits + signature "Développé avec l'aide d'une IA par Flavien" si IA utilisée.
- Tests : Jest + Playwright. Une feature = un test E2E minimum.

## Outils

- Éditeur : VS Code ou Cursor.
- Terminal : Kitty configuré par Flavien.
- Browser : Firefox Developer Edition.

Voir : [[processus-recrutement]] · [[politique-teletravail]]
`,
    createdBy: "00000000-0000-0000-0000-000000000102",
  },
  {
    title: "Stratégie commerciale Q2 2026",
    slug: "strategie-commerciale-q2",
    content: `# Stratégie commerciale Q2 2026

Pilotée par [[manuel-accueil|Léo Martin]] — point d'étape hebdomadaire le mardi 10h.

## Objectifs T2

- 12 démos qualifiées par semaine.
- 8 contrats signés sur le trimestre (ticket moyen 9 k€/an).
- Pipeline qualifié : 320 k€ minimum.

## Verticales prioritaires

1. **Cabinets de conseil** (40 %) — argumentaire : RGPD + souveraineté.
2. **ETI industrielles** (30 %) — argumentaire : intégration LDAP + auto-hébergement.
3. **Collectivités** (20 %) — argumentaire : SecNumCloud en cours, prix maîtrisés.
4. **Recherche académique** (10 %) — gratuit ou licences réduites.

## Outils

- CRM HubSpot synchronisé avec la base [[clients-innodev|Clients InnoDev]].
- Démos sur \`demo.loriax.fr\`.
- Tarification HT publiée — voir [[roadmap-2026]].

## Évènements

- Vivatech 11-13 juin — stand B-204.
- Salon des maires novembre — partenariat avec La Suite numérique.

Voir : [[comex-12-mai]]
`,
    createdBy: "00000000-0000-0000-0000-000000000104",
  },
  {
    title: "Compte rendu COMEX 12 mai",
    slug: "comex-12-mai",
    content: `# Compte rendu COMEX du 12 mai 2026

Présents : Flavien, Marie Lambert, Thomas Bernard, Sophie Roux, Léo Martin, Élodie Petit.

## Décisions

1. **Embauche** d'un·e account executive France validée — voir [[processus-recrutement]].
2. **Migration LiveKit** validée pour la visio — calendrier dans la [[roadmap-2026]].
3. **Budget design** rehaussé de 8 k€/trimestre — cf. [[charte-graphique]].
4. **Politique de télétravail** confirmée en hybride — voir [[politique-teletravail]].

## Indicateurs T2 (mid-quarter)

- MRR : 142 k€ (cible 180 k€ fin année).
- NPS produit : 58 (cible > 60).
- Disponibilité : 99,97 % sur 30 jours.

## Risques

- Concurrent A levant 12 M€ — veille active à mener par Léo.
- Dépendance LiveKit Cloud — préparer fallback self-hosted (Thomas, [[architecture-technique]]).

## Prochaine réunion : 26 mai 2026, 14h, Salle Atlas

Voir : [[strategie-commerciale-q2]] · [[plan-continuite]]
`,
    createdBy: ADMIN_ID,
  },
  {
    title: "Procédure incident sécurité",
    slug: "procedure-incident-securite",
    content: `# Procédure incident de sécurité

Activée dès qu'un événement compromet la confidentialité, l'intégrité ou la disponibilité des données.

## Détection

- Alertes Grafana automatiques (taux d'erreur, latence, volumétrie).
- Signalement utilisateur via \`security@innodev.dev\`.
- Audit log dans l'espace InnoDev (cf. [[architecture-technique]]).

## Réaction (0-30 min)

1. Confirmer l'incident — pas de fausse alerte.
2. Isoler le périmètre — couper l'accès si nécessaire.
3. Convoquer la cellule de crise — voir [[plan-continuite]].
4. Préserver les preuves (logs, dumps).

## Communication (30 min - 4h)

- Clients impactés : email + statut sur \`status.loriax.fr\`.
- CNIL si données personnelles : sous 72h.
- Équipe interne : Slack \`#secu-incidents\`.

## Post-mortem (J+7)

- Document partagé dans cet espace.
- Plan d'action validé en [[comex-12-mai|COMEX]].
- Mise à jour des règles de prévention.

Voir : [[manuel-accueil]]
`,
    createdBy: "00000000-0000-0000-0000-000000000102",
  },
  {
    title: "Clients InnoDev",
    slug: "clients-innodev",
    content: `# Clients InnoDev

Base de comptes clients tenue par [[strategie-commerciale-q2|Léo Martin]].
Source de vérité — synchronisée chaque nuit avec HubSpot.

<div data-type="database-block" data-database-id="__CLIENTS_DB_ID__" data-database-name="Clients InnoDev" data-view-mode="table"></div>

## Conventions

- **Statut** : Prospect → Démo → Pilote → Client → Renouvellement.
- **ARR** : annualisé en euros HT.
- Mise à jour : Léo (commercial) + Élodie (signature).

Voir : [[strategie-commerciale-q2]]
`,
    createdBy: "00000000-0000-0000-0000-000000000104",
  },
  {
    title: "Présentation logo",
    slug: "presentation-logo",
    content: `# Présentation logo InnoDev

Maquette officielle — version validée en COMEX du [[comex-12-mai|12 mai 2026]].

<div data-type="design-block" data-design-id="__LOGO_DESIGN_ID__" title="Logo InnoDev — version finale"></div>

## Déclinaisons

- Carré arrondi sombre sur fond clair (usage principal).
- Wordmark seul (en-tête de site).
- Monochrome blanc pour fond sombre.

## Espaces de protection

Toujours conserver une marge égale à la hauteur du "I" autour du symbole.

Voir : [[charte-graphique]]
`,
    createdBy: "00000000-0000-0000-0000-000000000103",
  },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("✗ Le seed démo ne peut pas être exécuté en production.");
    process.exit(1);
  }

  console.log("╔════════════════════════════════════════════╗");
  console.log("║   Seed démo — InnoDev (contenu pseudo-réel) ║");
  console.log("╚════════════════════════════════════════════╝\n");

  // 0. Pré-requis : admin existant
  const [admin] = await db.select().from(users).where(eq(users.id, ADMIN_ID)).limit(1);
  if (!admin) {
    console.error("✗ Admin@loriax.dev introuvable. Lancez d'abord npm run db:seed.");
    process.exit(1);
  }

  // 0bis. Idempotence
  const existingSpace = await db.select({ id: spaces.id }).from(spaces).where(eq(spaces.slug, TEAM_SPACE_SLUG)).limit(1);
  if (existingSpace.length > 0) {
    console.log("⏭  Espace InnoDev déjà présent — seed démo ignoré.");
    process.exit(0);
  }

  // 1. Organisation LorIAx (créée par seed-dev-users)
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, "default")).limit(1);
  if (!org) {
    console.error("✗ Organisation 'default' introuvable. Lancez npm run db:seed.");
    process.exit(1);
  }
  const orgId = org.id;

  // 2. Création des 5 utilisateurs InnoDev
  console.log("→ Création des utilisateurs InnoDev");
  const passwordHash = await bcrypt.hash("innodev123", 12);
  for (const u of DEMO_USERS) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, u.email)).limit(1);
    if (existing.length > 0) {
      console.log(`  ⏭  ${u.email}`);
      continue;
    }
    await db.insert(users).values({
      id: u.id,
      email: u.email,
      name: u.name,
      passwordHash,
      globalRole: u.role,
    });
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: u.id,
      role: "member",
    }).onConflictDoNothing();
    console.log(`  ✓ ${u.name}`);
  }

  // 3. Espace équipe InnoDev
  console.log("\n→ Espace équipe InnoDev");
  const teamSpaceId = randomUUID();
  const teamRepoPath = "team-innodev";
  await db.insert(spaces).values({
    id: teamSpaceId,
    name: "InnoDev",
    slug: TEAM_SPACE_SLUG,
    type: "team",
    description: "Espace d'équipe InnoDev — startup de plateforme de connaissance d'entreprise.",
    ownerUserId: ADMIN_ID,
    gitRepoPath: teamRepoPath,
    classification: "internal",
    icon: "💡",
    organizationId: orgId,
  });
  await initRepository(teamRepoPath);

  // Permissions : admin pour Flavien, éditeur pour le reste
  await db.insert(spacePermissions).values({ spaceId: teamSpaceId, userId: ADMIN_ID, level: "admin" });
  for (const u of DEMO_USERS) {
    await db.insert(spacePermissions).values({ spaceId: teamSpaceId, userId: u.id, level: "editor" });
  }
  console.log(`  ✓ Espace créé + git init + permissions (${DEMO_USERS.length + 1} membres)`);

  // 4. Base de données "Clients InnoDev" (avant les docs, pour injecter l'ID dans clients-innodev.md)
  console.log("\n→ Base de données 'Clients InnoDev'");
  const clientsDbId = randomUUID();
  await db.insert(userDatabases).values({
    id: clientsDbId,
    spaceId: teamSpaceId,
    name: "Clients InnoDev",
    description: "Comptes clients qualifiés — synchronisés avec HubSpot.",
    createdBy: "00000000-0000-0000-0000-000000000104",
  });

  const columns = [
    { name: "Compte", type: "text" as const, position: 0 },
    { name: "Secteur", type: "select" as const, position: 1, config: { options: ["Conseil", "Industrie", "Public", "Recherche", "Santé"] } },
    { name: "ARR (€ HT)", type: "number" as const, position: 2 },
    { name: "Statut", type: "select" as const, position: 3, config: { options: ["Prospect", "Démo", "Pilote", "Client", "Renouvellement"] } },
    { name: "Signature", type: "date" as const, position: 4 },
  ];
  const columnIds: Record<string, string> = {};
  for (const c of columns) {
    const id = randomUUID();
    columnIds[c.name] = id;
    await db.insert(userDatabaseColumns).values({
      id,
      databaseId: clientsDbId,
      name: c.name,
      type: c.type,
      position: c.position,
      config: c.config ?? {},
    });
  }

  const rows: Array<Record<string, string | number>> = [
    { Compte: "Aurea Conseil",         Secteur: "Conseil",    "ARR (€ HT)": 24000, Statut: "Client",         Signature: "2026-02-14" },
    { Compte: "Brillance Industries",  Secteur: "Industrie",  "ARR (€ HT)": 38000, Statut: "Pilote",         Signature: "2026-04-02" },
    { Compte: "Clémence & Associés",   Secteur: "Conseil",    "ARR (€ HT)": 12000, Statut: "Client",         Signature: "2025-11-08" },
    { Compte: "Mairie de Brest",       Secteur: "Public",     "ARR (€ HT)":  8000, Statut: "Démo",           Signature: "" },
    { Compte: "CNRS Délégation IDF",   Secteur: "Recherche",  "ARR (€ HT)":  4000, Statut: "Client",         Signature: "2025-09-20" },
    { Compte: "Hôpital Saint-Joseph",  Secteur: "Santé",      "ARR (€ HT)": 18000, Statut: "Pilote",         Signature: "2026-03-21" },
    { Compte: "OptiLog SAS",           Secteur: "Industrie",  "ARR (€ HT)": 22000, Statut: "Renouvellement", Signature: "2024-05-10" },
    { Compte: "Cabinet Velours",       Secteur: "Conseil",    "ARR (€ HT)":  9000, Statut: "Prospect",       Signature: "" },
    { Compte: "Région Auvergne",       Secteur: "Public",     "ARR (€ HT)": 32000, Statut: "Démo",           Signature: "" },
    { Compte: "INRIA Sophia",          Secteur: "Recherche",  "ARR (€ HT)":  4000, Statut: "Client",         Signature: "2026-01-12" },
  ];
  for (let i = 0; i < rows.length; i++) {
    const cells: Record<string, string | number> = {};
    for (const [name, value] of Object.entries(rows[i])) {
      cells[columnIds[name]] = value;
    }
    await db.insert(userDatabaseRows).values({
      databaseId: clientsDbId,
      cells,
      position: i,
    });
  }
  console.log(`  ✓ Base "Clients InnoDev" (${columns.length} colonnes, ${rows.length} lignes)`);

  // 5. Documents — injecter les placeholders ID puis créer
  console.log("\n→ Documents InnoDev");
  const logoDesignId = randomUUID();
  const docIdBySlug: Record<string, string> = {};
  for (const d of docs) {
    const id = randomUUID();
    docIdBySlug[d.slug] = id;
    const filePath = `${d.slug}.md`;
    const content = d.content
      .replace("__CLIENTS_DB_ID__", clientsDbId)
      .replace("__LOGO_DESIGN_ID__", logoDesignId);

    await db.insert(documents).values({
      id,
      spaceId: teamSpaceId,
      title: d.title,
      slug: d.slug,
      filePath,
      classification: "internal",
      createdBy: d.createdBy,
      icon: null,
      position: docs.indexOf(d),
      contentText: content,
    });

    await writeDocument(teamRepoPath, filePath, content);
    await commitFile(teamRepoPath, filePath, `Création: ${d.title}`, "Seed démo", "demo@innodev.dev");
    console.log(`  ✓ ${d.title}`);
  }

  // 6. Wiki-links : résolution croisée
  console.log("\n→ Liens entre documents");
  let linkCount = 0;
  for (const d of docs) {
    const sourceId = docIdBySlug[d.slug];
    const links = parseWikiLinks(d.content);
    const seen = new Set<string>();
    for (const link of links) {
      const targetId = docIdBySlug[link.target];
      if (!targetId || targetId === sourceId) continue;
      if (seen.has(targetId)) continue;
      seen.add(targetId);
      await db.insert(documentLinks).values({
        sourceId,
        targetId,
        linkText: link.linkText,
      }).onConflictDoNothing();
      linkCount++;
    }
  }
  console.log(`  ✓ ${linkCount} liens insérés`);

  // 7. Calendrier équipe
  console.log("\n→ Calendrier équipe");
  const teamCalId = randomUUID();
  await db.insert(calendars).values({
    id: teamCalId,
    name: "Équipe InnoDev",
    description: "Rituels et événements de l'équipe InnoDev.",
    color: "#1f3a5f",
    type: "team",
    ownerUserId: ADMIN_ID,
    spaceId: teamSpaceId,
    caldavSlug: "team-innodev",
    isDefault: false,
  });
  console.log("  ✓ Calendrier 'Équipe InnoDev'");

  // 8. Salles de réunion — récupération (déjà créées par seed-meeting-rooms)
  const atlas = await db.select().from(meetingRooms).where(eq(meetingRooms.name, "Salle Atlas")).limit(1);
  const mercure = await db.select().from(meetingRooms).where(eq(meetingRooms.name, "Salle Mercure")).limit(1);

  // 9. Événements
  console.log("\n→ Événements du calendrier");

  // Helper : date locale Paris → ISO
  function at(day: string, time: string): Date {
    return new Date(`${day}T${time}:00+02:00`);
  }
  function uid(slug: string): string {
    return `${slug}-${randomUUID().slice(0, 8)}@innodev.dev`;
  }

  const events = [
    {
      title: "Revue produit hebdomadaire",
      description: "Point d'avancement produit + démo des nouveautés. Tous les mercredis.",
      location: "Visio",
      startAt: at("2026-05-13", "14:00"),
      endAt: at("2026-05-13", "15:00"),
      color: "#1f3a5f",
      isVisio: true,
      documentSlug: "roadmap-2026",
      roomId: null as string | null,
      attendees: [ADMIN_ID, "00000000-0000-0000-0000-000000000101", "00000000-0000-0000-0000-000000000102", "00000000-0000-0000-0000-000000000103"],
    },
    {
      title: "Sprint planning S20",
      description: "Planification du sprint S20 — découpage des tickets et alignement priorités.",
      location: "Visio",
      startAt: at("2026-05-14", "10:00"),
      endAt: at("2026-05-14", "11:30"),
      color: "#f59e0b",
      isVisio: true,
      documentSlug: "roadmap-2026",
      roomId: null as string | null,
      attendees: [ADMIN_ID, "00000000-0000-0000-0000-000000000101", "00000000-0000-0000-0000-000000000102"],
    },
    {
      title: "Onboarding Marie — Jour 4",
      description: "Atelier d'immersion avec son parrain (cf. onboarding ingénieur).",
      location: "Salle Mercure",
      startAt: at("2026-05-14", "14:00"),
      endAt: at("2026-05-14", "15:00"),
      color: "#10b981",
      isVisio: false,
      documentSlug: "onboarding-ingenieur",
      roomId: mercure[0]?.id ?? null,
      attendees: ["00000000-0000-0000-0000-000000000101", "00000000-0000-0000-0000-000000000102"],
    },
    {
      title: "Atelier RSE & frugalité",
      description: "Atelier ouvert à toute l'équipe — mesure de l'impact environnemental du produit.",
      location: "Salle Atlas",
      startAt: at("2026-05-15", "09:30"),
      endAt: at("2026-05-15", "11:00"),
      color: "#22c55e",
      isVisio: false,
      documentSlug: "architecture-technique",
      roomId: atlas[0]?.id ?? null,
      attendees: [ADMIN_ID, "00000000-0000-0000-0000-000000000102", "00000000-0000-0000-0000-000000000103", "00000000-0000-0000-0000-000000000105"],
    },
    {
      title: "Démo client Aurea Conseil",
      description: "Présentation de la plateforme à l'équipe Aurea (4 personnes côté client).",
      location: "Visio",
      startAt: at("2026-05-18", "11:00"),
      endAt: at("2026-05-18", "12:00"),
      color: "#3b82f6",
      isVisio: true,
      documentSlug: "strategie-commerciale-q2",
      roomId: null as string | null,
      attendees: [ADMIN_ID, "00000000-0000-0000-0000-000000000104"],
    },
    {
      title: "Café équipe Paris",
      description: "Rituel café du mardi matin — sans ordre du jour.",
      location: "Cuisine du siège",
      startAt: at("2026-05-19", "09:00"),
      endAt: at("2026-05-19", "09:30"),
      color: "#a855f7",
      isVisio: false,
      documentSlug: "manuel-accueil",
      roomId: null as string | null,
      attendees: [ADMIN_ID, "00000000-0000-0000-0000-000000000101", "00000000-0000-0000-0000-000000000102", "00000000-0000-0000-0000-000000000103", "00000000-0000-0000-0000-000000000104", "00000000-0000-0000-0000-000000000105"],
    },
  ];

  for (const ev of events) {
    const eventId = randomUUID();
    const documentId = ev.documentSlug ? docIdBySlug[ev.documentSlug] : null;

    let meetingId: string | null = null;
    if (ev.isVisio) {
      meetingId = randomUUID();
      const roomName = `innodev-${ev.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${randomUUID().slice(0, 6)}`;
      await db.insert(meetings).values({
        id: meetingId,
        title: ev.title,
        roomName,
        spaceId: teamSpaceId,
        documentId,
        status: "scheduled",
        meetingType: "video",
        scheduledAt: ev.startAt,
        createdBy: ADMIN_ID,
      });
    }

    await db.insert(calendarEvents).values({
      id: eventId,
      calendarId: teamCalId,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      startAt: ev.startAt,
      endAt: ev.endAt,
      status: "confirmed",
      visibility: "public",
      uid: uid(ev.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)),
      color: ev.color,
      documentId,
      meetingId,
      meetingRoomId: ev.roomId,
      createdBy: ADMIN_ID,
    });

    // Lier le meeting à l'événement (calendarEventId)
    if (meetingId) {
      await db.update(meetings).set({ calendarEventId: eventId }).where(eq(meetings.id, meetingId));
    }

    // Réservation de salle si présentiel
    if (ev.roomId) {
      await db.insert(meetingRoomBookings).values({
        roomId: ev.roomId,
        userId: ADMIN_ID,
        title: ev.title,
        startAt: ev.startAt,
        endAt: ev.endAt,
        attendees: ev.attendees,
        status: "confirmed",
        calendarEventId: eventId,
      });
    }

    // Participants
    for (const userId of ev.attendees) {
      await db.insert(calendarEventAttendees).values({
        eventId,
        userId,
        role: "required",
        status: userId === ADMIN_ID ? "accepted" : "needs-action",
      });
    }

    console.log(`  ✓ ${ev.title}${ev.isVisio ? " (visio)" : ev.roomId ? ` (${ev.location})` : ""}`);
  }

  // 10. Tâches
  console.log("\n→ Tâches");
  const taskSeeds = [
    { title: "Finaliser la maquette du Studio v2",        slug: "presentation-logo",         assignee: "00000000-0000-0000-0000-000000000103", due: at("2026-05-15", "17:00") },
    { title: "Brancher LiveKit fallback self-hosted",     slug: "architecture-technique",    assignee: "00000000-0000-0000-0000-000000000102", due: at("2026-05-20", "17:00") },
    { title: "Préparer la démo Aurea Conseil",            slug: "strategie-commerciale-q2",  assignee: "00000000-0000-0000-0000-000000000104", due: at("2026-05-18", "09:00") },
    { title: "Rédiger l'annonce Account Executive",       slug: "processus-recrutement",     assignee: "00000000-0000-0000-0000-000000000105", due: at("2026-05-16", "18:00") },
    { title: "Reformuler la charte couleurs",             slug: "charte-graphique",          assignee: "00000000-0000-0000-0000-000000000103", due: at("2026-05-22", "17:00") },
    { title: "Tester restauration backup mensuelle",      slug: "plan-continuite",           assignee: "00000000-0000-0000-0000-000000000102", due: at("2026-05-23", "12:00") },
    { title: "Mettre à jour les comptes clients en pilote", slug: "clients-innodev",         assignee: "00000000-0000-0000-0000-000000000104", due: at("2026-05-21", "17:00") },
    { title: "Animer l'atelier RSE",                      slug: "manuel-accueil",            assignee: "00000000-0000-0000-0000-000000000105", due: at("2026-05-15", "11:00") },
  ];
  for (const t of taskSeeds) {
    await db.insert(tasks).values({
      kind: "document_item",
      title: t.title,
      status: "open",
      dueAt: t.due,
      assigneeId: t.assignee,
      createdBy: ADMIN_ID,
      documentId: docIdBySlug[t.slug],
      nodeId: randomUUID(),
    });
  }
  console.log(`  ✓ ${taskSeeds.length} tâches`);

  // 11. Activer le module salles si pas déjà fait
  await db
    .insert(systemSettings)
    .values({ key: "meeting_rooms_enabled", value: true, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: true, updatedAt: new Date() },
    });

  console.log("\n✅ Seed démo InnoDev terminé.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Échec seed démo:", err);
  process.exit(1);
});
