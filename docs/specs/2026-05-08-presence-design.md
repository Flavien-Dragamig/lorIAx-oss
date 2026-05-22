# Spec — Présence et statut utilisateurs

**Date** : 2026-05-08  
**Sprint cible** : ~99  
**Statut** : validé pour implémentation

---

## Résumé

Afficher le statut temps réel des membres de l'équipe dans la sidebar et via un panneau dédié. Le statut combine une présence déduite automatiquement (dernière activité, CalDAV) et un statut manuel (4 prédéfinis + emoji/texte libre avec TTL optionnel).

---

## Périmètre

**Inclus :**
- Table `user_status` (statut persisté, last_seen, custom)
- API `GET /api/me/status`, `PATCH /api/me/status`, `GET /api/team/status`
- Heartbeat client 60s pour maintenir `last_seen`
- Déduction automatique "En réunion" depuis `calendar_events` (CalDAV)
- Composant `PresenceBadge` réutilisable (badge couleur sur avatar)
- Section "Membres actifs" dans la sidebar avec badges
- Panneau "Équipe" : bouton header + vue planning 3 jours
- Popover de modification de son propre statut (clic avatar dans le panneau)
- Seed démo mis à jour

**Exclus :**
- Messagerie directe (fonctionnalité séparée)
- Notifications lors d'un changement de statut
- Statuts visibles dans les têtes de document (CollaboratorsBar existante suffit)

---

## Modèle de données

### Table `user_status`

```sql
CREATE TABLE user_status (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'offline',
  -- 'online' | 'away' | 'in_meeting' | 'dnd' | 'offline'
  custom_emoji   text,
  custom_text    varchar(100),
  custom_expires_at timestamptz,
  -- si défini, le statut custom est effacé automatiquement après cette date
  last_seen      timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_status_last_seen ON user_status(last_seen);
```

