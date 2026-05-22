/**
 * Seed des templates de base
 * Usage : npx tsx scripts/seed-templates.ts
 */

import { db } from "../src/lib/db";
import { templates, users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const BASE_TEMPLATES = [
  {
    name: "Compte-rendu de réunion",
    description: "Structure pour documenter les décisions et actions d'une réunion",
    icon: "📋",
    category: "réunion",
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
    name: "Note de projet",
    description: "Document de cadrage pour un projet ou une initiative",
    icon: "🎯",
    category: "projet",
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
    name: "Procédure",
    description: "Guide étape par étape pour un processus métier",
    icon: "📖",
    category: "documentation",
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
    name: "Fiche de connaissances",
    description: "Synthèse structurée d'un sujet ou concept",
    icon: "💡",
    category: "savoir",
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
    name: "Journal de bord",
    description: "Notes quotidiennes et suivi d'activité",
    icon: "📅",
    category: "personnel",
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
  {
    name: "Gestion de nouveau lead",
    description: "Fiche de qualification et suivi d'un prospect entrant",
    icon: "🤝",
    category: "commercial",
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
    name: "Gestion de projet",
    description: "Suivi opérationnel complet d'un projet en cours",
    icon: "📊",
    category: "projet",
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

## Suivi d'avancement

### Semaine du [Date]

**Avancement global :** [X]%

**Réalisé :**
-

**En cours :**
-

**Blocages :**
-

## Risques et points de vigilance

| Risque | Probabilité | Impact | Action de mitigation | Responsable |
|--------|-------------|--------|----------------------|-------------|
| | | | | |

## Budget consommé

| Poste | Prévu | Réalisé | Écart |
|-------|-------|---------|-------|
| | | | |
| **Total** | | | |

## Décisions clés

| Date | Décision | Décideur |
|------|----------|----------|
| | | |

## Rétrospective (à remplir en fin de projet)

### Ce qui a bien fonctionné
-

### Ce qui est à améliorer
-

### Leçons apprises
-
`,
    },
  },
  {
    name: "CR Top 5",
    description: "Compte-rendu de réunion Top 5 — point quotidien ou hebdomadaire",
    icon: "⚡",
    category: "réunion",
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
    name: "Analyse de problème",
    description: "Structure pour analyser et résoudre un problème",
    icon: "🔍",
    category: "résolution",
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

  // --- Réunion ---
  {
    name: "CR de réunion",
    description: "Compte-rendu structuré avec décisions, actions et points en suspens",
    icon: "📋",
    category: "réunion",
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
    name: "Ordre du jour",
    description: "Trame d'ordre du jour à préparer avant une réunion",
    icon: "📅",
    category: "réunion",
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
    name: "Réunion de lancement",
    description: "Trame de kick-off pour démarrer un projet avec l'équipe",
    icon: "🚀",
    category: "réunion",
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

  // --- Commercial ---
  {
    name: "Premier RDV client",
    description: "Trame de préparation et de compte-rendu pour un premier rendez-vous commercial",
    icon: "🤝",
    category: "commercial",
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
    name: "Propale commerciale",
    description: "Structure de proposition commerciale à envoyer à un prospect",
    icon: "📄",
    category: "commercial",
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

## Notre approche

[Décrivez votre méthodologie, vos atouts différenciants]

## Budget

| Prestation | Quantité | Prix unitaire | Total HT |
|------------|----------|---------------|----------|
| [Prestation 1] | | | |
| [Prestation 2] | | | |
| **Total HT** | | | |
| **TVA (20%)** | | | |
| **Total TTC** | | | |

## Conditions

- **Modalités de paiement :** [À compléter]
- **Validité de l'offre :** [Date]

## Prochaines étapes

- [ ] Validation de la proposition — [Date]
- [ ] Signature du bon de commande — [Date]
- [ ] Lancement — [Date]

> **💡 Conseil :** Personnalisez les sections contexte et besoins avec les éléments recueillis lors de vos échanges pour maximiser l'impact.
`,
    },
  },
  {
    name: "Compte-rendu de visite",
    description: "Compte-rendu après une visite client ou un déplacement terrain",
    icon: "🗺️",
    category: "commercial",
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

  // --- Projet ---
  {
    name: "Fiche projet",
    description: "Fiche de cadrage synthétique pour initier un projet",
    icon: "🎯",
    category: "projet",
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
- **Techniques :** [À compléter]

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
    name: "Tableau de suivi",
    description: "Tableau de bord opérationnel pour suivre les tâches et l'avancement d'un projet",
    icon: "📊",
    category: "projet",
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

## Indicateurs clés

| Indicateur | Cible | Réalisé | Tendance |
|------------|-------|---------|----------|
| | | | |

## Décisions récentes

| Date | Décision | Décideur |
|------|----------|----------|
| | | |

## Prochaines étapes

- [ ] [Action 1] — [Responsable] — [Échéance]
- [ ] [Action 2] — [Responsable] — [Échéance]
- [ ] [Action 3] — [Responsable] — [Échéance]

## Points bloquants

-

> **💡 Conseil :** Mettez à jour ce tableau à chaque réunion de suivi ou à minima une fois par semaine.
`,
    },
  },
  {
    name: "Rétrospective",
    description: "Bilan de fin de sprint ou de projet pour capitaliser sur les apprentissages",
    icon: "🔄",
    category: "projet",
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

## Causes identifiées

[Analyse des causes des difficultés rencontrées]

## Leçons apprises

| Leçon | À appliquer dès | Responsable |
|-------|-----------------|-------------|
| | | |
| | | |

## Actions d'amélioration

- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]
- [ ] [Action] — Responsable : [Nom] — Échéance : [Date]

## Remerciements et reconnaissance

[Mentionnez les contributions remarquables de l'équipe]
`,
    },
  },

  // --- Documentation ---
  {
    name: "Procédure opérationnelle",
    description: "Procédure standard (SOP) pour documenter un processus métier de façon rigoureuse",
    icon: "📖",
    category: "documentation",
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

## Matériel / Outils nécessaires

-

---

## Étapes

### Étape 1 — [Titre de l'étape]

**Responsable :** [Rôle]
**Durée estimée :** [À compléter]

[Description détaillée de l'étape]

> **💡 Conseil :** [Conseil ou point d'attention]

### Étape 2 — [Titre de l'étape]

**Responsable :** [Rôle]
**Durée estimée :** [À compléter]

[Description détaillée de l'étape]

### Étape 3 — [Titre de l'étape]

[Description détaillée de l'étape]

---

## Contrôles qualité

- [ ] [Point de contrôle 1]
- [ ] [Point de contrôle 2]

## En cas d'anomalie

[Décrivez la marche à suivre en cas d'erreur ou d'incident]

## Indicateurs de performance

| Indicateur | Cible |
|------------|-------|
| | |

## Historique des révisions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | [Date] | [Nom] | Création |
`,
    },
  },
  {
    name: "FAQ interne",
    description: "Foire aux questions pour centraliser les réponses aux questions récurrentes",
    icon: "❓",
    category: "documentation",
    content: {
      markdown: `# FAQ — [Thème / Service / Produit]

**Dernière mise à jour :** [JJ/MM/AAAA]
**Responsable :** [Nom]
**Public cible :** [À compléter]

---

> **💡 Conseil :** Structurez les questions par thème et ordonnez-les des plus fréquentes aux moins fréquentes.

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

### [Question 4 ?]

[Réponse claire et concise]

---

## [Thème 3 — ex : Problèmes fréquents]

### [Question 5 ?]

[Réponse claire et concise]

---

## Vous ne trouvez pas votre réponse ?

- **Contact :** [Email / canal de support]
- **Documentation complète :** [Lien]

---

## Contribuer à cette FAQ

Si vous avez une question qui n'est pas encore traitée, contactez [Nom] à [Email].
`,
    },
  },

  // --- Rapport ---
  {
    name: "Rapport hebdomadaire",
    description: "Bilan hebdomadaire d'activité à destination du management ou de l'équipe",
    icon: "📈",
    category: "rapport",
    content: {
      markdown: `# Rapport hebdomadaire — Semaine [N] / [AAAA]

**Période :** Du [JJ/MM] au [JJ/MM/AAAA]
**Auteur :** [Nom]
**Destinataires :** [Noms]
**Date de rédaction :** [JJ/MM/AAAA]

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
| | [X]% | | ⚠️ Retard |

## Blocages et risques

| Blocage / Risque | Impact | Action requise |
|------------------|--------|----------------|
| | | |

## Prévisions semaine prochaine

- [ ] [Action 1]
- [ ] [Action 2]
- [ ] [Action 3]

## Points à escalader

-
`,
    },
  },
  {
    name: "Rapport mensuel",
    description: "Bilan mensuel d'activité avec analyse des résultats et perspectives",
    icon: "📊",
    category: "rapport",
    content: {
      markdown: `# Rapport mensuel — [Mois AAAA]

**Auteur :** [Nom]
**Service / Équipe :** [À compléter]
**Destinataires :** [Noms]
**Date de rédaction :** [JJ/MM/AAAA]

---

## Résumé exécutif

[Synthèse en 3-5 phrases : bilan du mois, performances clés, points d'attention majeurs]

---

## 1. Résultats et indicateurs

### Tableau de bord

| Indicateur | Objectif mensuel | Réalisé | Écart | Tendance |
|------------|------------------|---------|-------|----------|
| [KPI 1] | | | | ↑ ↓ → |
| [KPI 2] | | | | ↑ ↓ → |
| [KPI 3] | | | | ↑ ↓ → |

### Analyse des résultats

[Commentez les performances, expliquez les écarts significatifs]

---

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

---

## 5. Ressources et budget

| Poste | Budget | Consommé | Reste |
|-------|--------|----------|-------|
| | | | |
| **Total** | | | |

---

## Points à soumettre à la direction

-
`,
    },
  },

  // --- Savoir ---
  {
    name: "Note de recherche",
    description: "Note structurée pour documenter une recherche ou une investigation",
    icon: "🔬",
    category: "savoir",
    content: {
      markdown: `# Note de recherche — [Sujet]

**Date :** [JJ/MM/AAAA]
**Auteur :** [Nom]
**Statut :** [En cours / Complétée]
**Tags :** [tag1, tag2]

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
| | | | | |

---

## Synthèse des découvertes

### [Thème 1]

[Synthèse des éléments trouvés]

### [Thème 2]

[Synthèse des éléments trouvés]

---

## Points de convergence

-
-

## Points de divergence ou incertitudes

-
-

## Conclusions provisoires

[Réponse partielle ou complète à la question de recherche]

## Pistes à approfondir

- [ ] [Piste 1]
- [ ] [Piste 2]

## Références bibliographiques

-
`,
    },
  },
  {
    name: "Fiche concept",
    description: "Fiche de synthèse pour documenter et expliquer un concept clé",
    icon: "💡",
    category: "savoir",
    content: {
      markdown: `# Fiche concept — [Nom du concept]

**Domaine :** [À compléter]
**Auteur :** [Nom]
**Date :** [JJ/MM/AAAA]

---

## Définition

[Définition claire et concise du concept en 1-3 phrases]

## Origine et contexte

[D'où vient ce concept ? Dans quel domaine est-il apparu ? Par qui a-t-il été théorisé ?]

---

## Points clés à retenir

-
-
-
-

---

## Explication détaillée

[Développement complet du concept, avec les nuances nécessaires]

### [Aspect 1]

[Explication]

### [Aspect 2]

[Explication]

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

## Applications pratiques

-
-

## Sources et pour aller plus loin

-
`,
    },
  },
  {
    name: "Fiche veille",
    description: "Fiche de veille pour capitaliser sur une découverte ou une actualité sectorielle",
    icon: "📡",
    category: "savoir",
    content: {
      markdown: `# Fiche veille — [Titre / Sujet]

**Date :** [JJ/MM/AAAA]
**Auteur :** [Nom]
**Source :** [Nom de la source — URL]
**Domaine :** [Technologie / Marché / Réglementation / Concurrence / Autre]
**Tags :** [tag1, tag2]

---

## Résumé en une phrase

[Résumez l'essentiel de l'information en une phrase]

---

## Contenu de la découverte

[Description factuelle et synthétique de l'information, de la tendance ou de l'innovation identifiée]

---

## Pourquoi c'est important

[En quoi cette information est-elle pertinente pour votre activité, votre secteur ou votre projet ?]

---

## Impact potentiel

| Dimension | Impact | Horizon |
|-----------|--------|---------|
| [Ex : marché] | Faible / Moyen / Fort | Court / Moyen / Long terme |
| [Ex : technique] | | |
| [Ex : réglementaire] | | |

---

## Actions à envisager

- [ ] [Action 1]
- [ ] [Action 2]

## Personnes à informer

-

## Sources complémentaires

-

> **💡 Conseil :** Intégrez cette fiche dans un espace de veille dédié et partagez-la avec les personnes concernées dès que possible.
`,
    },
  },
  // --- Nouveaux templates ---
  {
    name: "CR réunion interne",
    description: "Compte-rendu léger pour réunion d'équipe, usage interne uniquement",
    icon: "🔒",
    category: "réunion",
    content: {
      markdown: `> 🔒 **Confidentiel — usage interne**

# CR réunion interne — [Titre]

**Date :** [JJ/MM/AAAA]
**Heure :** [HH:MM – HH:MM]
**Équipe :** [Nom de l'équipe]
**Animateur :** [Nom]
**Présents :** [Noms]

---

## Ce dont on a parlé

[Résumé synthétique des échanges — style décontracté, points clés uniquement]

## Décisions

- [ ] [Décision 1]
- [ ] [Décision 2]

## À faire

| Action | Qui | Quand |
|--------|-----|-------|
| | | |
| | | |

## À surveiller

- [Point de vigilance ou question ouverte]
`,
    },
  },
  {
    name: "Suivi client",
    description: "Fiche vivante de suivi d'un client : contacts, historique, statut contrat",
    icon: "🏢",
    category: "commercial",
    content: {
      markdown: `# Suivi client — [Nom du client]

## Informations générales

| Champ | Détail |
|-------|--------|
| **Société** | |
| **Secteur** | |
| **Interlocuteur principal** | [Nom, poste] |
| **Email** | |
| **Téléphone** | |
| **Adresse** | |
| **Site web** | |
| **Client depuis** | [JJ/MM/AAAA] |
| **Statut contrat** | [En cours / Renouvellement / Suspendu / Clôturé] |
| **Valeur contrat** | [Montant HT/an] |
| **Prochaine échéance** | [JJ/MM/AAAA] |

---

## Historique des contacts

| Date | Type | Interlocuteur | Résumé | Suite |
|------|------|---------------|--------|-------|
| [JJ/MM/AAAA] | [Appel / Email / RDV / Visite] | [Nom] | | |

---

## Projets et missions en cours

| Mission | Statut | Échéance | Responsable |
|---------|--------|----------|-------------|
| | [En cours / En attente / Terminé] | | |

---

## Prochaines étapes

- [ ] [Action] — Échéance : [Date]
- [ ] [Action] — Échéance : [Date]

---

## Notes et contexte

[Informations importantes sur le client, sa culture, ses enjeux, les points de vigilance relationnels]

---

## Satisfaction et risques

- **Niveau de satisfaction :** [Très satisfait / Satisfait / Neutre / Insatisfait]
- **Risque de résiliation :** [Faible / Moyen / Élevé]
- **Opportunités identifiées :**
  -
`,
    },
  },
  {
    name: "TOP 5 hebdo",
    description: "5 priorités de la semaine avec responsable, avancement et indicateur RAG",
    icon: "🎯",
    category: "réunion",
    content: {
      markdown: `# TOP 5 — Semaine [N] / [AAAA]

**Équipe :** [Nom]
**Date :** [JJ/MM/AAAA]

---

| # | Priorité | Responsable | Avancement | RAG | Commentaire |
|---|----------|-------------|------------|-----|-------------|
| 1 | | | [X]% | 🟢 | |
| 2 | | | [X]% | 🟡 | |
| 3 | | | [X]% | 🔴 | |
| 4 | | | [X]% | 🟢 | |
| 5 | | | [X]% | 🟢 | |

> **RAG :** 🟢 En bonne voie · 🟡 Risque identifié · 🔴 Bloqué / En retard

---

## Décisions de la semaine

-

## Blocages à escalader

-

## Focus semaine prochaine

1.
2.
3.
`,
    },
  },
  {
    name: "Sprint Meeting",
    description: "Trame de réunion de sprint : objectifs, backlog sélectionné, démos, rétrospective",
    icon: "🏃",
    category: "projet",
    content: {
      markdown: `# Sprint [N] — [Dates du sprint]

**Équipe :** [Nom]
**Product Owner :** [Nom]
**Scrum Master :** [Nom]
**Vélocité cible :** [X] points

---

## 1. Revue du sprint précédent

**Vélocité réalisée :** [X] / [X] points

| User Story | Points | Statut |
|------------|--------|--------|
| | | ✅ Terminé / ❌ Non terminé / 🔄 Reporté |

**Taux de complétion :** [X]%

---

## 2. Objectifs du sprint [N]

> [Décrivez en 1-2 phrases l'objectif principal de ce sprint]

---

## 3. Backlog sélectionné

| # | User Story | Points | Assigné à | Critères d'acceptance |
|---|------------|--------|-----------|----------------------|
| | | | | |
| | | | | |
| | | | | |

**Total points :** [X]

---

## 4. Démos prévues

- [ ] [Feature 1] — démo par [Nom]
- [ ] [Feature 2] — démo par [Nom]

---

## 5. Rétrospective

### ✅ Ce qui a bien fonctionné
-

### ⚠️ Ce qui est à améliorer
-

### 🎯 Action d'amélioration retenue
- **Action :** [Description]
- **Responsable :** [Nom]
- **Échéance :** [Sprint N+1]

---

## 6. Risques identifiés pour ce sprint

-

## 7. Dépendances externes

-
`,
    },
  },
  {
    name: "Base de données clients",
    description: "Base clients avec colonnes pré-configurées : société, contact, secteur, statut",
    icon: "🏢",
    category: "base de données",
    content: {
      markdown: `# Base de données clients

Centralisez ici l'ensemble de vos clients et prospects. La base de données ci-dessous est pré-configurée avec les champs essentiels.

## Mode d'emploi

- **Ajouter une ligne** : cliquez sur le bouton « + Ajouter une ligne » en bas du tableau
- **Modifier une cellule** : double-cliquez sur la cellule pour l'éditer
- **Trier / filtrer** : utilisez les contrôles en tête de colonne
- **Statuts disponibles** : Prospect → Actif → Inactif → Archivé

## Colonnes pré-configurées

| Colonne | Type | Description |
| --- | --- | --- |
| Nom | Texte | Nom du contact principal |
| Société | Texte | Raison sociale |
| Email | Email | Adresse email (lien cliquable) |
| Téléphone | Texte | Numéro direct |
| Secteur | Texte | Secteur d'activité |
| Statut | Sélection | Avancement de la relation |
| Date premier contact | Date | Traçabilité de l'entrée en relation |
| Notes | Texte | Informations complémentaires libres |
`,
      database: {
        name: "Clients",
        columns: [
          { name: "Nom", type: "text" },
          { name: "Société", type: "text" },
          { name: "Email", type: "email" },
          { name: "Téléphone", type: "text" },
          { name: "Secteur", type: "text" },
          {
            name: "Statut",
            type: "select",
            config: { options: ["Prospect", "Actif", "Inactif", "Archivé"] },
          },
          { name: "Date premier contact", type: "date" },
          { name: "Notes", type: "text" },
        ],
      },
    },
  },
  {
    name: "Base de données utilisateurs",
    description: "Répertoire des utilisateurs/collaborateurs avec rôle, équipe et statut",
    icon: "👥",
    category: "base de données",
    content: {
      markdown: `# Base de données utilisateurs

Répertoire interne des collaborateurs de l'organisation. Chaque ligne correspond à un membre de l'équipe.

## Mode d'emploi

- **Ajouter un collaborateur** : cliquez sur « + Ajouter une ligne »
- **Rôles usuels** : Admin, Manager, Collaborateur, Stagiaire
- **Statuts** : Actif (en poste), Congé (absence temporaire), Départ (ex-collaborateur)

## Colonnes pré-configurées

| Colonne | Type | Description |
| --- | --- | --- |
| Nom | Texte | Nom de famille |
| Prénom | Texte | Prénom |
| Rôle | Texte | Fonction dans l'organisation |
| Équipe | Texte | Service ou département |
| Email | Email | Adresse professionnelle |
| Date d'entrée | Date | Date de prise de poste |
| Statut | Sélection | Situation actuelle |
`,
      database: {
        name: "Utilisateurs",
        columns: [
          { name: "Nom", type: "text" },
          { name: "Prénom", type: "text" },
          { name: "Rôle", type: "text" },
          { name: "Équipe", type: "text" },
          { name: "Email", type: "email" },
          { name: "Date d'entrée", type: "date" },
          {
            name: "Statut",
            type: "select",
            config: { options: ["Actif", "Inactif", "Congé", "Départ"] },
          },
        ],
      },
    },
  },
  {
    name: "Base de données fournisseurs",
    description: "Annuaire fournisseurs avec conditions, délais et évaluation",
    icon: "🚚",
    category: "base de données",
    content: {
      markdown: `# Base de données fournisseurs

Centralisez ici vos fournisseurs et prestataires. Chaque ligne représente un partenaire externe.

## Mode d'emploi

- **Ajouter un fournisseur** : cliquez sur « + Ajouter une ligne »
- **Évaluation** : de ⭐ (insatisfaisant) à ⭐⭐⭐⭐⭐ (excellent)
- **Délai de livraison** : renseignez sous la forme « J+3 », « 2 semaines », etc.

## Colonnes pré-configurées

| Colonne | Type | Description |
| --- | --- | --- |
| Nom | Texte | Raison sociale |
| Contact | Texte | Nom du contact commercial |
| Catégorie | Texte | Type de produit ou service fourni |
| Email | Email | Adresse du contact |
| Téléphone | Texte | Numéro direct |
| Délai livraison | Texte | Délai habituel (ex. J+5) |
| Conditions paiement | Texte | Ex. 30 jours fin de mois |
| Évaluation | Sélection | Note qualitative |
`,
      database: {
        name: "Fournisseurs",
        columns: [
          { name: "Nom", type: "text" },
          { name: "Contact", type: "text" },
          { name: "Catégorie", type: "text" },
          { name: "Email", type: "email" },
          { name: "Téléphone", type: "text" },
          { name: "Délai livraison", type: "text" },
          { name: "Conditions paiement", type: "text" },
          {
            name: "Évaluation",
            type: "select",
            config: { options: ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"] },
          },
        ],
      },
    },
  },
];

async function seed() {
  console.log("Seeding templates...\n");

  // Trouver un admin pour l'attribution
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.globalRole, "super_admin"))
    .limit(1);

  if (!admin) {
    console.error("Aucun admin trouvé. Lancez d'abord seed-dev-users.ts");
    process.exit(1);
  }

  for (const t of BASE_TEMPLATES) {
    // Vérifier si le template existe déjà
    const existing = await db
      .select()
      .from(templates)
      .where(eq(templates.name, t.name))
      .limit(1);

    if (existing.length > 0) {
      await db.update(templates)
        .set({ description: t.description, icon: t.icon, content: t.content })
        .where(eq(templates.name, t.name));
      console.log(`  ↻ "${t.name}" mis à jour`);
      continue;
    }

    await db.insert(templates).values({
      name: t.name,
      description: t.description,
      icon: t.icon,
      category: t.category,
      content: t.content,
      createdBy: admin.id,
      isGlobal: true,
    });

    console.log(`  ✓ "${t.name}"`);
  }

  console.log("\nDone!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Erreur seed templates:", err);
  process.exit(1);
});
