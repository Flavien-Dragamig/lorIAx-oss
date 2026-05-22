import { Building2 } from "lucide-react";

export default async function OrganisationPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Vue d&apos;ensemble</h2>
        <p className="text-sm text-muted-foreground">
          Retrouvez ici les ressources partagées de votre organisation.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Aucun module disponible</p>
        <p className="text-xs text-muted-foreground">
          Les ressources partagées seront listées ici.
        </p>
      </div>
    </div>
  );
}
