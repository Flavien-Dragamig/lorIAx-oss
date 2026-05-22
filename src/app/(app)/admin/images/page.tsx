import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { ImageAdminClient } from "./image-admin-client";

export default async function AdminImagesPage() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) redirect("/");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Bibliothèque d&apos;images</h1>
      <ImageAdminClient />
    </div>
  );
}
