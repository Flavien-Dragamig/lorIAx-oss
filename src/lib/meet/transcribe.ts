import { readFile } from "fs/promises";
import { basename } from "path";
import logger from "@/lib/logger";
import { validateEnv } from "@/lib/env";

const log = logger.child({ module: "meet-transcribe" });

interface WhisperConfig {
  enabled: boolean;
  apiUrl: string;
  model: string;
  language: string;
  diarize: boolean;
  minSpeakers?: string;
  maxSpeakers?: string;
}

/**
 * Read Whisper configuration from system_settings first, then fallback to env vars.
 */
export async function getWhisperConfig(): Promise<WhisperConfig> {
  try {
    const { db } = await import("@/lib/db");
    const { systemSettings } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, "whisper"));
    if (row?.value) {
      const config = row.value as Record<string, unknown>;
      const env = validateEnv();
      return {
        enabled: (config.whisperEnabled as boolean) ?? env.WHISPER_ENABLED,
        apiUrl: (config.whisperApiUrl as string) || env.WHISPER_API_URL,
        model: (config.whisperModel as string) || env.WHISPER_MODEL,
        language: (config.whisperLanguage as string) || env.WHISPER_LANGUAGE,
        diarize: (config.whisperDiarize as boolean) ?? env.WHISPER_DIARIZE,
        minSpeakers: (config.whisperMinSpeakers as string | undefined) || env.WHISPER_MIN_SPEAKERS,
        maxSpeakers: (config.whisperMaxSpeakers as string | undefined) || env.WHISPER_MAX_SPEAKERS,
      };
    }
  } catch {
    // DB not available — fallback to env
  }
  const env = validateEnv();
  return {
    enabled: env.WHISPER_ENABLED,
    apiUrl: env.WHISPER_API_URL,
    model: env.WHISPER_MODEL,
    language: env.WHISPER_LANGUAGE,
    diarize: env.WHISPER_DIARIZE,
    minSpeakers: env.WHISPER_MIN_SPEAKERS,
    maxSpeakers: env.WHISPER_MAX_SPEAKERS,
  };
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  duration: number;
}

/**
 * Transcribe an audio file using the Faster-Whisper (Speaches) API.
 * Uses the OpenAI-compatible endpoint POST /v1/audio/transcriptions.
 */
export async function transcribeAudio(
  filePath: string
): Promise<TranscriptResult> {
  const config = await getWhisperConfig();
  const { apiUrl, model, language } = config;

  log.info({ filePath, apiUrl, model, language }, "Starting Faster-Whisper transcription");

  const fileBuffer = await readFile(filePath);
  const fileName = basename(filePath);

  // Determine MIME type from extension
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
  };
  const mimeType = mimeMap[ext || ""] || "audio/ogg";

  // --- Step 1: Transcription (OpenAI-compatible API) ---
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([fileBuffer], { type: mimeType }),
    fileName
  );
  formData.append("model", model);
  formData.append("language", language);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");
  const vocabulary = await getTranscriptionVocabulary();
  if (vocabulary) {
    formData.append("prompt", vocabulary);
  }

  const url = `${apiUrl}/v1/audio/transcriptions`;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(300_000), // 5 minutes timeout
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Faster-Whisper API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  const segments: TranscriptSegment[] = (data.segments || []).map(
    (s: Record<string, unknown>) => ({
      start: s.start as number,
      end: s.end as number,
      text: (s.text as string) || "",
    })
  );

  // --- Step 2: Diarisation (optionnelle, endpoint séparé) ---
  if (config.diarize) {
    try {
      const diarizeSegments = await diarizeAudio(
        apiUrl, fileBuffer, fileName, mimeType, config
      );
      if (diarizeSegments.length > 0) {
        assignSpeakersToSegments(segments, diarizeSegments);
      }
    } catch (err) {
      log.warn(
        { error: String(err) },
        "Diarisation failed — transcript returned without speaker labels"
      );
    }
  }

  log.info(
    { segments: segments.length, language: data.language },
    "Transcription completed"
  );

  return {
    text: data.text || "",
    segments,
    language: data.language || language,
    duration: data.duration || 0,
  };
}

/**
 * Call the Speaches diarization endpoint to get speaker segments.
 */
async function diarizeAudio(
  apiUrl: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  config: WhisperConfig
): Promise<Array<{ start: number; end: number; speaker: string }>> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(fileBuffer)], { type: mimeType }),
    fileName
  );
  if (config.minSpeakers) formData.append("min_speakers", config.minSpeakers);
  if (config.maxSpeakers) formData.append("max_speakers", config.maxSpeakers);

  const response = await fetch(`${apiUrl}/v1/audio/diarization`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Diarization error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return (data.segments || []).map((s: Record<string, unknown>) => ({
    start: s.start as number,
    end: s.end as number,
    speaker: (s.speaker as string) || "Unknown",
  }));
}

