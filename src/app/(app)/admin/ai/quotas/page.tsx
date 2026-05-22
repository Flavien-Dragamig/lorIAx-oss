"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Users,
  User,
  Save,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  AlertCircle,
  Check,
  X,
} from "lucide-react";

// --- Types ---

interface Quota {
  id: string;
  scope: "org" | "team" | "user";
  scopeId: string | null;
  period: "daily" | "monthly";
  maxTokens: number | null;
  maxRequests: number | null;
}

interface UsageData {
  tokens: number;
  requests: number;
  periodStart: string;
}

interface Team {
  id: string;
  name: string;
  memberCount: number;
}

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  globalRole: string;
}

// --- Helpers ---

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function progressColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-green-500";
}

function ProgressBar({ value, max, label }: { value: number; max: number | null; label?: string }) {
  if (!max || max === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        {label ? `${label} : ` : ""}{formatTokens(value)} (pas de limite)
      </div>
    );
  }

  const pct = Math.min(100, Math.round((value / max) * 100));

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">
            {formatTokens(value)} / {formatTokens(max)} ({pct}%)
          </span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progressColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- Main component ---

export default function QuotasPage() {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [orgUsage, setOrgUsage] = useState<UsageData | null>(null);
  const [teamUsages, setTeamUsages] = useState<Record<string, UsageData>>({});
  const [userUsages, setUserUsages] = useState<Record<string, UsageData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Org quota form
  const [orgMaxTokens, setOrgMaxTokens] = useState<string>("");
  const [orgMaxRequests, setOrgMaxRequests] = useState<string>("");
  const [orgPeriod, setOrgPeriod] = useState<"daily" | "monthly">("monthly");

  // Inline editing state
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editTeamTokens, setEditTeamTokens] = useState("");
  const [editTeamRequests, setEditTeamRequests] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editUserTokens, setEditUserTokens] = useState("");
  const [editUserRequests, setEditUserRequests] = useState("");

  // --- Fetch all data ---

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [quotasRes, teamsRes, usersRes] = await Promise.all([
        fetch("/api/admin/ai/quotas"),
        fetch("/api/admin/teams"),
        fetch("/api/admin/users"),
      ]);

      const quotasData: Quota[] = await quotasRes.json();
      const teamsData: Team[] = await teamsRes.json();
      const usersData: UserItem[] = await usersRes.json();

      setQuotas(quotasData);
      setTeams(teamsData);
      setUsers(usersData);

      // Set org quota form values
      const orgQuota = quotasData.find((q) => q.scope === "org");
      if (orgQuota) {
        setOrgMaxTokens(orgQuota.maxTokens?.toString() || "");
        setOrgMaxRequests(orgQuota.maxRequests?.toString() || "");
        setOrgPeriod(orgQuota.period);
      }

      // Fetch org usage
      const orgUsageRes = await fetch("/api/admin/ai/quotas/usage?scope=org");
      const orgUsageData = await orgUsageRes.json();
      setOrgUsage(orgUsageData);

      // Fetch team usages
      const teamUsagePromises = teamsData.map(async (team: Team) => {
        const res = await fetch(
          `/api/admin/ai/quotas/usage?scope=team&scopeId=${team.id}`
        );
        const data = await res.json();
        return { teamId: team.id, usage: data };
      });
      const teamUsageResults = await Promise.all(teamUsagePromises);
      const teamUsageMap: Record<string, UsageData> = {};
      for (const r of teamUsageResults) {
        teamUsageMap[r.teamId] = r.usage;
      }
      setTeamUsages(teamUsageMap);

      // Fetch user usages
      const userUsagePromises = usersData.map(async (u: UserItem) => {
        const res = await fetch(
          `/api/admin/ai/quotas/usage?scope=user&scopeId=${u.id}`
        );
        const data = await res.json();
        return { userId: u.id, usage: data };
      });
      const userUsageResults = await Promise.all(userUsagePromises);
      const userUsageMap: Record<string, UsageData> = {};
      for (const r of userUsageResults) {
        userUsageMap[r.userId] = r.usage;
      }
      setUserUsages(userUsageMap);
    } catch (error) {
      console.error("Erreur chargement quotas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Helpers ---

  const orgQuota = quotas.find((q) => q.scope === "org");

  function getTeamQuota(teamId: string): Quota | undefined {
    return quotas.find((q) => q.scope === "team" && q.scopeId === teamId);
  }

  function getUserQuota(userId: string): Quota | undefined {
    return quotas.find((q) => q.scope === "user" && q.scopeId === userId);
  }

  function getEffectiveQuota(
    scope: "team" | "user",
    scopeId: string
  ): { maxTokens: number | null; maxRequests: number | null; inherited: boolean } {
    const specific = quotas.find((q) => q.scope === scope && q.scopeId === scopeId);
    if (specific) {
      return {
        maxTokens: specific.maxTokens,
        maxRequests: specific.maxRequests,
        inherited: false,
      };
    }
    if (orgQuota) {
      return {
        maxTokens: orgQuota.maxTokens,
        maxRequests: orgQuota.maxRequests,
        inherited: true,
      };
    }
    return { maxTokens: null, maxRequests: null, inherited: true };
  }

  function isQuotaReached(usage: UsageData | undefined, maxTokens: number | null, maxRequests: number | null): boolean {
    if (!usage) return false;
    if (maxTokens && usage.tokens >= maxTokens) return true;
    if (maxRequests && usage.requests >= maxRequests) return true;
    return false;
  }

  // --- Save org quota ---

  async function saveOrgQuota() {
    setSaving(true);
    try {
      const maxTokens = orgMaxTokens ? parseInt(orgMaxTokens, 10) : null;
      const maxRequests = orgMaxRequests ? parseInt(orgMaxRequests, 10) : null;

      if (orgQuota) {
        await fetch("/api/admin/ai/quotas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: orgQuota.id,
            maxTokens,
            maxRequests,
            period: orgPeriod,
          }),
        });
      } else {
        await fetch("/api/admin/ai/quotas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: "org",
            period: orgPeriod,
            maxTokens,
            maxRequests,
          }),
        });
      }
      await fetchData();
    } catch (error) {
      console.error("Erreur sauvegarde quota org:", error);
    } finally {
      setSaving(false);
    }
  }

  // --- Save team quota ---

  async function saveTeamQuota(teamId: string) {
    const existing = getTeamQuota(teamId);
    const maxTokens = editTeamTokens ? parseInt(editTeamTokens, 10) : null;
    const maxRequests = editTeamRequests ? parseInt(editTeamRequests, 10) : null;

    try {
      if (existing) {
        await fetch("/api/admin/ai/quotas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existing.id, maxTokens, maxRequests }),
        });
      } else {
        await fetch("/api/admin/ai/quotas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: "team",
            scopeId: teamId,
            period: orgPeriod,
            maxTokens,
            maxRequests,
          }),
        });
      }
      setEditingTeam(null);
      await fetchData();
    } catch (error) {
      console.error("Erreur sauvegarde quota équipe:", error);
    }
  }

  async function deleteTeamQuota(teamId: string) {
    const existing = getTeamQuota(teamId);
    if (!existing) return;

    try {
      await fetch("/api/admin/ai/quotas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existing.id }),
      });
      await fetchData();
    } catch (error) {
      console.error("Erreur suppression quota équipe:", error);
    }
  }

  // --- Save user quota ---

  async function saveUserQuota(userId: string) {
    const existing = getUserQuota(userId);
    const maxTokens = editUserTokens ? parseInt(editUserTokens, 10) : null;
    const maxRequests = editUserRequests ? parseInt(editUserRequests, 10) : null;

    try {
      if (existing) {
        await fetch("/api/admin/ai/quotas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existing.id, maxTokens, maxRequests }),
        });
      } else {
        await fetch("/api/admin/ai/quotas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: "user",
            scopeId: userId,
            period: orgPeriod,
            maxTokens,
            maxRequests,
          }),
        });
      }
      setEditingUser(null);
      await fetchData();
    } catch (error) {
      console.error("Erreur sauvegarde quota utilisateur:", error);
    }
  }

  async function deleteUserQuota(userId: string) {
    const existing = getUserQuota(userId);
    if (!existing) return;

    try {
      await fetch("/api/admin/ai/quotas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existing.id }),
      });
      await fetchData();
    } catch (error) {
      console.error("Erreur suppression quota utilisateur:", error);
    }
  }

  // --- Filtered users ---

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.name?.toLowerCase().includes(q) ?? false) ||
      u.email.toLowerCase().includes(q)
    );
  });

  // --- Team membership lookup for users ---
  // We don't have a direct team membership from the users API,
  // so we show "—" for now (team info would require an extra join)

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Chargement des quotas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotas IA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les limites de consommation par organisation, équipe et utilisateur.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      {/* === Section 1: Quota Organisation === */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Quota organisation</h2>
            <p className="text-sm text-muted-foreground">
              Limite globale appliquée à toute l&apos;organisation
            </p>
          </div>
        </div>

        {!orgQuota && !orgMaxTokens && !orgMaxRequests ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Aucun quota organisation défini.</span>
            <button
              onClick={() => {
                setOrgMaxTokens("1000000");
                setOrgMaxRequests("1000");
              }}
              className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Définir
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tokens max</label>
                <input
                  type="number"
                  value={orgMaxTokens}
                  onChange={(e) => setOrgMaxTokens(e.target.value)}
                  placeholder="Ex : 1000000"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Requêtes max</label>
                <input
                  type="number"
                  value={orgMaxRequests}
                  onChange={(e) => setOrgMaxRequests(e.target.value)}
                  placeholder="Ex : 1000"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Période</label>
                <select
                  value={orgPeriod}
                  onChange={(e) => setOrgPeriod(e.target.value as "daily" | "monthly")}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="monthly">Mensuel</option>
                  <option value="daily">Journalier</option>
                </select>
              </div>
            </div>

            {orgUsage && (
              <div className="space-y-3">
                <ProgressBar
                  value={orgUsage.tokens}
                  max={orgMaxTokens ? parseInt(orgMaxTokens, 10) : null}
                  label="Tokens"
                />
                <ProgressBar
                  value={orgUsage.requests}
                  max={orgMaxRequests ? parseInt(orgMaxRequests, 10) : null}
                  label="Requêtes"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={saveOrgQuota}
                disabled={saving}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* === Section 2: Quotas par équipe === */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Quotas par équipe</h2>
            <p className="text-sm text-muted-foreground">
              Les équipes sans quota spécifique héritent du quota organisation
            </p>
          </div>
        </div>

        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucune équipe configurée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Équipe</th>
                  <th className="pb-2 font-medium">Tokens max</th>
                  <th className="pb-2 font-medium">Requêtes max</th>
                  <th className="pb-2 font-medium">Consommation tokens</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {teams.map((team) => {
                  const teamQuota = getTeamQuota(team.id);
                  const effective = getEffectiveQuota("team", team.id);
                  const usage = teamUsages[team.id];
                  const isEditing = editingTeam === team.id;

                  return (
                    <tr key={team.id} className="group">
                      <td className="py-3 font-medium">
                        {team.name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({team.memberCount} membres)
                        </span>
                      </td>
                      <td className="py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editTeamTokens}
                            onChange={(e) => setEditTeamTokens(e.target.value)}
                            placeholder="Tokens max"
                            className="w-28 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            autoFocus
                          />
                        ) : effective.inherited ? (
                          <span className="text-muted-foreground italic">
                            {effective.maxTokens ? formatTokens(effective.maxTokens) : "—"} (hérité)
                          </span>
                        ) : (
                          formatTokens(effective.maxTokens ?? 0)
                        )}
                      </td>
                      <td className="py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editTeamRequests}
                            onChange={(e) => setEditTeamRequests(e.target.value)}
                            placeholder="Requêtes max"
                            className="w-28 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : effective.inherited ? (
                          <span className="text-muted-foreground italic">
                            {effective.maxRequests?.toString() ?? "—"} (hérité)
                          </span>
                        ) : (
                          effective.maxRequests?.toString() ?? "—"
                        )}
                      </td>
                      <td className="py-3 min-w-[180px]">
                        {usage && (
                          <ProgressBar
                            value={usage.tokens}
                            max={effective.maxTokens}
                          />
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveTeamQuota(team.id)}
                              className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                              title="Enregistrer"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingTeam(null)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                              title="Annuler"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingTeam(team.id);
                                setEditTeamTokens(teamQuota?.maxTokens?.toString() || "");
                                setEditTeamRequests(teamQuota?.maxRequests?.toString() || "");
                              }}
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                              title="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {teamQuota && (
                              <button
                                onClick={() => deleteTeamQuota(team.id)}
                                className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                                title="Supprimer le quota spécifique"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* === Section 3: Quotas utilisateurs === */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <User className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Quotas utilisateurs</h2>
            <p className="text-sm text-muted-foreground">
              Quotas individuels — par défaut chaque utilisateur hérite du quota organisation
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium">Nom</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Quota</th>
                <th className="pb-2 font-medium">Consommation (mois)</th>
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.map((u) => {
                const userQuota = getUserQuota(u.id);
                const effective = getEffectiveQuota("user", u.id);
                const usage = userUsages[u.id];
                const quotaReached = isQuotaReached(usage, effective.maxTokens, effective.maxRequests);
                const isEditing = editingUser === u.id;

                return (
                  <tr key={u.id} className="group">
                    <td className="py-3 font-medium">{u.name || "—"}</td>
                    <td className="py-3 text-muted-foreground">{u.email}</td>
                    <td className="py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editUserTokens}
                            onChange={(e) => setEditUserTokens(e.target.value)}
                            placeholder="Tokens"
                            className="w-24 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            autoFocus
                          />
                          <input
                            type="number"
                            value={editUserRequests}
                            onChange={(e) => setEditUserRequests(e.target.value)}
                            placeholder="Requêtes"
                            className="w-24 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      ) : effective.inherited ? (
                        <span className="text-muted-foreground italic text-xs">Hérité</span>
                      ) : (
                        <span className="text-xs">
                          {effective.maxTokens ? formatTokens(effective.maxTokens) : "—"} tok
                          {" / "}
                          {effective.maxRequests ?? "—"} req
                        </span>
                      )}
                    </td>
                    <td className="py-3 min-w-[150px]">
                      {usage && (
                        <div className="space-y-1">
                          <ProgressBar value={usage.tokens} max={effective.maxTokens} />
                          <div className="text-xs text-muted-foreground">
                            {usage.requests} requête{usage.requests !== 1 ? "s" : ""}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      {quotaReached && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <AlertCircle className="h-3 w-3" />
                          Quota atteint
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => saveUserQuota(u.id)}
                            className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                            title="Enregistrer"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                            title="Annuler"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingUser(u.id);
                              setEditUserTokens(userQuota?.maxTokens?.toString() || "");
                              setEditUserRequests(userQuota?.maxRequests?.toString() || "");
                            }}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                            title={userQuota ? "Modifier" : "Définir un quota personnel"}
                          >
                            {userQuota ? (
                              <Pencil className="h-4 w-4" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </button>
                          {userQuota && (
                            <button
                              onClick={() => deleteUserQuota(u.id)}
                              className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                              title="Supprimer le quota personnel"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Aucun utilisateur trouvé.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
