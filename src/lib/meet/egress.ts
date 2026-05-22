import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
} from "livekit-server-sdk";
import { getLiveKitConfig } from "./livekit-config";
import logger from "@/lib/logger";

const log = logger.child({ module: "meet-egress" });

/**
 * Convert LiveKit WebSocket URL to HTTP(S) for the Egress REST API.
 * ws://host → http://host, wss://host → https://host
 */
function toHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

/**
 * Start an audio-only room composite recording via LiveKit Egress.
 * Returns the egressId to stop it later, or null if Egress is unavailable.
 */
export async function startRecording(
  roomName: string
): Promise<string | null> {
  const config = await getLiveKitConfig();

  if (!config.livekitEnabled || !config.livekitApiKey || !config.livekitApiSecret) {
    log.warn("LiveKit not configured — skipping recording");
    return null;
  }

  try {
    const client = new EgressClient(
      toHttpUrl(config.livekitUrl),
      config.livekitApiKey,
      config.livekitApiSecret
    );

    const output = new EncodedFileOutput({
      fileType: EncodedFileType.OGG,
      filepath: `/recordings/{room_name}_{time}.ogg`,
      disableManifest: true,
    });

    const info = await client.startRoomCompositeEgress(roomName, output, {
      audioOnly: true,
    });

    log.info({ egressId: info.egressId, roomName }, "Recording started");
    return info.egressId;
  } catch (error) {
    log.error({ error, roomName }, "Failed to start recording");
    return null;
  }
}

/**
 * Stop an active Egress recording.
 * Waits briefly for the file to be finalized.
 */
export async function stopRecording(egressId: string): Promise<void> {
  const config = await getLiveKitConfig();

  if (!config.livekitApiKey || !config.livekitApiSecret) {
    return;
  }

  try {
    const client = new EgressClient(
      toHttpUrl(config.livekitUrl),
      config.livekitApiKey,
      config.livekitApiSecret
    );

    await client.stopEgress(egressId);
    log.info({ egressId }, "Recording stopped");

    // Wait for Egress to finalize the file
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error) {
    log.error({ error, egressId }, "Failed to stop recording");
  }
}
