"use client";

import { useEffect, useState, useRef } from "react";
import { Room, Track, LocalTrack } from "livekit-client";

interface LiveKitHeadlessProps {
  roomName: string;
  /** Meeting database ID — used to auto-start Egress recording */
  meetingId?: string;
  /** Called with the local MediaStream once connected (for VU-meter) */
  onStream: (stream: MediaStream | null) => void;
  /** Called when connection fails */
  onError?: (message: string) => void;
}

/**
 * Headless LiveKit connection for in-person meetings.
 * Connects to the room audio-only (no video, no UI), publishes the microphone
 * so Egress can record it, and exposes the local audio stream for the VU-meter.
 * Renders nothing — this is a logic-only component.
 */
export function LiveKitHeadless({
  roomName,
  meetingId,
  onStream,
  onError,
}: LiveKitHeadlessProps) {
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        // Fetch LiveKit config and token
        const [configRes, tokenRes] = await Promise.all([
          fetch("/api/meet/config"),
          fetch("/api/meet/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomName }),
          }),
        ]);

        if (!configRes.ok || !tokenRes.ok) {
          throw new Error("Impossible de se connecter à LiveKit");
        }

        const { url: serverUrl } = await configRes.json();
        const { token } = await tokenRes.json();

        if (cancelled) return;

        // Create room and connect
        const room = new Room();
        roomRef.current = room;

        await room.connect(serverUrl, token, {
          autoSubscribe: false, // No need to receive other tracks
        });

        if (cancelled) {
          room.disconnect();
          return;
        }

        // Publish microphone only (no video)
        await room.localParticipant.setMicrophoneEnabled(true);

        // Extract local audio stream for VU-meter
        const micPub = room.localParticipant
          .getTrackPublications()
          .find((p) => p.source === Track.Source.Microphone);

        if (micPub?.track?.mediaStream) {
          onStream(micPub.track.mediaStream);
        } else {
          // Fallback: get stream from the track directly
          const track = micPub?.track as LocalTrack | undefined;
          if (track?.mediaStreamTrack) {
            const stream = new MediaStream([track.mediaStreamTrack]);
            onStream(stream);
          }
        }

        setConnected(true);
      } catch (err) {
        if (!cancelled) {
          onError?.(err instanceof Error ? err.message : "Erreur de connexion LiveKit");
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      onStream(null);
      setConnected(false);
    };
  }, [roomName, onStream, onError]);

  // Auto-start Egress recording 3 seconds after LiveKit connection
  useEffect(() => {
    if (!connected || !meetingId) return;

    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/meet/rooms/${meetingId}/start-recording`, {
          method: "POST",
        });
      } catch {
        // non-blocking — recording failure shouldn't break the meeting
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [connected, meetingId]);

  return null; // Headless — no UI
}
