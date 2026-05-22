"use client";

import Image from "next/image";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        <Image
          src="/mascotte.svg"
          alt="Mascotte LorIAx"
          width={160}
          height={160}
          className="mx-auto mb-8 opacity-80"
          priority
        />

        <h1 className="mb-3 text-2xl font-semibold text-foreground">
          Vous êtes hors ligne
        </h1>

        <p className="mb-8 text-muted-foreground leading-relaxed">
          Il semble que votre connexion Internet soit interrompue.
          Vérifiez votre réseau et réessayez.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Réessayer
        </button>

        <p className="mt-6 text-xs text-muted-foreground/60">
          LorIAx fonctionnera de nouveau dès que la connexion sera rétablie.
        </p>
      </div>
    </div>
  );
}
