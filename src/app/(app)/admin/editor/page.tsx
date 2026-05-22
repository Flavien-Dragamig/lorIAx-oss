import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { EditorAliasesClient } from "./editor-aliases-client";

export default async function AdminEditorPage() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) redirect("/");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Éditeur</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Personnalisez les alias des commandes slash <code className="bg-muted px-1 rounded">/</code> pour les adapter aux usages de votre organisation.
      </p>
      <EditorAliasesClient />
    </div>
  );
}
