# NOTICE — Dépendances tierces

LorIAx OSS embarque des bibliothèques tierces, distribuées sous leurs licences respectives. Cette liste recense les dépendances principales et leurs licences ; pour la liste exhaustive, voir `package.json` et l'outil de votre choix (`npm-license-checker`, `license-checker-rseidelsohn`).

## Cœur applicatif

| Dépendance | Licence |
|------------|---------|
| Next.js | MIT |
| React, React DOM | MIT |
| TypeScript | Apache-2.0 |
| Tailwind CSS | MIT |
| @base-ui/react | MIT |
| Drizzle ORM, drizzle-kit | Apache-2.0 |
| node-postgres (pg) | MIT |
| NextAuth (next-auth) | ISC |
| Zod | MIT |

## Éditeur et collaboration

| Dépendance | Licence |
|------------|---------|
| TipTap (extensions @tiptap/*) | MIT |
| Yjs, y-prosemirror, y-protocols | MIT |
| Hocuspocus (@hocuspocus/*) | MIT |
| tiptap-markdown | MIT |
| lowlight | MIT |
| Excalidraw (@excalidraw/excalidraw) | MIT |
| Mind Elixir | MIT |
| Univer (@univerjs/*) | Apache-2.0 |
| Recharts | MIT |
| ExcelJS | MIT |

## Médias et stockage

| Dépendance | Licence |
|------------|---------|
| @aws-sdk/* (S3 client) | Apache-2.0 |
| Sharp | Apache-2.0 |
| @ffmpeg/ffmpeg, @ffmpeg/util | MIT |
| ffmpeg-static, fluent-ffmpeg | MIT |
| Fabric.js | MIT |
| Leaflet, react-leaflet | BSD-2-Clause / Hippocratic |

## Visio, audio, IA

| Dépendance | Licence |
|------------|---------|
| LiveKit (livekit-client, server-sdk, components) | Apache-2.0 |
| @ai-sdk/* (Vercel AI SDK) | Apache-2.0 |
| Ollama (client) | MIT |

## Auth et sécurité

| Dépendance | Licence |
|------------|---------|
| bcryptjs | MIT |
| jose | MIT |
| ldapjs | MIT |

## Utilitaires

| Dépendance | Licence |
|------------|---------|
| lucide-react | ISC |
| sonner | MIT |
| cmdk | MIT |
| @dnd-kit/* | MIT |
| @tanstack/react-virtual | MIT |
| swr | MIT |
| ioredis | MIT |
| croner | MIT |
| pino | MIT |
| serwist (@serwist/*) | BSD-3-Clause |
| isomorphic-git | MIT |
| metascraper (+ metascraper-*) | MIT |
| nodemailer | MIT |
| resend | MIT |

## Polices et icônes

- **Lucide icons** — ISC.
- Polices système par défaut (aucune police propriétaire bundled).

## Stockage objet recommandé

[Garage](https://garagehq.deuxfleurs.fr/) (AGPL-3.0) est recommandé pour l'auto-hébergement S3 ; il s'exécute en tant que service externe (pas embarqué) et n'affecte donc pas la licence MIT de LorIAx OSS. Tout fournisseur S3-compatible fonctionne.

## Vérification

Pour générer un rapport à jour :

```bash
npx license-checker-rseidelsohn --production --summary
```

Si vous détectez une incompatibilité de licence, ouvrez une issue.
