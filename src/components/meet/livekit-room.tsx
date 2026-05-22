"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  ControlBar,
  RoomAudioRenderer,
  LayoutContextProvider,
  useTracks,
  useLocalParticipant,
  useTrackVolume,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { RecordingOverlay } from "./recording-overlay";
import { MobileConferenceLayout } from "./mobile-conference-layout";
import { useIsMobile } from "@/hooks/use-mobile";

function RoomLoader() {
  return (
    <div className="flex h-[600px] items-center justify-center rounded-lg bg-muted/50">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          Chargement de la visioconference...
        </p>
      </div>
    </div>
  );
}

/**
 * VU meter showing local microphone level.
 * Must be rendered inside a <LiveKitRoom>.
 */
function AudioLevelIndicator() {
  const { localParticipant } = useLocalParticipant();
  const micTrack = localParticipant
    .getTrackPublications()
    .find((t) => t.source === Track.Source.Microphone);

  const volume = useTrackVolume(micTrack?.track ? { participant: localParticipant, publication: micTrack, source: Track.Source.Microphone } : undefined);

  const isMuted = !micTrack?.track || micTrack.isMuted;
  const barCount = 8;
  const level = isMuted ? 0 : Math.min(volume, 1);

  return (
    <div className="absolute bottom-3 left-3 z-50 flex items-end gap-0.5 rounded bg-black/60 px-2 py-1.5" title={isMuted ? "Micro coupé" : `Niveau micro : ${Math.round(level * 100)}%`}>
      {Array.from({ length: barCount }, (_, i) => {
        const threshold = (i + 1) / barCount;
        const active = level >= threshold;
        return (
          <div
            key={i}
            className="w-1 rounded-sm transition-all duration-75"
            style={{
              height: `${8 + i * 2}px`,
              backgroundColor: active
                ? i < 5 ? "#22c55e" : i < 7 ? "#eab308" : "#ef4444"
                : "rgba(255,255,255,0.2)",
            }}
          />
        );
      })}
      {isMuted && (
        <span className="ml-1.5 text-[10px] text-red-400 font-medium">MUET</span>
      )}
    </div>
  );
}

/**
 * Custom video conference layout using LiveKit primitives.
 * Avoids the duplicate-key and placeholder-array bugs from <VideoConference />.
 */
function DesktopConferenceLayout() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <LayoutContextProvider>
      <div className="lk-video-conference" data-lk-theme="default" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        </div>
        <ControlBar variation="verbose" />
        <RoomAudioRenderer />
      </div>
    </LayoutContextProvider>
  );
}

function ConferenceLayout({ onDisconnect }: { onDisconnect?: () => void }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <MobileConferenceLayout onDisconnect={onDisconnect} />;
  }
  return <DesktopConferenceLayout />;
}

interface LiveKitMeetingProps {
  roomName: string;
  userName?: string;
  userEmail?: string;
  meetingId?: string | null;
  onDisconnected?: () => void;
  height?: string;
  audioOnly?: boolean;
  preloadedToken?: string;
  preloadedServerUrl?: string;
}

export function LiveKitMeeting({
  roomName,
  userName: _userName = "",
  userEmail: _userEmail = "",
  meetingId = null,
  onDisconnected,
  height = "600px",
  audioOnly = false,
  preloadedToken,
  preloadedServerUrl,
}: LiveKitMeetingProps) {
  const [token, setToken] = useState<string | null>(preloadedToken ?? null);
  const [serverUrl, setServerUrl] = useState<string | null>(preloadedServerUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If preloaded token and server URL are provided, skip fetching
    if (preloadedToken && preloadedServerUrl) {
      return;
    }

    const configPromise = fetch("/api/meet/config")
      .then((res) => {
        if (!res.ok) throw new Error("Impossible de charger la configuration");
        return res.json();
      })
      .then((data) => data.url as string);

    const tokenPromise = fetch("/api/meet/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName }),
    }).then((res) => {
      if (!res.ok) {
        if (res.status === 503) {
          throw new Error("LiveKit non configure sur le serveur");
        }
        throw new Error("Erreur de generation du token");
      }
      return res.json().then((data) => data.token as string);
    });

    Promise.all([configPromise, tokenPromise])
      .then(([url, tkn]) => {
        setServerUrl(url);
        setToken(tkn);
      })
      .catch((err) => setError(err.message));
  }, [roomName, preloadedToken, preloadedServerUrl]);

  const handleDisconnected = useCallback(() => {
    onDisconnected?.();
  }, [onDisconnected]);

  if (error) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg bg-destructive/10">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return <RoomLoader />;
  }

  return (
    <div style={{ height }} className="relative overflow-hidden rounded-lg">
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={true}
        video={!audioOnly}
        audio={true}
        onDisconnected={handleDisconnected}
        data-lk-theme="default"
        style={{ height: "100%" }}
      >
        <ConferenceLayout onDisconnect={handleDisconnected} />
        <AudioLevelIndicator />
        {meetingId && <RecordingOverlay meetingId={meetingId} />}
      </LiveKitRoom>
    </div>
  );
}
