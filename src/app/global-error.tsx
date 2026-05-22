"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background text-foreground">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Erreur critique</h2>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          {error.message || "Une erreur inattendue est survenue."}
        </p>
        <Button onClick={reset} variant="outline">
          Réessayer
        </Button>
      </body>
    </html>
  );
}
