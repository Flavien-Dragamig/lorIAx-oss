import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_LIVEKIT_URL = "ws://localhost:7880";

export interface LiveKitConfig {
  livekitEnabled: boolean;
  livekitUrl: string;
  livekitApiKey?: string;
  livekitApiSecret?: string;
  livekitEgressPath?: string;
}

/**
 * Retrieve LiveKit configuration from system_settings (key "livekit").
 * Falls back to env vars, then to defaults.
 */
export async function getLiveKitConfig(): Promise<LiveKitConfig> {
  try {
    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "livekit"))
      .limit(1);

    if (rows.length > 0) {
      const stored = rows[0].value as Partial<LiveKitConfig>;
      return {
        livekitEnabled:
          stored.livekitEnabled ??
          (process.env.LIVEKIT_ENABLED === "true"),
        livekitUrl:
          stored.livekitUrl ||
          process.env.LIVEKIT_URL ||
          DEFAULT_LIVEKIT_URL,
        livekitApiKey:
          stored.livekitApiKey ||
          process.env.LIVEKIT_API_KEY,
        livekitApiSecret:
          stored.livekitApiSecret ||
          process.env.LIVEKIT_API_SECRET,
        livekitEgressPath:
          stored.livekitEgressPath ||
          process.env.LIVEKIT_EGRESS_PATH,
      };
    }
  } catch {
    // DB not available — fallback to env
  }

  return {
    livekitEnabled: process.env.LIVEKIT_ENABLED === "true",
    livekitUrl: process.env.LIVEKIT_URL || DEFAULT_LIVEKIT_URL,
    livekitApiKey: process.env.LIVEKIT_API_KEY,
    livekitApiSecret: process.env.LIVEKIT_API_SECRET,
    livekitEgressPath: process.env.LIVEKIT_EGRESS_PATH,
  };
}
