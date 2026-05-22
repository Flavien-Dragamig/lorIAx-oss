import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <h2 className="text-2xl font-bold">Page introuvable</h2>
      <p className="text-muted-foreground text-center max-w-md">
        La page que vous recherchez n&apos;existe pas ou a été déplacée.
      </p>
      <Link href="/">
        <Button className="gap-2">
          <Home className="h-4 w-4" />
          Retour à l&apos;accueil
        </Button>
      </Link>
    </div>
  );
}
