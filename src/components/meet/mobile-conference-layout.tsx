"use client";

import {
  useTracks,
  useLocalParticipant,
  TrackRefContext,
  ParticipantTile,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff } from "lucide-react";
import { useOrientation } from "@/hooks/use-orientation";

interface MobileConferenceLayoutProps {
  onDisconnect?: () => void;
}

export function MobileConferenceLayout({ onDisconnect }: MobileConferenceLayoutProps) {
  const orientation = useOrientation();
  const { localParticipant } = useLocalParticipant();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const isMicEnabled = localParticipant.isMicrophoneEnabled;
  const isCamEnabled = localParticipant.isCameraEnabled;
  const isScreenShareEnabled = localParticipant.isScreenShareEnabled;

  const toggleMic = () => localParticipant.setMicrophoneEnabled(!isMicEnabled);
  const toggleCam = () => localParticipant.setCameraEnabled(!isCamEnabled);
  const toggleScreen = () => localParticipant.setScreenShareEnabled(!isScreenShareEnabled);

  // Speaker actif = premier track non-local, sinon local
  const speakerTrack = tracks.find(
    (t) => t.participant.identity !== localParticipant.identity
  ) ?? tracks[0];

  const otherTracks = tracks.filter((t) => t !== speakerTrack);

  // Self-view track
  const selfTrack = tracks.find(
    (t) => t.participant.identity === localParticipant.identity
  );

  const controls = (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={toggleMic}
        aria-label={isMicEnabled ? "Couper le micro" : "Activer le micro"}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
        style={{ backgroundColor: "#2F2F2F" }}
      >
        {isMicEnabled ? (
          <Mic className="h-5 w-5 text-white" />
        ) : (
          <MicOff className="h-5 w-5 text-red-400" />
        )}
      </button>
      <button
        onClick={toggleCam}
        aria-label={isCamEnabled ? "Éteindre la caméra" : "Activer la caméra"}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
        style={{ backgroundColor: "#2F2F2F" }}
      >
        {isCamEnabled ? (
          <Video className="h-5 w-5 text-white" />
        ) : (
          <VideoOff className="h-5 w-5 text-red-400" />
        )}
      </button>
      <button
        onClick={toggleScreen}
        aria-label={isScreenShareEnabled ? "Arrêter le partage" : "Partager l'écran"}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
        style={{ backgroundColor: "#2F2F2F" }}
      >
        <Monitor className={`h-5 w-5 ${isScreenShareEnabled ? "text-blue-400" : "text-white"}`} />
      </button>
      <button
        onClick={onDisconnect}
        aria-label="Raccrocher"
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "#EB5757" }}
      >
        <PhoneOff className="h-5 w-5 text-white" />
      </button>
    </div>
  );

  if (orientation === "landscape") {
    return (
      <div className="relative h-full w-full" style={{ backgroundColor: "#191919" }}>
        {/* Speaker plein écran */}
        {speakerTrack && (
          <TrackRefContext.Provider value={speakerTrack}>
            <ParticipantTile />
          </TrackRefContext.Provider>
        )}

        {/* Self-view coin haut droit */}
        {selfTrack && selfTrack !== speakerTrack && (
          <div
            className="absolute top-3 right-3 rounded-lg overflow-hidden border-2"
            style={{ width: 120, height: 80, borderColor: "#EB5757" }}
          >
            <TrackRefContext.Provider value={selfTrack}>
              <ParticipantTile />
            </TrackRefContext.Provider>
          </div>
        )}

        {/* Contrôles overlay */}
        <div className="absolute bottom-4 left-0 right-0 h-16">
          {controls}
        </div>

        <RoomAudioRenderer />
      </div>
    );
  }

  // Portrait
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#191919" }}>
      {/* Speaker actif */}
      <div className="flex-1 min-h-0 relative">
        {speakerTrack && (
          <TrackRefContext.Provider value={speakerTrack}>
            <ParticipantTile />
          </TrackRefContext.Provider>
        )}
      </div>

      {/* Miniatures horizontales */}
      {otherTracks.length > 0 && (
        <div className="h-24 flex gap-2 px-2 py-1 overflow-x-auto scrollbar-hide">
          {otherTracks.map((track) => (
            <div
              key={`${track.participant.identity}-${track.source}`}
              className="h-full aspect-video rounded-lg overflow-hidden flex-shrink-0"
            >
              <TrackRefContext.Provider value={track}>
                <ParticipantTile />
              </TrackRefContext.Provider>
            </div>
          ))}
        </div>
      )}

      {/* Contrôles */}
      <div className="h-16 flex-shrink-0">
        {controls}
      </div>

      <RoomAudioRenderer />
    </div>
  );
}
