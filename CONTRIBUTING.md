# Contribuer à LorIAx OSS

Merci de l'intérêt porté à ce projet. Cette édition open source est maintenue par **Dragamig SAS**.

## Avant de contribuer

- Ouvrez une **issue** pour discuter d'un changement non-trivial avant d'ouvrir une PR.
- Les contributions doivent rester compatibles avec la licence MIT (pas de code copié d'un projet sous licence copyleft).
- Le projet vise l'auto-hébergement par des organismes — privilégier la **frugalité** (peu de dépendances, pas de SaaS externe imposé).

## Workflow

1. Fork + branche thématique (`feat/...`, `fix/...`, `chore/...`).
2. **Conventional Commits** obligatoires (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`).
3. Vérifier :
   ```bash
   npx tsc --noEmit
   npm run lint
   npm test
   ```
4. Ouvrir une PR avec une description claire (problème → solution → tests).

## Conventions

- **TypeScript strict**, alias `@/` pour `src/`.
- **Langue** : français pour l'UI utilisateur, anglais pour le code.
- **DB** : snake_case (Drizzle). **Code** : camelCase. **Composants** : PascalCase.
- **Style** : Tailwind utility-first, composants shadcn/ui (`@base-ui/react` — `render={}`, pas `asChild`).
- **Sécurité** : pas de secret en dur, validation Zod aux frontières, vérifier session NextAuth dans tout handler API.

## Structure

Voir [`CLAUDE.md`](./.claude/CLAUDE.md) pour la cartographie du repo.

## Périmètre

Les modules retirés de l'édition open source (chat, tasks, video-editor, design studio, meeting-rooms) **ne seront pas réintégrés** ici. Pour des fonctionnalités équivalentes, ouvrez une issue ou contactez Dragamig SAS pour l'édition commerciale.

## Code de conduite

Respect, bienveillance, et patience. Les comportements hostiles entraînent un retrait de l'espace de discussion.