/**
 * Assign speaker labels from diarization to transcript segments
 * by matching time overlap.
 */
function assignSpeakersToSegments(
  transcriptSegments: TranscriptSegment[],
  diarizeSegments: Array<{ start: number; end: number; speaker: string }>
) {
  for (const seg of transcriptSegments) {
    const midpoint = (seg.start + seg.end) / 2;
    const match = diarizeSegments.find(
      (d) => d.start <= midpoint && midpoint <= d.end
    );
    if (match) seg.speaker = match.speaker;
  }
}

/**
 * Format transcript segments into readable Markdown text.
 */
export function formatTranscript(result: TranscriptResult): string {
  if (!result.segments.length) {
    return result.text;
  }

  return result.segments
    .map((s) => {
      const time = formatTimestamp(s.start);
      const speaker = s.speaker ? `**${s.speaker}** ` : "";
      return `\`${time}\` ${speaker}${s.text.trim()}`;
    })
    .join("\n\n");
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Get the configured transcription engine from system_settings or env var.
 */
async function getTranscriptionEngine(): Promise<"whisper" | "voxtral"> {
  try {
    const { db } = await import("@/lib/db");
    const { systemSettings } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, "transcription"));
    if (row?.value) {
      const config = row.value as Record<string, unknown>;
      if ((config.engine as string) === "voxtral") return "voxtral";
    }
  } catch {
    // fallback to env
  }
  const env = validateEnv();
  return env.TRANSCRIPTION_ENGINE === "voxtral" ? "voxtral" : "whisper";
}

/**
 * Get the shared transcription vocabulary from system_settings or env var.
 * Used as a prompt to guide speech recognition for domain-specific terms.
 */
export async function getTranscriptionVocabulary(): Promise<string | undefined> {
  try {
    const { db } = await import("@/lib/db");
    const { systemSettings } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, "transcription"));
    if (row?.value) {
      const config = row.value as Record<string, unknown>;
      const vocab = config.vocabulary as string | undefined;
      if (vocab) return vocab;
    }
  } catch {
    // fallback to env
  }
  return validateEnv().TRANSCRIPTION_VOCABULARY;
}

/**
 * Check if any transcription engine is available (Whisper or Voxtral).
 * Returns true if at least one engine is enabled — the fallback chain
 * in transcribeWithEngine() handles actual availability at runtime.
 */
export async function isTranscriptionEnabled(): Promise<boolean> {
  const { getVoxtralConfig } = await import("./transcribe-voxtral");
  const voxtralConfig = await getVoxtralConfig();
  if (voxtralConfig.enabled) return true;

  const whisperConfig = await getWhisperConfig();
  if (whisperConfig.enabled) return true;

  // Even if neither is explicitly enabled, check if the configured engine
  // has a reachable URL — handles cases where admin configured via UI
  // but the env var flag was not set.
  const engine = await getTranscriptionEngine();
  if (engine === "voxtral" && voxtralConfig.apiUrl) return true;
  if (engine === "whisper" && whisperConfig.apiUrl) return true;

  return false;
}

/**
 * Transcribe using the configured engine, with automatic fallback.
 * If Voxtral is selected but fails, falls back to Whisper.
 * If Whisper is selected but fails, tries Voxtral as fallback.
 */
export async function transcribeWithEngine(
  filePath: string
): Promise<TranscriptResult> {
  const engine = await getTranscriptionEngine();
  log.info({ engine, filePath }, "Starting transcription with configured engine");

  if (engine === "voxtral") {
    const { getVoxtralConfig, transcribeAudioVoxtral } = await import("./transcribe-voxtral");
    const voxtralConfig = await getVoxtralConfig();
    if (voxtralConfig.enabled && voxtralConfig.apiUrl) {
      try {
        return await transcribeAudioVoxtral(filePath);
      } catch (err) {
        log.warn({ error: String(err), engine: "voxtral" }, "Voxtral transcription failed, falling back to Whisper");
      }
    } else {
      log.warn({ enabled: voxtralConfig.enabled, apiUrl: voxtralConfig.apiUrl }, "Voxtral not available, falling back to Whisper");
    }
    // Fallback: Whisper
    return await transcribeAudio(filePath);
  }

  // Default engine: Whisper
  try {
    return await transcribeAudio(filePath);
  } catch (err) {
    log.warn({ error: String(err), engine: "whisper" }, "Whisper transcription failed, trying Voxtral as fallback");
    // Fallback: try Voxtral if available
    const { getVoxtralConfig, transcribeAudioVoxtral } = await import("./transcribe-voxtral");
    const voxtralConfig = await getVoxtralConfig();
    if (voxtralConfig.enabled && voxtralConfig.apiUrl) {
      return await transcribeAudioVoxtral(filePath);
    }
    // Re-throw original error if no fallback available
    throw err;
  }
}
