# Wizard de configuration initiale

## Résumé

Wizard pleine page déclenché au premier démarrage de l'instance LorIAx. Il purge les données de démonstration et guide l'administrateur dans la configuration de sa nouvelle organisation : identité, contexte métier, utilisateurs, espaces et autorisations.

## Déclenchement

- Flag `setup_completed` dans `system_settings` (clé/valeur JSONB existante)
- Si absent ou `false` → redirection automatique vers `/setup`
- Le middleware bloque toutes les routes sauf `/setup`, `/api/setup/*` et les assets statiques
- Le flag est mis en cache (cookie signé) pour éviter un appel BDD à chaque requête

## Écran d'accueil

Message de bienvenue avec deux options :

- **« Configurer »** → confirmation de purge → étapes du wizard
- **« Plus tard »** → retour à l'application avec les données de démo intactes

Le wizard se repropose à chaque connexion d'un super admin tant que `setup_completed` reste `false`.

## Purge des données de démonstration

**Déclenchement :** `POST /api/setup/purge` après confirmation explicite.

**Données purgées (dans l'ordre, respect des contraintes FK) :**

1. `meeting_participants`
2. `meetings`
3. `event_dependencies`
4. `calendar_events`
5. `calendars`
6. `favorites`
7. `public_shares`
8. `document_comments`
9. `document_links`
10. `notifications`
11. `activity_log`
12. `user_database_rows`
13. `user_database_columns`
14. `user_databases`
15. `documents`
16. `space_permissions`
17. `spaces`
18. `team_members`
19. `teams`
20. `templates`
21. `users`
22. `system_settings` (sauf clés protégées)

**Données conservées :**

- Prompts système par défaut (`ai_prompts` avec flag `is_system` ou équivalent)
- Providers IA de base (`ai_providers`)
- Flag `setup_completed` lui-même

**Interruption :** Si le wizard est annulé après la purge, l'instance reste non configurée. Au prochain accès, le wizard reprend depuis le début (la purge ne se refait pas car il n'y a plus rien à purger). Le wizard ne peut être terminé sans la création d'au moins un super admin.

## Étapes du wizard

### Étape 1 — Identité de l'organisation

| Champ | Obligatoire | Stockage |
|-------|-------------|----------|
| Nom de l'organisation | oui | `system_settings.org_name` |
| Description courte | non | `system_settings.org_description` |
| Logo (image → WebP, carré) | non | S3/filesystem → `system_settings.org_logo_url` |
| Favicon (32×32 ou SVG) | non | S3/filesystem → `system_settings.org_favicon_url` |

API : `POST /api/setup/identity`

### Étape 2 — Contexte métier (facultatif, skippable)

| Champ | Description |
|-------|-------------|
| Site web institutionnel | URL du site de l'organisation |
| Secteur d'activité | Liste déroulante + saisie libre |
| Présentation de l'organisation | Textarea libre |
| Valeurs, mission | Textarea libre |

Stocké dans `system_settings` clé `org_context` (JSONB). Injecté dans le contexte système des prompts IA pour des réponses pertinentes dès le départ.

API : `POST /api/setup/context`

### Étape 3 — Utilisateurs

**Création du super admin (obligatoire) :**
- Nom, email, mot de passe

**Ajout d'autres utilisateurs (3 modes) :**

1. **Saisie manuelle** — nom, email, rôle, un par un
2. **Import CSV** — upload du fichier (modèle téléchargeable `/templates/import-utilisateurs.csv`)
3. **Connexion LDAP** — réutilise la configuration LDAP existante (champs Bind DN, URL, etc.)

**Modèle CSV :**

| Colonne | Obligatoire | Description | Valeur par défaut |
|---------|-------------|-------------|-------------------|
| `nom` | oui | Nom complet | — |
| `email` | oui | Adresse email | — |
| `role` | non | Rôle global (`super_admin`, `admin`, `editor`, `viewer`) | `editor` |
| `mot_de_passe` | non | Mot de passe initial | Généré aléatoirement |
| `equipe` | non | Nom de l'équipe (créée automatiquement si inexistante) | — |

Règles :
- Encodage UTF-8, séparateur virgule
- Si `mot_de_passe` est vide → mot de passe aléatoire, affiché une seule fois dans un récapitulatif téléchargeable
- Si `equipe` est renseignée et n'existe pas → création automatique

Skippable après la création du super admin.

API : `POST /api/setup/users`, `POST /api/setup/users/ldap`

### Étape 4 — Espaces

Espaces pré-remplis par défaut :

| Nom | Classification | Description |
|-----|---------------|-------------|
| Général | `internal` | Espace commun à toute l'organisation |
| Direction | `confidential` | Documents de direction et stratégie |
| Ressources humaines | `confidential` | Documents RH |
| Projets | `internal` | Suivi des projets en cours |

Chaque espace est :
- Renommable
- Supprimable
- Modifiable (description, icône, classification)

Possibilité d'ajouter de nouveaux espaces.

API : `POST /api/setup/spaces`

### Étape 5 — Autorisations

Matrice visuelle : espaces en lignes × utilisateurs en colonnes.

Niveaux : lecteur, éditeur, admin.

Valeurs par défaut :
- « Général » → tous les utilisateurs en éditeur
- « Direction » → super admin seulement
- Autres espaces → selon l'équipe associée

Skippable (gestion fine disponible plus tard dans l'admin).

API : `POST /api/setup/permissions`

### Écran final — Récapitulatif

Résumé de la configuration :
- Nom et logo de l'organisation
- Nombre d'utilisateurs créés
- Liste des espaces
- Aperçu des autorisations

Bouton « Lancer l'application » → `POST /api/setup/complete` → `setup_completed = true`.

## Architecture technique

### Routing

- `/setup` — wizard pleine page (layout `(setup)`, sans sidebar)
- `/api/setup/*` — route handlers pour chaque étape

### Fichiers à créer

```
src/app/(setup)/layout.tsx              — layout minimal
src/app/(setup)/setup/page.tsx          — composant wizard principal
src/components/setup/step-welcome.tsx   — écran d'accueil + purge
src/components/setup/step-identity.tsx  — identité organisation
src/components/setup/step-context.tsx   — contexte métier
src/components/setup/step-users.tsx     — utilisateurs (manuel/CSV/LDAP)
src/components/setup/step-spaces.tsx    — espaces
src/components/setup/step-permissions.tsx — autorisations
src/components/setup/step-summary.tsx   — récapitulatif
src/app/api/setup/purge/route.ts
src/app/api/setup/identity/route.ts
src/app/api/setup/context/route.ts
src/app/api/setup/users/route.ts
src/app/api/setup/users/ldap/route.ts
src/app/api/setup/spaces/route.ts
src/app/api/setup/permissions/route.ts
src/app/api/setup/complete/route.ts
public/templates/import-utilisateurs.csv
```

### Middleware

Ajout dans le middleware existant (`src/middleware.ts`) : vérification du flag `setup_completed`. Cache via cookie signé pour éviter l'appel BDD systématique.

### État du wizard

- État local React (pas de persistance inter-étapes côté serveur)
- Chaque étape sauvegarde en BDD au passage à la suivante
- Navigation avant/arrière entre les étapes
- Stepper visuel de progression
