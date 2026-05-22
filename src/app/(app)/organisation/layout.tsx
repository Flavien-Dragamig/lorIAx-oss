import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth/get-user";

interface Props {
  children: React.ReactNode;
}

export default async function OrganisationLayout({ children }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Organisation</h1>
        </div>
        <nav className="flex gap-1 flex-wrap">
          <OrgTab
            href="/organisation"
            label="Vue d'ensemble"
            icon={<Building2 className="h-4 w-4" />}
            exact
          />
        </nav>
      </header>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

function OrgTab({
  href,
  label,
  icon,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}) {
  void exact;
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}
