# Intégration LiveKit — Visioconférence et transcription IA

## Architecture

```
┌──────────────┐     WebRTC     ┌──────────────────┐
│   Navigateur │ ◄────────────► │  LiveKit Server   │
│  (React SDK) │                │  (Go, port 7880)  │
└──────┬───────┘                └────────┬──────────┘
       │                                 │
       │ REST API                        │ Egress API
       ▼                                 ▼
┌──────────────┐                ┌──────────────────┐
│  Next.js API │                │  LiveKit Egress   │
│  /api/meet/* │                │  (enregistrement) │
└──────┬───────┘                └────────┬──────────┘
       │                                 │
       │ Pipeline post-réunion           │ Fichiers .ogg
       ▼                                 ▼
┌──────────────┐                ┌──────────────────┐
│  Whisper API │ ◄──────────────│  /recordings/     │
│  (WhisperX)  │                │  {room}_{ts}.ogg  │
└──────┬───────┘                └──────────────────┘
       │ Transcript JSON
       ▼
┌──────────────┐
│  LLM (Claude │
│  / Ollama)   │
└──────┬───────┘
       │ Résumé structuré
       ▼
┌──────────────┐
│  Document    │
│  Markdown    │
└──────────────┘
```

### Composants

- **LiveKit Server** : SFU (Selective Forwarding Unit) WebRTC, écrit en Go. Gère les salles, les participants et le routage média.
- **LiveKit Egress** : service d'enregistrement qui capture l'audio/vidéo des salles et écrit des fichiers `{roomName}_{timestamp}.ogg` dans le répertoire configuré.
- **@livekit/components-react** : SDK React pour l'interface de visioconférence (composants pré-construits, hooks).
- **livekit-server-sdk** : SDK Node.js pour la génération de tokens d'accès côté serveur.
- **Whisper (WhisperX)** : transcription audio post-réunion avec diarization (identification des locuteurs).
- **LLM** : résumé structuré du transcript via Vercel AI SDK (Claude, OpenAI ou Ollama).

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `LIVEKIT_ENABLED` | `false` | Activer l'intégration visioconférence |
| `LIVEKIT_URL` | `ws://localhost:7880` | URL WebSocket du serveur LiveKit |
| `LIVEKIT_API_KEY` | — | Clé API LiveKit (générée dans livekit.yaml) |
| `LIVEKIT_API_SECRET` | — | Secret API LiveKit |
| `LIVEKIT_EGRESS_PATH` | `/recordings` | Répertoire des enregistrements Egress |
| `WHISPER_ENABLED` | `false` | Activer la transcription post-réunion |
| `WHISPER_API_URL` | `http://localhost:9000` | URL du service Whisper |
| `WHISPER_MODEL` | `base` | Modèle Whisper (tiny/base/small/medium/large) |
| `WHISPER_LANGUAGE` | `fr` | Langue par défaut |
| `WHISPER_DIARIZE` | `false` | Identification des locuteurs (pyannote.audio) |
| `WHISPER_MIN_SPEAKERS` | — | Nombre minimum de locuteurs (optionnel) |
| `WHISPER_MAX_SPEAKERS` | — | Nombre maximum de locuteurs (optionnel) |
| `HF_TOKEN` | — | Token HuggingFace (requis pour la diarization) |

## Routes API

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/meet/rooms` | Créer une salle de réunion |
| `GET` | `/api/meet/rooms` | Lister les réunions |
| `POST` | `/api/meet/token` | Générer un token d'accès LiveKit |
| `GET` | `/api/meet/config` | Configuration LiveKit côté client |
| `GET` | `/api/meet/rooms/[id]` | Détails d'une réunion |
| `POST` | `/api/meet/rooms/[id]/activate` | Activer une réunion |
| `POST` | `/api/meet/rooms/[id]/end` | Terminer + lancer pipeline transcription |
| `GET` | `/api/meet/rooms/[id]/status` | Polling du statut de transcription |

## Docker

### Lancement

```bash
# 1. Configurer les variables d'environnement
cat >> .env.local << 'EOF'
LIVEKIT_ENABLED=true
LIVEKIT_URL=ws://livekit:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
WHISPER_ENABLED=true
WHISPER_DIARIZE=true
EOF

