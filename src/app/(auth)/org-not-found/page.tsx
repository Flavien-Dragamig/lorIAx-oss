import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function OrgNotFoundPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  return (
    <OrgNotFoundContent searchParams={searchParams} />
  );
}

async function OrgNotFoundContent({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const params = await searchParams;
  const slug = params.slug;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <Image
          src="/logotype-clair.svg"
          alt="LorIAx"
          width={120}
          height={32}
          className="mx-auto dark:hidden"
        />
        <Image
          src="/logotype-sombre.svg"
          alt="LorIAx"
          width={120}
          height={32}
          className="mx-auto hidden dark:block"
        />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Espace introuvable</h1>
          {slug ? (
            <p className="text-muted-foreground">
              L&apos;espace{" "}
              <span className="font-mono font-medium">{slug}</span> n&apos;existe
              pas ou a été désactivé.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Cet espace n&apos;existe pas ou a été désactivé.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <Button render={<Link href="/signup" />}>
            Créer un nouvel espace
          </Button>
          <Button render={<Link href="/login" />} variant="outline">
            Se connecter
          </Button>
        </div>
      </div>
    </div>
  );
}
