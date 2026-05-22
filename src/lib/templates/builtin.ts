// Templates de documents natifs — toujours disponibles, indépendants de la base de données

export interface DatabaseColumnDef {
  name: string;
  type: "text" | "number" | "date" | "select" | "checkbox" | "relation" | "image" | "formula" | "url" | "email";
  config?: Record<string, unknown>;
}

export interface BuiltinTemplateContent {
  markdown?: string;
  database?: {
    name: string;
    columns: DatabaseColumnDef[];
  };
}

export interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  content: BuiltinTemplateContent;
  isGlobal: true;
  isBuiltin: true;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  // ── Réunion ──────────────────────────────────────────────────────────────────
  {
    id: "builtin_compte-rendu-reunion",
    name: "Compte-rendu de réunion",
    description: "Structure pour documenter les décisions et actions d'une réunion",
    icon: "📋",
    category: "réunion",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Compte-rendu — [Titre de la réunion]

**Date :** [JJ/MM/AAAA]
**Participants :** [Noms]
**Animateur :** [Nom]

---

## Ordre du jour

1.
2.
3.

## Décisions prises

-

## Actions à mener

- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]
- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]

## Points en suspens

-

## Prochaine réunion

**Date :** [JJ/MM/AAAA]
**Sujets prévus :**
`,
    },
  },
  {
    id: "builtin_cr-de-reunion",
    name: "CR de réunion",
    description: "Compte-rendu structuré avec décisions, actions et points en suspens",
    icon: "📋",
    category: "réunion",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# CR de réunion — [Titre]

**Date :** [JJ/MM/AAAA]
**Heure :** [HH:MM – HH:MM]
**Lieu / Lien :** [À compléter]
**Animateur :** [Nom]
**Participants :** [Noms]
**Absents excusés :** [Noms]

---

## Ordre du jour

1. [Point 1]
2. [Point 2]
3. [Point 3]

---

## Compte-rendu des échanges

### [Point 1]

[Synthèse des échanges]

### [Point 2]

[Synthèse des échanges]

## Décisions prises

| # | Décision | Décideur |
|---|----------|----------|
| 1 | | |
| 2 | | |

## Actions à mener

- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]
- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]

## Points en suspens

-

## Prochaine réunion

**Date :** [JJ/MM/AAAA]
**Ordre du jour prévu :** [À compléter]
`,
    },
  },
  {
    id: "builtin_cr-reunion-interne",
    name: "CR réunion interne",
    description: "Compte-rendu synthétique pour une réunion d'équipe ou de service",
    icon: "🏢",
    category: "réunion",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# CR réunion interne — [Titre]

**Date :** [JJ/MM/AAAA]
**Service :** [Nom du service]
**Animateur :** [Nom]
**Participants :** [Noms]

---

## Ordre du jour

1. [Point 1]
2. [Point 2]
3. [Point 3]

## Échanges et décisions

### [Point 1]

[Synthèse des échanges]

**Décision :** [Décision prise ou "(Aucune)"]

### [Point 2]

[Synthèse des échanges]

**Décision :** [Décision prise ou "(Aucune)"]

## Actions à mener

- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]
- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]

## Prochaine réunion

**Date :** [JJ/MM/AAAA]
**Ordre du jour prévu :** [À compléter]
`,
    },
  },
  {
    id: "builtin_ordre-du-jour",
    name: "Ordre du jour",
    description: "Trame d'ordre du jour à préparer avant une réunion",
    icon: "📅",
    category: "réunion",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Ordre du jour — [Titre de la réunion]

**Date :** [JJ/MM/AAAA]
**Heure :** [HH:MM]
**Lieu / Lien :** [À compléter]
**Participants :** [Noms]
**Animateur :** [Nom]

---

## Points à aborder

1. [Point 1] — [Durée estimée]
2. [Point 2] — [Durée estimée]
3. [Point 3] — [Durée estimée]

## Documents à préparer

- [ ] [Document 1]
- [ ] [Document 2]

## Objectif de la réunion

[Décrivez ce que vous souhaitez avoir décidé ou produit à l'issue de la réunion]

## Résultats attendus

-
`,
    },
  },
  {
    id: "builtin_reunion-de-lancement",
    name: "Réunion de lancement",
    description: "Trame de kick-off pour démarrer un projet avec l'équipe",
    icon: "🚀",
    category: "réunion",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Réunion de lancement — [Nom du projet]

**Date :** [JJ/MM/AAAA]
**Participants :** [Noms]
**Commanditaire :** [Nom]
**Chef de projet :** [Nom]

---

## Contexte et enjeux

[Pourquoi ce projet ? Quelle problématique adresse-t-il ?]

## Objectifs du projet

1.
2.
3.

## Périmètre

### Inclus
-

### Exclus
-

## Organisation

| Rôle | Personne | Responsabilités |
|------|----------|-----------------|
| Commanditaire | | |
| Chef de projet | | |
| Contributeur | | |

## Planning macro

| Phase | Début | Fin |
|-------|-------|-----|
| Cadrage | | |
| Réalisation | | |
| Livraison | | |

## Prochaines étapes immédiates

- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]
- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]

