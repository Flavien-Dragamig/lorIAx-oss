import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-user";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  redirect("/admin/users");
}
