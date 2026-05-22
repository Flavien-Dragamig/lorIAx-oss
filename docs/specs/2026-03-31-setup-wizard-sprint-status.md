# Sprint — Wizard de configuration initiale

## Contexte

Fonctionnalité : wizard pleine page au premier démarrage de LorIAx. Il purge les données de démonstration et guide la configuration de la nouvelle organisation (identité, contexte métier, utilisateurs, espaces, autorisations).

Spécification : `docs/specs/2026-03-31-setup-wizard-design.md`
Plan d'implémentation : `docs/specs/2026-03-31-setup-wizard-plan.md`

## Décisions prises

1. **Wizard au premier démarrage uniquement** — pas de bouton dans l'admin
2. **Wizard pleine page** (route group `(setup)`) — layout minimal, sans sidebar
3. **Détection** : flag `setup_completed` dans `system_settings`, vérifié dans le layout `(app)` → redirection vers `/setup`
4. **Purge** : supprime tout sauf `ai_providers`, `ai_prompts`, `ai_prompt_versions`
5. **5 étapes** : Identité → Contexte métier (facultatif) → Utilisateurs → Espaces → Autorisations
6. **3 modes de création d'utilisateurs** : saisie manuelle, import CSV, configuration LDAP
7. **Espaces pré-remplis** par défaut (Général, Direction, RH, Projets) modifiables
8. **Annulation** : si avant la purge → rien ne se passe (marque `setup_completed` pour éviter boucle) ; si après la purge → wizard se repropose au prochain accès
9. **Modèle CSV** : 5 colonnes (nom, email, role, mot_de_passe, equipe), UTF-8, mots de passe générés si vides

## Travail effectué

### Commits (12 commits sur la branche `main`)

| Commit | Description | État |
|--------|-------------|------|
| `aa6443a` | Middleware : routes `/setup` et `/api/setup` publiques | ✅ OK |
| `708d821` | Layout `(app)` : redirection auto vers `/setup` si `setup_completed` absent | ✅ OK |
| `7697754` | Layout setup + page wizard + stepper de progression | ✅ OK |
| `f7ed266` | Parser CSV (`src/lib/setup/csv-parser.ts`) | ✅ OK |
| `9f1eaab` | Étape identité — API + composant | ✅ OK |
| `fa643a5` | Étape contexte métier — API + composant | ✅ OK |
| `defcb72` | Étape utilisateurs — API (manuel + CSV + LDAP) + composant | ✅ OK |
| `c85e2e7` | Étape espaces — API + composant | ✅ OK |
| `975ba51` | Étape autorisations — API (matrice) + composant | ✅ OK |
| `296e0b6` | Récapitulatif + API `/api/setup/complete` | ✅ OK |
| `84b5375` | Spécification (doc) | ✅ OK |
| `ae3c6de` | Plan d'implémentation (doc) | ✅ OK |
| — | Purge données de démo (API + lib + composant welcome) | ✅ OK |

### Fichiers créés

**Composants UI** (`src/components/setup/`) :
- `setup-stepper.tsx` — barre de progression 7 étapes
- `step-welcome.tsx` — écran d'accueil
- `step-identity.tsx` — formulaire identité organisation
- `step-context.tsx` — formulaire contexte métier
- `step-users.tsx` — création super admin + ajout manuel/CSV/LDAP
- `step-spaces.tsx` — espaces pré-remplis modifiables
- `step-permissions.tsx` — matrice autorisations
- `step-summary.tsx` — récapitulatif + lancement

**Routes API** (`src/app/api/setup/`) :
- `identity/route.ts` — sauvegarde identité dans `system_settings`
- `context/route.ts` — sauvegarde contexte métier (JSONB)
- `users/route.ts` — création utilisateurs + espaces perso + calendriers + équipes
- `users/ldap/route.ts` — sauvegarde config LDAP
- `spaces/route.ts` — création espaces + init repos git
- `permissions/route.ts` — insertion `space_permissions`
- `complete/route.ts` — flag `setup_completed = true`

**Purge** :
- `src/lib/setup/purge.ts` — fonction `purgeAllData()` (transaction Drizzle, suppression ordonnée FK)
- `src/app/api/setup/purge/route.ts` — handler POST

**Autres** :
- `src/app/(setup)/layout.tsx` — layout minimal
- `src/app/(setup)/setup/page.tsx` — orchestrateur wizard
- `src/lib/setup/csv-parser.ts` — parsing + validation CSV
- `public/templates/import-utilisateurs.csv` — modèle CSV

## Bugs connus / choses à corriger

### BUG CRITIQUE : La purge n'existe pas

La route API `src/app/api/setup/purge/route.ts` et la fonction `src/lib/setup/purge.ts` **n'ont jamais été créées** (le répertoire `purge/` est absent). Le composant `step-welcome.tsx` actuel n'appelle pas l'API de purge — il passe directement à l'étape suivante sans supprimer les données de démo.

**Fichiers manquants :**
- `src/lib/setup/purge.ts` — fonction `purgeAllData()` (transaction Drizzle, suppression ordonnée FK)
- `src/app/api/setup/purge/route.ts` — handler POST

**Composant à corriger :**
- `src/components/setup/step-welcome.tsx` — doit afficher la confirmation de purge (avertissement ambre) et appeler `POST /api/setup/purge` avant de passer à l'étape identité. Le code actuel est un stub simplifié sans purge.

