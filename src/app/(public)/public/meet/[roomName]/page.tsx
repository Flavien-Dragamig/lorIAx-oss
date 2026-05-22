"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { LiveKitMeeting } from "@/components/meet/livekit-room";
import { Loader2, AlertCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoomPageParams {
  params: Promise<{ roomName: string }>;
}

export default function PublicMeetRoomPage({
  params,
}: RoomPageParams) {
  const searchParams = useSearchParams();
  const [resolvedParams, setResolvedParams] = useState<{ roomName: string } | null>(null);

  // Resolve async params
  useEffect(() => {
    params.then((p) => setResolvedParams(p));
  }, [params]);

  const roomName = resolvedParams?.roomName;
  const shareToken = searchParams.get("shareToken");
  const displayName = searchParams.get("displayName");

  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [token, setToken] = useState<string>("");
  const [serverUrl, setServerUrl] = useState<string>("");

  // Validation and token fetching
  useEffect(() => {
    if (!roomName || !shareToken || !displayName) {
      setState("error");
      return;
    }

    const fetchTokenAndConfig = async () => {
      try {
        // Fetch both config and token in parallel
        const [configResponse, tokenResponse] = await Promise.all([
          fetch("/api/public/meet/config"),
          fetch("/api/public/meet/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shareToken, roomName, displayName }),
          }),
        ]);

        if (!configResponse.ok) {
          throw new Error("Failed to fetch config");
        }

        if (!tokenResponse.ok) {
          throw new Error("Failed to get meeting token");
        }

        const configData = await configResponse.json();
        const tokenData = await tokenResponse.json();

        setServerUrl(configData.url);
        setToken(tokenData.token);
        setState("ready");
      } catch (err) {
        console.error("Error fetching token/config:", err);
        setState("error");
      }
    };

    fetchTokenAndConfig();
  }, [roomName, shareToken, displayName]);

  const handleDisconnect = () => {
    window.close();
  };

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Chargement de la réunion...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Erreur d&apos;accès à la réunion</h1>
          <p className="text-muted-foreground mt-2 text-sm">Paramètres manquants ou invalides.</p>
          <Button onClick={handleDisconnect} variant="outline" className="mt-4">
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-hidden">
        {roomName && (
          <LiveKitMeeting
            roomName={roomName}
            preloadedToken={token}
            preloadedServerUrl={serverUrl}
            onDisconnected={handleDisconnect}
            height="100%"
          />
        )}
      </div>
      <div className="border-t bg-background p-3 flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDisconnect}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Quitter la réunion
        </Button>
      </div>
    </div>
  );
}
