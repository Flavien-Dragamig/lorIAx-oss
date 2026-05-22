"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";

interface RecordingOverlayProps {
  meetingId: string | null;
}

export function RecordingOverlay({ meetingId }: RecordingOverlayProps) {
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const room = useRoomContext();

  // Track connection state
  useEffect(() => {
    const onConnected = () => setConnected(true);
    const onDisconnected = () => setConnected(false);

    // Check initial state
    if (room.state === "connected") {
      setConnected(true);
    }

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  // Elapsed timer
  useEffect(() => {
    if (recording) {
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    setElapsed(0);
  }, [recording]);

  const handleStartRecording = useCallback(async () => {
    if (!meetingId || starting || recording) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/meet/rooms/${meetingId}/start-recording`, {
        method: "POST",
      });
      if (res.ok) {
        setRecording(true);
      }
    } catch {
      // ignore — user can retry
    } finally {
      setStarting(false);
    }
  }, [meetingId, starting, recording]);

  // Check if already recording (e.g. page reload)
  useEffect(() => {
    if (!meetingId) return;
    fetch(`/api/meet/rooms/${meetingId}/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.egressId) {
          setRecording(true);
        }
      })
      .catch(() => {});
  }, [meetingId]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  if (!meetingId || !connected) return null;

  if (recording) {
    return (
      <div className="absolute top-3 right-3 z-50 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur-sm">
        <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
        <span className="text-xs font-mono font-medium text-white">
          REC {formatTime(elapsed)}
        </span>
      </div>
    );
  }

  return (
    <div className="absolute top-3 right-3 z-50">
      <Button
        size="sm"
        variant="secondary"
        onClick={handleStartRecording}
        disabled={starting}
        className="bg-black/70 text-white hover:bg-black/80 backdrop-blur-sm border-0"
      >
        {starting ? (
          <>
            <div className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Connexion...
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 mr-1.5" />
            Activer la transcription
          </>
        )}
      </Button>
    </div>
  );
}
