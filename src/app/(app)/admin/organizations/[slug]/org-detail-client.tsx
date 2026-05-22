"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export function OrgMembersTable({ slug, members }: { slug: string; members: Member[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function removeMember(userId: string) {
    setLoading(userId);
    await fetch(`/api/admin/organizations/${slug}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Nom</th>
            <th className="text-left px-4 py-3 font-medium">Email</th>
            <th className="text-left px-4 py-3 font-medium">Rôle</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{m.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  {m.role}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={loading === m.userId}
                  onClick={() => removeMember(m.userId)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
