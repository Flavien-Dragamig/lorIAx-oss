# Changelog

Toutes les modifications notables sont consignées dans ce fichier.

Le format est inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le projet suit [Semantic Versioning](https://semver.org/lang/fr/).

## [1.21.0] — 2026-05-22

### Ajouté

- Première publication open source à partir du code de production LorIAx.
- Licence MIT, copyright Dragamig SAS.

### Retiré

- Module chat d'équipe (réservé à l'édition commerciale).
- Module tasks et vue Gantt.
- Studio vidéo / audio et banques d'images.
- Studio design (intégration Penpot).
- Réservation de salles de réunion et rôle `facility_manager`.
- UI de gestion d'espaces (le modèle est conservé, l'UI de création retirée).

### Modifié

- Migrations Drizzle consolidées en une migration de bootstrap `0000_initial.sql`.
- Éditeur TipTap : extension `TaskItem` standard (sans assignation utilisateur).
