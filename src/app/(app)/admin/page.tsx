import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-user";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Le facility_manager n'a accès qu'à l'onglet Salles
  if (user.globalRole === "facility_manager") {
    redirect("/admin/meeting-rooms");
  }
  redirect("/admin/users");
}