## Questions ouvertes

-

> **💡 Conseil :** Distribuez ce document aux participants avant la réunion pour qu'ils puissent préparer leurs questions.
`,
    },
  },
  {
    id: "builtin_cr-top-5",
    name: "CR Top 5",
    description: "Compte-rendu de réunion Top 5 — point quotidien ou hebdomadaire",
    icon: "⚡",
    category: "réunion",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Top 5 — [Date]

**Équipe :** [Nom de l'équipe]
**Animateur :** [Nom]
**Durée :** 15 min

---

## 1. Sécurité / Qualité

- Incidents ou alertes :
- Actions correctives en cours :

## 2. Résultats / Indicateurs

| Indicateur | Objectif | Réalisé | Tendance |
|------------|----------|---------|----------|
| | | | ↑ ↓ → |
| | | | ↑ ↓ → |
| | | | ↑ ↓ → |

## 3. Planning / Charge

- **Tâches prioritaires du jour / de la semaine :**
  - [ ]
  - [ ]
  - [ ]
- **Retards identifiés :**
  -

## 4. Problèmes / Blocages

| Problème | Impact | Responsable | Échéance résolution |
|----------|--------|-------------|---------------------|
| | | | |

## 5. Informations / Communication

- Annonces :
-
- Points à remonter à la hiérarchie :
-

---

**Prochaine réunion :** [Date / Heure]
`,
    },
  },
  {
    id: "builtin_top-5-hebdo",
    name: "TOP 5 hebdo",
    description: "Bilan hebdomadaire en 5 points : sécurité, résultats, planning, problèmes, infos",
    icon: "📊",
    category: "réunion",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# TOP 5 hebdo — Semaine [N] / [AAAA]

**Équipe :** [Nom de l'équipe]
**Responsable :** [Nom]
**Période :** Du [JJ/MM] au [JJ/MM/AAAA]

---

## 1. Sécurité / Qualité

| Point | Statut | Action |
|-------|--------|--------|
| [Incident / alerte] | [OK / En cours / Résolu] | |

## 2. Résultats

| Indicateur | Objectif | Réalisé | Tendance |
|------------|----------|---------|----------|
| [KPI 1] | | | ↑ ↓ → |
| [KPI 2] | | | ↑ ↓ → |
| [KPI 3] | | | ↑ ↓ → |

**Commentaire :** [Analyse des résultats en 1-2 phrases]

## 3. Planning

| Priorité | Tâche | Responsable | Statut | Échéance |
|----------|-------|-------------|--------|----------|
| Haute | | | 🔵 En cours | |
| Haute | | | ⬜ À faire | |
| Moyenne | | | ⬜ À faire | |

**Retards identifiés :** [À compléter ou "Aucun"]

## 4. Problèmes / Blocages

| Problème | Impact | Responsable | Plan d'action | Échéance |
|----------|--------|-------------|---------------|----------|
| | | | | |

## 5. Informations

- **Annonces :** [À compléter]
- **Points à escalader :** [À compléter ou "Aucun"]
- **Prochaine semaine :** [Objectif principal]

---

**Prochaine réunion TOP 5 :** [Date / Heure]
`,
    },
  },

  // ── Commercial ───────────────────────────────────────────────────────────────
  {
    id: "builtin_gestion-nouveau-lead",
    name: "Gestion de nouveau lead",
    description: "Fiche de qualification et suivi d'un prospect entrant",
    icon: "🤝",
    category: "commercial",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Lead — [Nom du contact / entreprise]

## Informations contact

| Champ | Détail |
|-------|--------|
| **Nom** | |
| **Entreprise** | |
| **Poste** | |
| **Email** | |
| **Téléphone** | |
| **Source** | [Site web / Salon / Recommandation / LinkedIn / Autre] |
| **Date de contact** | [JJ/MM/AAAA] |

## Contexte et besoin

[Décrivez la demande initiale du prospect, son contexte, ses enjeux]

## Qualification

| Critère | Évaluation |
|---------|------------|
| **Budget identifié** | Oui / Non / À préciser |
| **Décideur identifié** | Oui / Non |
| **Échéance souhaitée** | |
| **Niveau d'urgence** | Faible / Moyen / Élevé |
| **Adéquation offre** | Forte / Moyenne / Faible |

## Historique des échanges

| Date | Canal | Résumé | Prochaine action |
|------|-------|--------|------------------|
| | | | |

## Proposition

- **Type de prestation :** [Conseil / Formation / Développement / Audit / Autre]
- **Estimation budgétaire :** [Montant]
- **Proposition envoyée le :** [Date]

## Suivi

- **Statut :** [Nouveau / En qualification / Proposition envoyée / Négociation / Gagné / Perdu]
- **Probabilité de conversion :** [%]
- **Motif si perdu :** [Budget / Timing / Concurrence / Autre]

## Actions en cours

- [ ] [Action] — Échéance : [Date]
- [ ] [Action] — Échéance : [Date]

## Notes

[Observations, points d'attention, éléments stratégiques]
`,
    },
  },
  {
    id: "builtin_suivi-client",
    name: "Suivi client",
    description: "Fiche de suivi relationnel pour un client existant",
    icon: "🫱",
    category: "commercial",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Suivi client — [Nom du client]

**Commercial référent :** [Nom]
**Depuis :** [Date de début de la relation]
**Segment :** [PME / Grand compte / Collectivité / Autre]

---

## Informations clés

| Champ | Détail |
|-------|--------|
| **Entreprise** | |
| **Interlocuteur principal** | |
| **Fonction** | |
| **Email** | |
| **Téléphone** | |

## Historique de la relation

| Date | Type | Sujet | Suite à donner |
|------|------|-------|----------------|
| | RDV / Email / Appel | | |

## Contrats actifs

| Contrat | Début | Fin | Valeur |
|---------|-------|-----|--------|
| | | | |

## Opportunités identifiées

-

## Actions en cours

- [ ] [Action] — Échéance : [Date]

## Notes et points d'attention

[Observations importantes sur ce client]
`,
    },
  },
  {
    id: "builtin_premier-rdv-client",
    name: "Premier RDV client",
    description: "Trame de préparation et de compte-rendu pour un premier rendez-vous commercial",
    icon: "🤝",
    category: "commercial",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Premier RDV — [Nom du client / entreprise]

**Date :** [JJ/MM/AAAA]
**Interlocuteur :** [Nom, poste]
**Commercial :** [Nom]

---

## Préparation

### Informations recueillies avant le RDV

- **Secteur d'activité :** [À compléter]
- **Taille entreprise :** [À compléter]
- **Contexte identifié :** [À compléter]

### Questions à poser

- [ ] [Question sur le contexte]
- [ ] [Question sur les enjeux]
- [ ] [Question sur le budget / timing]
- [ ] [Question sur le processus de décision]

---

## Compte-rendu

### Contexte et enjeux exprimés

[Synthèse de ce que le client a exprimé]

### Besoins identifiés

-
-

### Budget et timing

- **Budget évoqué :** [À compléter]
- **Échéance souhaitée :** [À compléter]
- **Décideur(s) :** [Nom(s)]

### Objections rencontrées

-

## Qualification

| Critère | Évaluation |
|---------|------------|
| Besoin réel | Oui / Non / Partiel |
| Budget disponible | Oui / Non / À préciser |
| Décideur présent | Oui / Non |
| Urgence | Faible / Moyenne / Élevée |
| Adéquation offre | Forte / Moyenne / Faible |

## Actions suite au RDV

- [ ] [Action] — Échéance : [Date]
- [ ] [Action] — Échéance : [Date]

## Prochaine étape

[Décrire la suite convenue avec le client]
`,
    },
  },
  {
    id: "builtin_propale-commerciale",
    name: "Propale commerciale",
    description: "Structure de proposition commerciale à envoyer à un prospect",
    icon: "📄",
    category: "commercial",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Proposition commerciale — [Nom du client]

**Date :** [JJ/MM/AAAA]
**Valable jusqu'au :** [JJ/MM/AAAA]
**Commercial :** [Nom]

---

## Contexte et enjeux

[Rappel de la situation du client et des problématiques identifiées lors des échanges]

## Notre compréhension de vos besoins

-
-
-

## Notre proposition

### [Nom de l'offre / solution]

[Description de la solution proposée]

### Ce que nous vous apportons

| Bénéfice | Détail |
|----------|--------|
| | |
| | |

## Périmètre de la mission

### Inclus
-

### Exclus
-

## Planning prévisionnel

| Phase | Durée | Échéance |
|-------|-------|----------|
| [Phase 1] | | |
| [Phase 2] | | |

## Budget

| Prestation | Quantité | Prix unitaire | Total HT |
|------------|----------|---------------|----------|
| [Prestation 1] | | | |
| [Prestation 2] | | | |
| **Total HT** | | | |
| **TVA (20%)** | | | |
| **Total TTC** | | | |

## Prochaines étapes

- [ ] Validation de la proposition — [Date]
- [ ] Signature du bon de commande — [Date]
- [ ] Lancement — [Date]
`,
    },
  },
  {
    id: "builtin_compte-rendu-visite",
    name: "Compte-rendu de visite",
    description: "Compte-rendu après une visite client ou un déplacement terrain",
    icon: "🗺️",
    category: "commercial",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Compte-rendu de visite — [Nom du client]

**Date de la visite :** [JJ/MM/AAAA]
**Lieu :** [Adresse / site]
**Commercial :** [Nom]
**Interlocuteurs rencontrés :** [Noms et postes]

---

## Objectif de la visite

[Pourquoi cette visite avait-elle lieu ?]

## Déroulement

[Synthèse chronologique des échanges et des observations]

## Points abordés

| Sujet | Résumé | Suite à donner |
|-------|--------|----------------|
| | | |
| | | |

## Opportunités identifiées

-
-

## Points de vigilance

-
-

## Décisions prises

-

## Actions à mener

- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]
- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]

## Prochaine visite / contact

**Date prévue :** [À compléter]
**Objectif :** [À compléter]
`,
    },
  },

  // ── Projet ───────────────────────────────────────────────────────────────────
  {
    id: "builtin_note-de-projet",
    name: "Note de projet",
    description: "Document de cadrage pour un projet ou une initiative",
    icon: "🎯",
    category: "projet",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# [Nom du projet]

## Contexte

[Décrivez le contexte et la problématique]

## Objectifs

-
-

## Périmètre

### Inclus
-

### Exclus
-

## Planning prévisionnel

| Étape | Échéance | Responsable |
|-------|----------|-------------|
| Phase 1 | | |
| Phase 2 | | |

## Ressources nécessaires

-

## Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| | | | |

## Critères de succès

-
`,
    },
  },
  {
    id: "builtin_fiche-projet",
    name: "Fiche projet",
    description: "Fiche de cadrage synthétique pour initier un projet",
    icon: "🎯",
    category: "projet",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Fiche projet — [Nom du projet]

**Date de création :** [JJ/MM/AAAA]
**Commanditaire :** [Nom]
**Chef de projet :** [Nom]
**Version :** 1.0

---

## Résumé

[Décrivez en 2-3 phrases l'essentiel du projet]

## Contexte et problématique

[Décrivez le contexte et la problématique à laquelle répond ce projet]

## Objectifs

| Objectif | Indicateur de succès | Cible |
|----------|----------------------|-------|
| | | |
| | | |

## Périmètre

### Inclus
-

### Exclus
-

## Parties prenantes

| Rôle | Nom | Implication |
|------|-----|-------------|
| Commanditaire | | Décision |
| Chef de projet | | Pilotage |
| Contributeur | | Réalisation |
| Utilisateur final | | Validation |

## Contraintes

- **Budget :** [À compléter]
- **Délai :** [À compléter]
- **Ressources :** [À compléter]

## Risques principaux

| Risque | Impact | Probabilité |
|--------|--------|-------------|
| | | |

## Jalons clés

| Jalon | Date prévue |
|-------|-------------|
| Lancement | |
| Point intermédiaire | |
| Livraison finale | |

## Validation

- [ ] Validé par le commanditaire — [Date]
`,
    },
  },
  {
    id: "builtin_gestion-de-projet",
    name: "Gestion de projet",
    description: "Suivi opérationnel complet d'un projet en cours",
    icon: "📊",
    category: "projet",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Projet — [Nom du projet]

## Fiche synthèse

| Champ | Détail |
|-------|--------|
| **Client / Commanditaire** | |
| **Chef de projet** | |
| **Équipe** | |
| **Date de lancement** | [JJ/MM/AAAA] |
| **Échéance** | [JJ/MM/AAAA] |
| **Budget** | [Montant] |
| **Statut** | [En préparation / En cours / En pause / Terminé] |

## Objectifs

1.
2.
3.

## Livrables attendus

- [ ] [Livrable 1] — Échéance : [Date]
- [ ] [Livrable 2] — Échéance : [Date]
- [ ] [Livrable 3] — Échéance : [Date]

## Planning

| Phase | Début | Fin | Responsable | Statut |
|-------|-------|-----|-------------|--------|
| Cadrage | | | | |
| Conception | | | | |
| Réalisation | | | | |
| Recette | | | | |
| Mise en production | | | | |

## Risques et points de vigilance

| Risque | Probabilité | Impact | Action de mitigation | Responsable |
|--------|-------------|--------|----------------------|-------------|
| | | | | |

## Décisions clés

| Date | Décision | Décideur |
|------|----------|----------|
| | | |
`,
    },
  },
  {
    id: "builtin_tableau-de-suivi",
    name: "Tableau de suivi",
    description: "Tableau de bord opérationnel pour suivre les tâches et l'avancement d'un projet",
    icon: "📊",
    category: "projet",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Tableau de suivi — [Nom du projet]

**Responsable :** [Nom]
**Dernière mise à jour :** [JJ/MM/AAAA]
**Avancement global :** [X]%

---

## Suivi des tâches

| Tâche | Responsable | Statut | Priorité | Échéance | Notes |
|-------|-------------|--------|----------|----------|-------|
| [Tâche 1] | [Nom] | 🔵 En cours | Haute | [Date] | |
| [Tâche 2] | [Nom] | ⬜ À faire | Moyenne | [Date] | |
| [Tâche 3] | [Nom] | ✅ Terminé | Basse | [Date] | |

## Risques identifiés

| Risque | Impact | Probabilité | Mitigation | Responsable |
|--------|--------|-------------|------------|-------------|
| | | | | |

## Prochaines étapes

- [ ] [Action 1] — [Responsable] — [Échéance]
- [ ] [Action 2] — [Responsable] — [Échéance]
- [ ] [Action 3] — [Responsable] — [Échéance]

## Points bloquants

-
`,
    },
  },
  {
    id: "builtin_retrospective",
    name: "Rétrospective",
    description: "Bilan de fin de sprint ou de projet pour capitaliser sur les apprentissages",
    icon: "🔄",
    category: "projet",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Rétrospective — [Nom du projet / Sprint]

**Date :** [JJ/MM/AAAA]
**Participants :** [Noms]
**Animateur :** [Nom]
**Période couverte :** [Du JJ/MM au JJ/MM/AAAA]

---

## Bilan chiffré

| Indicateur | Prévu | Réalisé | Écart |
|------------|-------|---------|-------|
| [Indicateur 1] | | | |
| [Indicateur 2] | | | |

---

## Ce qui a bien fonctionné ✅

-
-
-

## Ce qui est à améliorer ⚠️

-
-
-

## Ce qui n'a pas fonctionné ❌

-
-

## Leçons apprises

| Leçon | À appliquer dès | Responsable |
|-------|-----------------|-------------|
| | | |
| | | |

## Actions d'amélioration

- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]
- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]
`,
    },
  },
  {
    id: "builtin_sprint-meeting",
    name: "Sprint Meeting",
    description: "Cérémonie agile : bilan du sprint précédent + planification du sprint suivant",
    icon: "🏃",
    category: "projet",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Sprint Meeting — Sprint [N]

**Date :** [JJ/MM/AAAA]
**Équipe :** [Nom de l'équipe]
**Scrum Master :** [Nom]
**Sprint :** [N] — Du [JJ/MM] au [JJ/MM/AAAA]

---

## Bilan du sprint précédent

**Vélocité :** [X] points

### Stories complétées ✅

-
-

### Stories non complétées ❌

-

### Retour qualité

-

---

## Planification du sprint actuel

**Objectif du sprint :**
[Décrivez l'objectif en une phrase]

**Capacité disponible :** [X] points

### Backlog sélectionné

| Story | Points | Responsable | Priorité |
|-------|--------|-------------|----------|
| | | | |
| | | | |
| | | | |

---

## Revue d'équipe

### Blocages identifiés

-

### Améliorations de process

-

## Prochaine cérémonie

**Date :** [JJ/MM/AAAA]
**Type :** [Standup / Revue / Rétro / Planning]
`,
    },
  },

  // ── Documentation ─────────────────────────────────────────────────────────────
  {
    id: "builtin_procedure",
    name: "Procédure",
    description: "Guide étape par étape pour un processus métier",
    icon: "📖",
    category: "documentation",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Procédure — [Titre]

**Version :** 1.0
**Dernière mise à jour :** [Date]
**Responsable :** [Nom]

---

## Objectif

[Décrivez l'objectif de cette procédure]

## Prérequis

-

## Étapes

### 1. [Première étape]

[Description détaillée]

### 2. [Deuxième étape]

[Description détaillée]

### 3. [Troisième étape]

[Description détaillée]

## Points d'attention

> ⚠️ [Points importants à ne pas oublier]

## En cas de problème

[Décrivez la marche à suivre en cas d'erreur]

## Contacts

- [Nom] — [Rôle] — [Contact]
`,
    },
  },
  {
    id: "builtin_procedure-operationnelle",
    name: "Procédure opérationnelle",
    description: "Procédure standard (SOP) pour documenter un processus métier de façon rigoureuse",
    icon: "📖",
    category: "documentation",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Procédure opérationnelle — [Titre]

**Référence :** [Code / numéro]
**Version :** 1.0
**Date de création :** [JJ/MM/AAAA]
**Dernière mise à jour :** [JJ/MM/AAAA]
**Responsable :** [Nom]
**Validé par :** [Nom]

---

## Objectif

[Décrivez l'objectif et le résultat attendu de cette procédure]

## Domaine d'application

[Précisez qui est concerné par cette procédure et dans quels cas elle s'applique]

## Prérequis

- [Prérequis 1]
- [Prérequis 2]

---

## Étapes

### Étape 1 — [Titre de l'étape]

**Responsable :** [Rôle]
**Durée estimée :** [À compléter]

[Description détaillée de l'étape]

### Étape 2 — [Titre de l'étape]

**Responsable :** [Rôle]
**Durée estimée :** [À compléter]

[Description détaillée de l'étape]

---

## Contrôles qualité

- [ ] [Point de contrôle 1]
- [ ] [Point de contrôle 2]

## En cas d'anomalie

[Décrivez la marche à suivre en cas d'erreur ou d'incident]

## Historique des révisions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | [Date] | [Nom] | Création |
`,
    },
  },
  {
    id: "builtin_faq-interne",
    name: "FAQ interne",
    description: "Foire aux questions pour centraliser les réponses aux questions récurrentes",
    icon: "❓",
    category: "documentation",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# FAQ — [Thème / Service / Produit]

**Dernière mise à jour :** [JJ/MM/AAAA]
**Responsable :** [Nom]
**Public cible :** [À compléter]

---

## [Thème 1 — ex : Accès et comptes]

### [Question 1 ?]

[Réponse claire et concise]

### [Question 2 ?]

[Réponse claire et concise]

---

## [Thème 2 — ex : Utilisation]

### [Question 3 ?]

[Réponse claire et concise]

---

## Vous ne trouvez pas votre réponse ?

- **Contact :** [Email / canal de support]
- **Documentation complète :** [Lien]
`,
    },
  },

  // ── Rapport ───────────────────────────────────────────────────────────────────
  {
    id: "builtin_rapport-hebdomadaire",
    name: "Rapport hebdomadaire",
    description: "Bilan hebdomadaire d'activité à destination du management ou de l'équipe",
    icon: "📈",
    category: "rapport",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Rapport hebdomadaire — Semaine [N] / [AAAA]

**Période :** Du [JJ/MM] au [JJ/MM/AAAA]
**Auteur :** [Nom]
**Destinataires :** [Noms]

---

## Résumé exécutif

[2-3 phrases résumant la semaine : avancement global, faits marquants, alertes]

---

## Réalisations de la semaine

- [Réalisation 1]
- [Réalisation 2]
- [Réalisation 3]

## Indicateurs clés

| Indicateur | Objectif | Réalisé | Tendance |
|------------|----------|---------|----------|
| [KPI 1] | | | ↑ ↓ → |
| [KPI 2] | | | ↑ ↓ → |
| [KPI 3] | | | ↑ ↓ → |

## En cours

| Tâche / Projet | Avancement | Échéance | Statut |
|----------------|------------|----------|--------|
| | [X]% | | 🔵 En cours |

## Blocages et risques

| Blocage / Risque | Impact | Action requise |
|------------------|--------|----------------|
| | | |

## Prévisions semaine prochaine

- [ ] [Action 1]
- [ ] [Action 2]
- [ ] [Action 3]
`,
    },
  },
  {
    id: "builtin_rapport-mensuel",
    name: "Rapport mensuel",
    description: "Bilan mensuel d'activité avec analyse des résultats et perspectives",
    icon: "📊",
    category: "rapport",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Rapport mensuel — [Mois AAAA]

**Auteur :** [Nom]
**Service / Équipe :** [À compléter]
**Destinataires :** [Noms]

---

## Résumé exécutif

[Synthèse en 3-5 phrases : bilan du mois, performances clés, points d'attention majeurs]

---

## 1. Résultats et indicateurs

| Indicateur | Objectif mensuel | Réalisé | Écart | Tendance |
|------------|------------------|---------|-------|----------|
| [KPI 1] | | | | ↑ ↓ → |
| [KPI 2] | | | | ↑ ↓ → |
| [KPI 3] | | | | ↑ ↓ → |

## 2. Activités du mois

### Réalisations majeures

-
-
-

### Projets en cours

| Projet | Avancement | Jalons atteints | Prochaine étape |
|--------|------------|-----------------|-----------------|
| | [X]% | | |

---

## 3. Difficultés et risques

| Problème / Risque | Impact | Actions mises en place |
|-------------------|--------|------------------------|
| | | |

---

## 4. Perspectives du mois prochain

### Objectifs

-
-

### Actions prioritaires

- [ ] [Action 1]
- [ ] [Action 2]
- [ ] [Action 3]
`,
    },
  },

  // ── Savoir ────────────────────────────────────────────────────────────────────
  {
    id: "builtin_fiche-de-connaissances",
    name: "Fiche de connaissances",
    description: "Synthèse structurée d'un sujet ou concept",
    icon: "💡",
    category: "savoir",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# [Sujet]

## Définition

[Définition claire et concise]

## Points clés

-
-
-

## Détail

[Développement du sujet]

## Exemples

[Exemples concrets]

## Liens connexes

- [[]]
- [[]]

## Sources

-
`,
    },
  },
  {
    id: "builtin_note-de-recherche",
    name: "Note de recherche",
    description: "Note structurée pour documenter une recherche ou une investigation",
    icon: "🔬",
    category: "savoir",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Note de recherche — [Sujet]

**Date :** [JJ/MM/AAAA]
**Auteur :** [Nom]
**Statut :** [En cours / Complétée]

---

## Question de recherche

[Quelle est la question précise à laquelle cette recherche cherche à répondre ?]

## Contexte et motivations

[Pourquoi cette recherche ? Dans quel cadre s'inscrit-elle ?]

---

## Sources consultées

| Source | Type | Date | Pertinence | URL / Référence |
|--------|------|------|------------|-----------------|
| | Article / Livre / Site | | Forte / Moyenne | |

---

## Synthèse des découvertes

### [Thème 1]

[Synthèse des éléments trouvés]

### [Thème 2]

[Synthèse des éléments trouvés]

---

## Conclusions provisoires

[Réponse partielle ou complète à la question de recherche]

## Pistes à approfondir

- [ ] [Piste 1]
- [ ] [Piste 2]
`,
    },
  },
  {
    id: "builtin_fiche-concept",
    name: "Fiche concept",
    description: "Fiche de synthèse pour documenter et expliquer un concept clé",
    icon: "💡",
    category: "savoir",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Fiche concept — [Nom du concept]

**Domaine :** [À compléter]
**Auteur :** [Nom]
**Date :** [JJ/MM/AAAA]

---

## Définition

[Définition claire et concise du concept en 1-3 phrases]

## Origine et contexte

[D'où vient ce concept ? Dans quel domaine est-il apparu ?]

---

## Points clés à retenir

-
-
-
-

---

## Explication détaillée

[Développement complet du concept, avec les nuances nécessaires]

---

## Exemples concrets

### Exemple 1

[Description d'un exemple illustrant le concept]

### Exemple 2

[Description d'un autre exemple]

---

## Ce que ce concept n'est PAS

[Clarifications pour éviter les confusions fréquentes]

---

## Concepts connexes

- **[Concept lié 1] :** [Relation avec le concept]
- **[Concept lié 2] :** [Relation avec le concept]

## Sources et pour aller plus loin

-
`,
    },
  },
  {
    id: "builtin_fiche-veille",
    name: "Fiche veille",
    description: "Fiche de veille pour capitaliser sur une découverte ou une actualité sectorielle",
    icon: "📡",
    category: "savoir",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Fiche veille — [Titre / Sujet]

**Date :** [JJ/MM/AAAA]
**Auteur :** [Nom]
**Source :** [Nom de la source — URL]
**Domaine :** [Technologie / Marché / Réglementation / Concurrence / Autre]

---

## Résumé en une phrase

[Résumez l'essentiel de l'information en une phrase]

---

## Contenu de la découverte

[Description factuelle et synthétique de l'information identifiée]

---

## Pourquoi c'est important

[En quoi cette information est-elle pertinente pour votre activité ?]

---

## Impact potentiel

| Dimension | Impact | Horizon |
|-----------|--------|---------|
| [Ex : marché] | Faible / Moyen / Fort | Court / Moyen / Long terme |
| [Ex : technique] | | |

---

## Actions à envisager

- [ ] [Action 1]
- [ ] [Action 2]
`,
    },
  },

  // ── Résolution ────────────────────────────────────────────────────────────────
  {
    id: "builtin_analyse-de-probleme",
    name: "Analyse de problème",
    description: "Structure pour analyser et résoudre un problème",
    icon: "🔍",
    category: "résolution",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Analyse — [Titre du problème]

## Description du problème

[Décrivez le problème de manière factuelle]

## Impact

- **Qui est affecté :**
- **Gravité :** [Faible / Moyen / Élevé / Critique]
- **Depuis quand :**

## Causes identifiées

### Causes racines (5 pourquoi)

1. Pourquoi ? →
2. Pourquoi ? →
3. Pourquoi ? →

## Solutions envisagées

| Solution | Avantages | Inconvénients | Effort |
|----------|-----------|---------------|--------|
| | | | |

## Solution retenue

[Décrivez la solution choisie et pourquoi]

## Plan d'action

- [ ] [Action 1]
- [ ] [Action 2]

## Suivi

| Date | Statut | Commentaire |
|------|--------|-------------|
| | | |
`,
    },
  },

  // ── Personnel ─────────────────────────────────────────────────────────────────
  {
    id: "builtin_journal-de-bord",
    name: "Journal de bord",
    description: "Notes quotidiennes et suivi d'activité",
    icon: "📅",
    category: "personnel",
    isGlobal: true,
    isBuiltin: true,
    content: {
      markdown: `# Journal — [Date]

## Réalisé aujourd'hui

- [ ]
- [ ]
- [ ]

## En cours

-

## Blocages / Questions

-

## À faire demain

- [ ]
- [ ]

## Notes

[Observations, idées, réflexions]
`,
    },
  },

  // ── Base de données ──────────────────────────────────────────────────────────
  {
    id: "builtin_base-clients",
    name: "Base de données clients",
    description: "Suivi des clients avec statut, contact et valeur estimée",
    icon: "👥",
    category: "base de données",
    isGlobal: true,
    isBuiltin: true,
    content: {
      database: {
        name: "Clients",
        columns: [
          { name: "Nom", type: "text" },
          { name: "Entreprise", type: "text" },
          { name: "Email", type: "email" },
          { name: "Téléphone", type: "text" },
          {
            name: "Statut",
            type: "select",
            config: {
              options: [
                { label: "Prospect", color: "#6366f1" },
                { label: "Client actif", color: "#22c55e" },
                { label: "Inactif", color: "#94a3b8" },
              ],
            },
          },
          { name: "Valeur estimée", type: "number" },
          { name: "Dernier contact", type: "date" },
        ],
      },
    },
  },
  {
    id: "builtin_base-utilisateurs",
    name: "Base de données utilisateurs",
    description: "Répertoire des utilisateurs avec rôles et statuts",
    icon: "👤",
    category: "base de données",
    isGlobal: true,
    isBuiltin: true,
    content: {
      database: {
        name: "Utilisateurs",
        columns: [
          { name: "Nom", type: "text" },
          { name: "Email", type: "email" },
          {
            name: "Rôle",
            type: "select",
            config: {
              options: [
                { label: "Admin", color: "#ef4444" },
                { label: "Éditeur", color: "#3b82f6" },
                { label: "Lecteur", color: "#94a3b8" },
              ],
            },
          },
          { name: "Service", type: "text" },
          { name: "Actif", type: "checkbox" },
          { name: "Date d'inscription", type: "date" },
        ],
      },
    },
  },
  {
    id: "builtin_base-fournisseurs",
    name: "Base de données fournisseurs",
    description: "Répertoire des fournisseurs avec catégories et évaluations",
    icon: "🏢",
    category: "base de données",
    isGlobal: true,
    isBuiltin: true,
    content: {
      database: {
        name: "Fournisseurs",
        columns: [
          { name: "Nom", type: "text" },
          {
            name: "Catégorie",
            type: "select",
            config: {
              options: [
                { label: "Logiciel", color: "#3b82f6" },
                { label: "Matériel", color: "#f59e0b" },
                { label: "Services", color: "#22c55e" },
                { label: "Sous-traitant", color: "#8b5cf6" },
              ],
            },
          },
          { name: "Contact", type: "text" },
          { name: "Email", type: "email" },
          { name: "Téléphone", type: "text" },
          {
            name: "Évaluation",
            type: "select",
            config: {
              options: [
                { label: "Excellent", color: "#22c55e" },
                { label: "Satisfaisant", color: "#3b82f6" },
                { label: "À surveiller", color: "#f59e0b" },
                { label: "Problématique", color: "#ef4444" },
              ],
            },
          },
          { name: "Contrat actif", type: "checkbox" },
        ],
      },
    },
  },
];

export function getBuiltinTemplateById(id: string): BuiltinTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}