**Règles de déduction `status` effectif** (ordre de priorité, évalué côté serveur) :
1. Si `last_seen < now() - 10 min` → `offline` (écrase tout)
2. Si événement CalDAV en cours (non all-day, `startAt ≤ now ≤ endAt`, calendrier personnel ou équipe de l'user) → `in_meeting` (écrase le statut persisté sauf `dnd`)
3. Sinon : valeur de la colonne `status`
4. Si `custom_expires_at` est dépassé : ignorer `custom_emoji/custom_text`

**Déduction "En ligne"** : `last_seen > now() - 3 min` → `online`, `3-10 min` → `away`, `> 10 min` → `offline`.

---

## API

### `PATCH /api/me/status`

Met à jour le statut et/ou `last_seen`. Utilisé à la fois pour le heartbeat (corps vide → `last_seen = now()`) et le changement de statut.

```ts
// Body (tous les champs optionnels)
{
  status?: 'online' | 'away' | 'in_meeting' | 'dnd';
  custom_emoji?: string | null;
  custom_text?: string | null;
  custom_expires_at?: string | null; // ISO 8601
}
```

Réponse : `200 { status, custom_emoji, custom_text, custom_expires_at, last_seen }`.

Upsert sur `user_status.user_id`. Toujours met à jour `last_seen = now()`.

### `GET /api/me/status`

Retourne le statut effectif de l'utilisateur courant (avec déduction CalDAV appliquée).

### `GET /api/team/status`

Retourne le statut effectif de tous les membres des équipes de l'utilisateur courant, avec disponibilité CalDAV sur 3 jours.

```ts
// Réponse
{
  members: Array<{
    userId: string;
    name: string;
    email: string;
    effectiveStatus: 'online' | 'away' | 'in_meeting' | 'dnd' | 'offline';
    customEmoji?: string;
    customText?: string;
    lastSeen: string;
    // Planning CalDAV — 3 jours à partir d'aujourd'hui
    availability: Array<{
      date: string;          // 'YYYY-MM-DD'
      morning: 'free' | 'busy' | 'absent';    // 08h–12h
      afternoon: 'free' | 'busy' | 'absent';  // 12h–18h
      evening: 'free' | 'busy' | 'absent';    // 18h–22h
    }>;
  }>;
}
```

**Déduplication** : les membres apparaissant dans plusieurs équipes ne sont listés qu'une fois.  
**Calcul disponibilité** : pour chaque slot horaire, `busy` si au moins un événement non-all-day le chevauche dans les calendriers personnels + équipe de l'user. `absent` si le jour est un samedi ou dimanche, OU si l'user a un événement all-day (`allDay = true`) couvrant ce jour — sinon `free`.  
Calendriers interrogés via la table `calendar_events` (Drizzle), pas via le protocole CalDAV.

---

## Composants UI

### `PresenceBadge`

```tsx
<PresenceBadge status="online" size="sm" />
// Dot coloré positionné en bottom-right de l'avatar parent
// Couleurs : online=#22c55e, away=#f59e0b, in_meeting=#f59e0b,
//            dnd=#ef4444, offline=#cbd5e1
// Sizes : sm (8px), md (10px), lg (12px)
```

Composant pur, aucune dépendance réseau. Accepte `status` en prop.

### Hook `useTeamStatus`

```ts
const { members, isLoading } = useTeamStatus();
// SWR, revalidate toutes les 30s
// Appelle GET /api/team/status
```

### Hook `useMyStatus`

```ts
const { status, update } = useMyStatus();
// Heartbeat : PATCH /api/me/status toutes les 60s (useEffect + setInterval)
// update({ status, customEmoji, customText, customExpiresAt }) → PATCH optimiste
```

### Section "Membres actifs" dans la sidebar

Ajoutée dans `src/components/sidebar/` en dessous de l'arborescence des documents. Affiche les membres de l'équipe triés par statut (en ligne en premier). Utilise `useTeamStatus`. Visible uniquement si l'utilisateur appartient à au moins une équipe.

### Bouton "Équipe" dans le header

Icône 👥 avec badge comptant les membres `online` ou `away`. Ouvre/ferme le `TeamPanel`.

### `TeamPanel`

Drawer fixé à droite de l'interface principale (non modal, pas de superposition). Largeur 300px. Contenu :
- Header : titre "Mon équipe" + compteur + avatar de l'utilisateur courant (cliquable)
- Grille : en-têtes 3 jours + lignes membres (avatar + statut + barres planning)
- Légende

### `StatusPopover`

Popover (Radix/base-ui) ancré sur l'avatar courant dans le header du `TeamPanel`. Contenu :
- 4 options prédéfinies avec indicateur "actuel"
- Section "Statut personnalisé" : emoji picker (bouton 36px) + input texte (max 80 chars)
- Sélecteur TTL : "30 min" | "1h" | "Demain à minuit" | date personnalisée (DatePicker)
- Bouton "Enregistrer" → PATCH + fermeture

---

## Flux de données

```
Client (60s)
  └─ PATCH /api/me/status  ──► user_status.last_seen = now()

Client (30s, SWR)
  └─ GET /api/team/status
       ├─ JOIN user_status + team_members + users (équipes de l'user)
       ├─ Déduction effectiveStatus (last_seen + CalDAV check)
       └─ Calcul availability (calendar_events, 3 jours)

Changement statut manuel
  └─ PATCH /api/me/status { status, custom_* }
       └─ SWR mutate() → revalidation immédiate dans TeamPanel + sidebar
```

---

## Fichiers à créer / modifier

| Action | Fichier |
|--------|---------|
| Créer | `migrations/0015_user_status.sql` |
| Créer | `src/lib/db/schema.ts` — table `userStatus` |
| Créer | `src/app/api/me/status/route.ts` (GET + PATCH) |
| Créer | `src/app/api/team/status/route.ts` (GET) |
| Créer | `src/lib/presence/availability.ts` — calcul créneaux CalDAV |
| Créer | `src/hooks/use-my-status.ts` |
| Créer | `src/hooks/use-team-status.ts` |
| Créer | `src/components/ui/presence-badge.tsx` |
| Créer | `src/components/presence/team-panel.tsx` |
| Créer | `src/components/presence/status-popover.tsx` |
| Modifier | `src/components/sidebar/` — section membres actifs |
| Modifier | `src/components/layout/header.tsx` — bouton Équipe |
| Modifier | `scripts/seed-demo.ts` — statuts de démo |
| Modifier | `loriax-app/docs/architecture.md` — ADR-060 |

---

## ADR-060 : Présence et statut utilisateurs

- **Approche** : polling 30s (GET team/status) + heartbeat 60s (PATCH me/status) sur table `user_status`
- **"En ligne" déduit** : `last_seen` timestamp, seuils 3min/10min
- **CalDAV** : requêtes directes sur `calendar_events` (Drizzle), pas de protocole CalDAV
- **Alternatives écartées** : Hocuspocus awareness global (état éphémère, pas de CalDAV), SSE (nouvelle infra injustifiée vu le polling 30s accepté)

---

## Seed démo

Ajouter dans `seed-demo.ts` des `user_status` variés pour les 8 utilisateurs InnoDev :
- 2 `online`, 1 `in_meeting` (avec événement CalDAV en cours), 1 `dnd`, 1 `away`, 3 `offline`
- 1 statut custom `🏖️ En vacances` avec `custom_expires_at = now() + 5 days`