# 2. Lancer avec l'overlay LiveKit
docker compose -f docker-compose.yml -f docker-compose.livekit.yml up -d

# 3. Avec Whisper (optionnel)
docker compose -f docker-compose.yml -f docker-compose.livekit.yml --profile whisper up -d
```

### Services

| Service | Port | Rôle |
|---------|------|------|
| livekit | 7880, 7881, 7882/udp | Serveur SFU WebRTC |
| livekit-egress | interne | Enregistrement audio/vidéo |
| whisper | interne | Transcription WhisperX (profil optionnel) |

### Configuration LiveKit

Le fichier `docker/livekit/livekit.yaml` contient la configuration du serveur LiveKit (clés API, ports, TURN, etc.).

Le fichier `docker/livekit/egress.yaml` configure le service Egress (format de sortie, répertoire d'enregistrement).

### Diarization (identification des locuteurs)

Pour activer la diarization via pyannote.audio :

1. Créer un compte sur [huggingface.co](https://huggingface.co)
2. Accepter la licence du modèle [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
3. Générer un token : [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
4. Ajouter dans `.env.local` : `HF_TOKEN=hf_...`

## Pipeline post-réunion (transcription + résumé IA)

Le pipeline est identique dans son fonctionnement, seule la source d'enregistrement change (LiveKit Egress au lieu de Jibri) :

1. **Fin de réunion** (`POST /api/meet/rooms/[id]/end`) : le statut passe à `ended`
2. **Recherche enregistrement** (`recording.ts`) : scanne `LIVEKIT_EGRESS_PATH` pour `{roomName}_{timestamp}.ogg`
3. **Transcription** (`transcribe.ts`) : envoi du fichier audio à Whisper API (HTTP POST). Si diarization activée, WhisperX identifie les locuteurs. Statut : `transcribing`
4. **Résumé IA** (`summarize.ts`) : prompt LLM via Vercel AI SDK (même provider que le chat IA). Génère un compte-rendu structuré en Markdown. Statut : `summarizing`
5. **Création document** (`meeting-notes.ts`) : crée un document LorIAx `.md` dans l'espace de la réunion, lié à la réunion. Statut : `completed`

En cas d'erreur à toute étape, le statut passe à `failed`.

## Tables BDD

Les tables sont inchangées par rapport à l'ancienne intégration :

- **`meetings`** : id, title, roomName (unique), spaceId, documentId, notesDocumentId, status (enum), recordingPath, transcriptPath, startedAt, endedAt, createdBy
- **`meeting_participants`** : id, meetingId, userId, displayName, joinedAt, leftAt
- **Enum `meeting_status`** : `scheduled`, `active`, `ended`, `transcribing`, `summarizing`, `completed`, `failed`

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/lib/meet/livekit-config.ts` | Configuration LiveKit (URL, clés) |
| `src/lib/meet/livekit-token.ts` | Génération de tokens d'accès LiveKit |
| `src/lib/meet/rooms.ts` | CRUD réunions |
| `src/lib/meet/recording.ts` | Détection fichiers audio post-réunion |
| `src/lib/meet/transcribe.ts` | Appel Whisper API (diarization incluse) |
| `src/lib/meet/summarize.ts` | Prompt LLM résumé |
| `src/lib/meet/meeting-notes.ts` | Création document compte-rendu |
| `src/components/meet/livekit-room.tsx` | Composant React LiveKit (salle de réunion) |
| `src/components/meet/meeting-card.tsx` | Carte de réunion (liste) |
| `src/components/meet/meeting-status-badge.tsx` | Badge de statut |
| `src/components/editor/extensions/meeting-block.tsx` | Extension TipTap bloc réunion |
| `src/app/(app)/meet/page.tsx` | Page liste des réunions |
| `src/app/(app)/meet/[roomName]/page.tsx` | Page réunion en cours |
| `src/app/api/meet/token/route.ts` | API génération token |
| `src/app/api/meet/config/route.ts` | API configuration |
| `docker-compose.livekit.yml` | Override Docker (LiveKit + Egress + Whisper) |
| `docker/livekit/livekit.yaml` | Configuration serveur LiveKit |
| `docker/livekit/egress.yaml` | Configuration Egress |
