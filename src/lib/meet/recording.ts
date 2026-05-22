import { readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import logger from "@/lib/logger";
import { getLiveKitConfig } from "./livekit-config";

const log = logger.child({ module: "meet-recording" });

const AUDIO_EXTENSIONS = [".ogg", ".mp3", ".wav", ".webm"];

/**
 * Find the recording file for a given room name in the recording directory.
 * LiveKit Egress writes files as `{roomName}_{timestamp}.ogg` directly
 * in the egress output path.
 *
 * Reads the path from system_settings (admin panel) with env fallback.
 */
export async function findRecording(
  roomName: string
): Promise<string | null> {
  const config = await getLiveKitConfig();
  const recordingPath = resolve(/*turbopackIgnore: true*/ config.livekitEgressPath || "/recordings");

  try {
    // Strategy 1: LiveKit Egress format — {roomName}_{timestamp}.ogg
    // Scan the recording directory for files matching the room name prefix.
    const allFiles = await readdir(recordingPath).catch(() => [] as string[]);
    const egressFile = allFiles
      .filter((f) => f.startsWith(`${roomName}_`))
      .filter((f) => AUDIO_EXTENSIONS.some((ext) => f.endsWith(ext)))
      // Pick the most recent file (last alphabetically, since timestamps sort)
      .sort()
      .pop();

    if (egressFile) {
      return join(recordingPath, egressFile);
    }

    // Strategy 2: subdirectory named after the room (legacy / alternative setups)
    const roomDir = join(recordingPath, roomName);
    const roomStat = await stat(roomDir).catch(() => null);

    if (roomStat?.isDirectory()) {
      const files = await readdir(roomDir);
      const audioFile = files.find((f) =>
        AUDIO_EXTENSIONS.some((ext) => f.endsWith(ext))
      );
      if (audioFile) {
        return join(roomDir, audioFile);
      }
    }

    // Strategy 3: file directly named after roomName (e.g. roomName.ogg)
    for (const ext of AUDIO_EXTENSIONS) {
      const filePath = join(recordingPath, `${roomName}${ext}`);
      const fileStat = await stat(filePath).catch(() => null);
      if (fileStat?.isFile()) {
        return filePath;
      }
    }

    return null;
  } catch (error) {
    log.error({ error, roomName }, "Error searching for recording");
    return null;
  }
}
