"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Copy,
  Check,
  QrCode,
  Monitor,
  Smartphone,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-session";

export default function CalendarSettingsPage() {
  const user = useCurrentUser();
  const [copied, setCopied] = useState(false);
  const [caldavUrl, setCaldavUrl] = useState("");
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (user) {
      const base =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://localhost:3000";
      setCaldavUrl(`${base}/api/caldav/${user.id}/`);
    }
  }, [user]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(caldavUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clients = [
    {
      name: "Thunderbird",
      icon: <Monitor className="h-5 w-5" />,
      steps: [
        "Ouvrir Thunderbird → Calendrier",
        "Clic droit → Nouveau calendrier → Sur le réseau",
        'Format : "CalDAV"',
        "Coller l'URL CalDAV ci-dessus",
        "Identifiants : votre email + mot de passe LorIAx",
      ],
    },
    {
      name: "Apple Calendar (macOS / iOS)",
      icon: <Monitor className="h-5 w-5" />,
      steps: [
        "Préférences Système → Comptes Internet → Autre",
        "Sélectionner CalDAV",
        'Type : "Avancé"',
        "Coller l'URL CalDAV",
        "Identifiants : votre email + mot de passe",
      ],
    },
    {
      name: "DAVx⁵ (Android)",
      icon: <Smartphone className="h-5 w-5" />,
      steps: [
        "Installer DAVx⁵ depuis F-Droid ou Play Store",
        "Ajouter un compte → Connexion avec URL et identifiants",
        "Coller l'URL CalDAV",
        "Identifiants : votre email + mot de passe",
        "Les calendriers apparaissent dans votre app calendrier Android",
      ],
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Paramètres CalDAV</h1>
      </div>

      {/* CalDAV URL */}
      <div className="border border-border rounded-lg p-5 mb-6 bg-card">
        <h2 className="text-base font-semibold mb-3">URL CalDAV personnelle</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Utilisez cette URL pour synchroniser vos calendriers LorIAx avec des
          clients externes (Thunderbird, Apple Calendar, DAVx⁵…).
        </p>

        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono truncate">
            {caldavUrl || "Chargement…"}
          </code>
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowQR(!showQR)}
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>

        {showQR && caldavUrl && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="bg-white p-4 rounded-lg border border-border">
              {/* Simple text-based QR placeholder — a real QR lib could be added */}
              <div className="text-center text-xs text-muted-foreground">
                <p className="font-mono text-[8px] break-all max-w-[200px]">
                  {caldavUrl}
                </p>
                <p className="mt-2 text-xs">
                  Scannez ce QR code avec DAVx⁵ ou votre client CalDAV mobile
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 mt-4 p-3 rounded-md bg-muted/50">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium">Authentification</p>
            <p>
              Utilisez votre adresse email et mot de passe LorIAx, ou générez
              une clé API dans{" "}
              <a href="/settings" className="text-primary underline">
                Paramètres → Clés API
              </a>{" "}
              comme token Bearer.
            </p>
          </div>
        </div>
      </div>

      {/* Auto-discovery */}
      <div className="border border-border rounded-lg p-5 mb-6 bg-card">
        <h2 className="text-base font-semibold mb-2">Auto-découverte</h2>
        <p className="text-sm text-muted-foreground mb-2">
          La plupart des clients CalDAV supportent l&apos;auto-découverte via{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            .well-known/caldav
          </code>
          . Il suffit souvent d&apos;entrer l&apos;URL de base du serveur et vos
          identifiants.
        </p>
        <code className="text-xs bg-muted px-3 py-1.5 rounded-md font-mono block">
          {typeof window !== "undefined" ? window.location.origin : ""}
          /.well-known/caldav
        </code>
      </div>

      {/* Client setup guides */}
      <h2 className="text-lg font-semibold mb-4">Configuration par client</h2>
      <div className="space-y-4">
        {clients.map((client) => (
          <details
            key={client.name}
            className="border border-border rounded-lg bg-card"
          >
            <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-accent/30">
              {client.icon}
              <span className="text-sm font-medium">{client.name}</span>
            </summary>
            <div className="px-5 pb-4">
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                {client.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
