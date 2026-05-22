import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-user";
import { canManageMeetingRooms } from "@/lib/auth/rbac";
import { AdminTabs } from "@/components/admin/admin-tabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const isAdmin = user.globalRole === "admin" || user.globalRole === "super_admin";
  const canViewAdmin = isAdmin || canManageMeetingRooms(user.globalRole);
  if (!canViewAdmin) redirect("/");

  return (
    <div className="flex flex-col h-full">
      <AdminTabs userRole={user.globalRole} />
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
