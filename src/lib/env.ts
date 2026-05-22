import { z } from "zod";

/**
 * Validation des variables d'environnement au démarrage.
 * Crash-fast si une variable obligatoire est manquante.
 */
const envSchema = z.object({
  // Base de données [REQUIRED]
  DATABASE_URL: z.string().min(1, "DATABASE_URL est obligatoire"),

  // Authentification [REQUIRED]
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL doit être une URL valide"),
  NEXTAUTH_SECRET: z
    .string()
    .min(16, "NEXTAUTH_SECRET doit faire au moins 16 caractères"),

  // Chiffrement [REQUIRED]
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY est obligatoire"),

  // Stockage objet S3-compatible (Garage, MinIO, AWS S3...) [REQUIRED]
  S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT est obligatoire"),
  S3_PORT: z
    .string()
    .default("3900")
    .transform(Number)
    .pipe(z.number().int().positive()),
  S3_ACCESS_KEY: z.string().min(1, "S3_ACCESS_KEY est obligatoire"),
  S3_SECRET_KEY: z.string().min(1, "S3_SECRET_KEY est obligatoire"),
  S3_BUCKET: z.string().default("loriax-files"),
  S3_REGION: z.string().default("garage"),
  S3_USE_SSL: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // CSP / Production [OPTIONAL]
  S3_PUBLIC_URL: z.string().optional(),
  WS_URL: z.string().optional(),

  // Stockage documents [OPTIONAL]
  WORKSPACES_PATH: z.string().default("./workspaces"),

  // IA [OPTIONAL]
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  DEFAULT_AI_PROVIDER: z.string().default("ollama"),
  DEFAULT_AI_MODEL: z.string().default("gemma4:e4b"),

  // CalDAV [OPTIONAL]
  CALDAV_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  CALDAV_BASE_URL: z.string().optional(),

  // LiveKit — Visioconférence [OPTIONAL]
  LIVEKIT_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  LIVEKIT_URL: z.string().default("ws://localhost:7880"),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),

  // Faster-Whisper / Speaches [OPTIONAL — requiert LIVEKIT_ENABLED]
  // Modèles HF Hub : Systran/faster-whisper-{tiny,base,small,medium,large-v3}
  WHISPER_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  WHISPER_API_URL: z.string().default("http://localhost:9000"),
  WHISPER_MODEL: z.string().default("Systran/faster-whisper-medium"),
  WHISPER_LANGUAGE: z.string().default("fr"),
  WHISPER_DIARIZE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  WHISPER_MIN_SPEAKERS: z.string().optional(),
  WHISPER_MAX_SPEAKERS: z.string().optional(),

  // Voxtral — Transcription alternative (Mistral STT) [démarre avec LiveKit]
  VOXTRAL_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  VOXTRAL_API_URL: z.string().default("http://localhost:9001"),
  VOXTRAL_MODEL: z.string().default("mistralai/Voxtral-Mini-Latest"),
  VOXTRAL_LANGUAGE: z.string().default("fr"),

  // Moteur de transcription : whisper (défaut) ou voxtral [OPTIONAL]
  TRANSCRIPTION_ENGINE: z.string().default("whisper"),
  // Vocabulaire métier partagé (noms propres, acronymes) [OPTIONAL]
  TRANSCRIPTION_VOCABULARY: z.string().optional(),

  // Enregistrement audio / Egress [OPTIONAL]
  LIVEKIT_EGRESS_PATH: z.string().default("/recordings"),

  // Embeddings [OPTIONAL]
  EMBEDDING_PROVIDER: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  EMBEDDING_DIMENSIONS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),

  // License [OPTIONAL]
  LICENSE_PUBLIC_KEY: z.string().optional(), // PEM RSA public key (base64 or raw format)
  LICENSE_PRIVATE_KEY: z.string().optional(), // PEM RSA private key — superadmin seulement
  LICENSE_MANAGER_URL: z.string().url().optional(), // URL du service license manager

  // Redis — Rate limiting partagé multi-instance [OPTIONAL]
  // Si défini, le rate limiting utilise Redis (production multi-instance, Docker, serverless).
  // Sinon, fallback sur le backend in-memory (développement, instance unique).
  REDIS_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function validateEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `\n❌ Variables d'environnement invalides :\n${errors}\n\nConsultez .env.example pour la configuration.\n`
    );
  }

  _env = result.data;
  return _env;
}
