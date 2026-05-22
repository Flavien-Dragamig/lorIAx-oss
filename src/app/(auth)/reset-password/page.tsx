"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, CheckCircle } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de la réinitialisation");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setError("Erreur réseau");
    }

    setLoading(false);
  }

  if (!token) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-destructive mb-4">
          Lien invalide. Aucun jeton de réinitialisation trouvé.
        </p>
        <Link href="/forgot-password" className="text-primary hover:underline text-sm font-medium">
          Refaire une demande
        </Link>
      </div>
    );
  }

  return (
    <>
      {success ? (
        <div className="text-center py-4">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-4" />
          <p className="text-sm text-foreground font-medium mb-2">
            Mot de passe réinitialisé
          </p>
          <p className="text-sm text-muted-foreground">
            Vous allez être redirigé vers la page de connexion...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>

          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="••••••••"
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmer le mot de passe</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="••••••••"
              minLength={8}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Réinitialiser le mot de passe
          </Button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center gap-4">
          <Image src="/mascotte.svg" alt="LorIAx" width={80} height={80} priority />
          <h1 className="text-3xl font-bold text-foreground">LorIAx</h1>
          <p className="text-muted-foreground">
            Nouveau mot de passe
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Suspense fallback={<div className="animate-pulse text-center py-4">Chargement...</div>}>
              <ResetPasswordForm />
            </Suspense>
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              <Link
                href="/login"
                className="text-primary hover:underline font-medium"
              >
                Retour à la connexion
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
