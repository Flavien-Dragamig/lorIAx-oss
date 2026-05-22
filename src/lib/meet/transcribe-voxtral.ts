import { readFile } from "fs/promises";
import { basename } from "path";
import logger from "@/lib/logger";
import { validateEnv } from "@/lib/env";
import type { TranscriptResult } from "./transcribe";
import { getTranscriptionVocabulary } from "./transcribe";

const log = logger.child({ module: "meet-transcribe-voxtral" });

interface VoxtralConfig {
  enabled: boolean;
  apiUrl: string;
  language: string;
  model: string;
}

/**
 * Read Voxtral configuration from system_settings first, then fallback to env vars.
 */
export async function getVoxtralConfig(): Promise<VoxtralConfig> {
  try {
    const { db } = await import("@/lib/db");
    const { systemSettings } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, "voxtral"));
    if (row?.value) {
      const config = row.value as Record<string, unknown>;
      const env = validateEnv();
      return {
        enabled: (config.voxtralEnabled as boolean) ?? env.VOXTRAL_ENABLED,
        apiUrl: (config.voxtralApiUrl as string) || env.VOXTRAL_API_URL,
        language: (config.voxtralLanguage as string) || env.VOXTRAL_LANGUAGE,
        model: (config.voxtralModel as string) || env.VOXTRAL_MODEL,
      };
    }
  } catch {
    // DB not available — fallback to env
  }
  const env = validateEnv();
  return {
    enabled: env.VOXTRAL_ENABLED,
    apiUrl: env.VOXTRAL_API_URL,
    language: env.VOXTRAL_LANGUAGE,
    model: env.VOXTRAL_MODEL,
  };
}

/**
 * Transcribe an audio file using the Voxtral ASR service.
 * Same API contract as Whisper — sends multipart/form-data, returns TranscriptResult.
 */
export async function transcribeAudioVoxtral(
  filePath: string
): Promise<TranscriptResult> {
  const config = await getVoxtralConfig();
  const apiUrl = config.apiUrl;
  const language = config.language;

  log.info({ filePath, apiUrl, language, model: config.model }, "Starting Voxtral transcription");

  const fileBuffer = await readFile(filePath);
  const fileName = basename(filePath);

  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
  };
  const mimeType = mimeMap[ext || ""] || "audio/ogg";

  const formData = new FormData();
  formData.append(
    "audio_file",
    new Blob([fileBuffer], { type: mimeType }),
    fileName
  );

  const vocabulary = await getTranscriptionVocabulary();

  let url = `${apiUrl}/asr?language=${language}&output=json&word_timestamps=true`;
  if (vocabulary) {
    url += `&initial_prompt=${encodeURIComponent(vocabulary)}`;
  }

  const response = await fetch(url, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(600_000), // 10 minutes timeout (model may be slower)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Voxtral API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  log.info(
    { segments: data.segments?.length || 0, language: data.language },
    "Voxtral transcription completed"
  );

  return {
    text: data.text || "",
    segments: (data.segments || []).map((s: Record<string, unknown>) => ({
      start: s.start as number,
      end: s.end as number,
      text: (s.text as string) || "",
      speaker: s.speaker as string | undefined,
    })),
    language: data.language || language,
    duration: data.duration || 0,
  };
}