Le code de la purge est détaillé dans le plan (Task 4). Les tables à purger dans l'ordre FK :
1. `meeting_participants`, `meetings`
2. `event_dependencies`, `calendar_events`, `calendars`
3. `favorites`, `public_shares`
4. `document_comments`, `document_links`
5. `notifications`, `activity_log`, `api_keys`
6. `user_database_rows`, `user_database_columns`, `user_databases`
7. `documents`
8. `space_permissions`, `spaces`
9. `team_members`, `teams`
10. `templates`, `users`
11. `system_settings` (sauf `setup_completed`)
12. `ai_usage_logs`, `ai_quotas`, `ai_model_assignments`

### BUG : Bouton « Plus tard » marque setup_completed = true

Le `step-welcome.tsx` actuel appelle `POST /api/setup/complete` quand l'utilisateur clique « Plus tard ». Ce comportement a été ajouté pour éviter une boucle de redirection, mais ça empêche le wizard de se reproposer.

**Correction nécessaire :** Le bouton « Plus tard » ne doit PAS marquer `setup_completed`. Il doit simplement naviguer vers `/login` ou la page d'accueil. La boucle de redirection se résout autrement : le middleware doit laisser passer l'accès à l'app quand `setup_completed` n'existe pas (mode démo).

Alternative : introduire un flag `setup_skipped` temporaire (session/cookie) qui empêche la re-proposition pendant la session en cours, mais permet de reproposer au prochain démarrage.

### Bugs mineurs signalés lors du test

- **API identity** : insérait `value: null` pour logo/favicon alors que la colonne `system_settings.value` est JSONB NOT NULL. Corrigé (on n'insère pas les clés si valeur null).
- **Redirection non-auth** : un utilisateur non authentifié qui accède à `/` est redirigé vers `/login` (par le middleware), pas vers `/setup`. Le layout `(app)` ne s'exécute que pour les utilisateurs authentifiés. Ce n'est pas bloquant mais à considérer pour l'UX au tout premier démarrage.

### Fichiers non commités

- Fichiers `.playwright-mcp/*` — logs de test, à nettoyer (gitignored normalement)

## Choses à faire

### Priorité haute (✅ DONE)

1. ~~**Créer `src/lib/setup/purge.ts`**~~ ✅ — fonction `purgeAllData()` en transaction Drizzle, suppression ordonnée de toutes les tables (gestion référence circulaire calendar_events ↔ meetings). Conserve ai_providers, ai_prompts, ai_prompt_versions.
2. ~~**Créer `src/app/api/setup/purge/route.ts`**~~ ✅ — handler POST avec vérification que setup n'est pas déjà terminé + gestion d'erreur.
3. ~~**Réécrire `src/components/setup/step-welcome.tsx`**~~ ✅ — écran d'accueil → confirmation ambre → purge → étape identité. Le bouton « Plus tard » ne marque plus `setup_completed`.

### Priorité moyenne (✅ DONE)

4. ~~**Upload logo/favicon**~~ ✅ — composant `ImageUpload` dans `step-identity.tsx`, route `POST /api/setup/upload` avec Sharp (logo 512px WebP, favicon 32×32 PNG), stockage S3 `branding/`.
5. ~~**Gestion du bouton « Plus tard » propre**~~ ✅ — cookie `setup_skipped` posé côté serveur (`POST /api/setup/skip`) avec `HttpOnly; Secure; SameSite=Lax`. Vérifié dans `(app)/layout.tsx`.
6. ~~**Téléchargement des identifiants**~~ ✅ — écran intermédiaire après création des utilisateurs, bouton de téléchargement CSV avec mots de passe en clair (affiché une seule fois).

### Priorité basse (✅ DONE)

7. ~~**Navigation arrière dans le wizard**~~ ✅ — bouton « Précédent » sur les étapes contexte, utilisateurs, espaces, autorisations et récapitulatif.
8. **Test bout en bout complet** — reste à faire.
9. **Nettoyage des fichiers .playwright-mcp** — ajouté au .gitignore.

### Audit de sécurité (✅ DONE — 2026-04-01)

10. ~~**VULN-01 CRITIQUE : guard setup_completed**~~ ✅ — fonction `guardSetupNotCompleted()` dans `lib/setup/guards.ts`, appliquée aux 9 routes API setup. Empêche toute manipulation post-configuration.
11. ~~**VULN-02 CRITIQUE : verrouillage DoS**~~ ✅ — `/api/setup/complete` vérifie qu'un super_admin existe en BDD avant de finaliser.
12. ~~**VULN-03 HAUTE : reconfiguration LDAP**~~ ✅ — protégée par le guard (VULN-01).
13. ~~**VULN-04 HAUTE : mot de passe faible**~~ ✅ — minimum porté de 6 à 12 caractères (API + composant).
14. ~~**VULN-05 MOYENNE : cookie setup_skipped**~~ ✅ — posé côté serveur avec HttpOnly/Secure.
15. ~~**VULN-06 MOYENNE : validation MIME**~~ ✅ — détection par magic bytes, SVG retiré des formats acceptés.

## Commandes utiles pour reprendre

```bash
# Voir l'état actuel
cd /home/flavien/CascadeProjects/LorIAx/loriax-app
git log --oneline -15

# Vérifier les fichiers modifiés
git status

# Lancer le dev
npm run dev:full

# Vérifier l'état de la BDD
# (via l'interface admin /admin/system ou psql)
```
