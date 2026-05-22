"use client";

// Build trigger: 2026-05-18 06:15 UTC
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, Check, X } from "lucide-react";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export default function SignupPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slugEdited && orgName) {
      setOrgSlug(slugify(orgName));
    }
  }, [orgName, slugEdited]);

  useEffect(() => {
    if (!orgSlug || orgSlug.length < 3) {
      setSlugAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSlugChecking(true);
      try {
        const res = await fetch(`/api/auth/check-slug?slug=${encodeURIComponent(orgSlug)}`);
        const data = await res.json();
        setSlugAvailable(data.available === true);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [orgSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (slugAvailable === false) {
      setError("Ce sous-domaine n'est pas disponible");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, email, password, orgName, orgSlug }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        router.push("/login");
      } else {
        // Attendre que le cookie de session soit bien positionné avant la redirection
        await new Promise<void>((resolve) => setTimeout(resolve, 400));
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
        if (rootDomain) {
          window.location.href = `https://${data.orgSlug}.${rootDomain}/onboarding`;
        } else {
          router.push("/onboarding");
        }
      }
    } catch {
      setError("Erreur de connexion au serveur");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo.svg" alt="LorIAx" width={40} height={40} />
          <h1 className="text-2xl font-bold">Créer votre espace</h1>
          <p className="text-sm text-muted-foreground text-center">
            Votre espace sera accessible sur{" "}
            <span className="font-mono text-foreground">
              {orgSlug || "votre-nom"}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || "loriax.fr"}
            </span>
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="userName">Votre nom</Label>
                <Input
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Alice Dupont"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice@exemple.fr"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  required
                  minLength={8}
                />
              </div>

              <hr />

              <div className="space-y-2">
                <Label htmlFor="orgName">Nom de votre organisation</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orgSlug">Sous-domaine</Label>
                <div className="relative">
                  <Input
                    id="orgSlug"
                    value={orgSlug}
                    onChange={(e) => {
                      setOrgSlug(e.target.value.toLowerCase());
                      setSlugEdited(true);
                    }}
                    placeholder="acme-corp"
                    required
                    pattern="[a-z0-9-]{3,32}"
                    className="pr-8"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {slugChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!slugChecking && slugAvailable === true && <Check className="h-4 w-4 text-green-500" />}
                    {!slugChecking && slugAvailable === false && <X className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adresse définitive :{" "}
                  <span className="font-mono">
                    {orgSlug || "votre-nom"}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || "loriax.fr"}
                  </span>
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || slugAvailable === false || (orgSlug.length >= 3 && slugChecking)}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Créer mon espace
              </Button>
              <p className="text-sm text-muted-foreground">
                Déjà un compte ?{" "}
                <Link href="/login" className="underline">
                  Se connecter
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
