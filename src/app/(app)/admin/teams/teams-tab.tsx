"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Trash2,
  Users,
  UserPlus,
  X,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import { VizHashAvatar } from "@/components/ui/vizhash-avatar";

interface AdminTeam {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

interface TeamMember {
  userId: string;
  role: string;
  joinedAt: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
}

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
}

interface TeamSpace {
  id: string;
  slug: string;
  name: string;
}

function MemberAvatar({ email }: { email: string }) {
  return <VizHashAvatar email={email} size={32} />;
}

// ─── Vue détaillée d'une équipe ──────────────────────────────────
function TeamDetail({
  team,
  onBack,
  onDeleted,
}: {
  team: AdminTeam;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [newRole, setNewRole] = useState("member");
  const [showAdd, setShowAdd] = useState(false);
  const [teamSpace, setTeamSpace] = useState<TeamSpace | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}/members`);
      if (res.ok) setMembers(await res.json());
    } catch {
      toast.error("Erreur lors du chargement des membres");
    }
    setLoading(false);
  }, [team.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Charger l'espace associé
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/spaces");
        if (res.ok) {
          const spaces: TeamSpace[] = await res.json();
          const found = spaces.find(
            (s: TeamSpace & { ownerTeamId?: string }) =>
              (s as TeamSpace & { ownerTeamId?: string }).ownerTeamId === team.id
          );
          if (found) setTeamSpace(found);
        }
      } catch {
        // ignore
      }
    })();
  }, [team.id]);

  // Recherche d'utilisateurs
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=5`
        );
        if (res.ok) {
          const data: UserSearchResult[] = await res.json();
          const existingIds = new Set(members.map((m) => m.userId));
          setSearchResults(data.filter((u) => !existingIds.has(u.id)));
        }
      } catch {
        // ignore
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, members]);

  async function addMember(userId: string) {
    try {
      const res = await fetch(`/api/admin/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        toast.success("Membre ajouté");
        setSearchQuery("");
        setSearchResults([]);
        loadMembers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }

  async function updateRole(userId: string, role: string) {
    try {
      await fetch(`/api/admin/teams/${team.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m))
      );
      toast.success("Rôle mis à jour");
    } catch {
      toast.error("Erreur réseau");
    }
  }

  async function removeMember(userId: string) {
    try {
      await fetch(`/api/admin/teams/${team.id}/members?userId=${userId}`, {
        method: "DELETE",
      });
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success("Membre retiré");
    } catch {
      toast.error("Erreur réseau");
    }
  }

  async function deleteTeam() {
    if (
      !confirm(
        "Supprimer l'équipe « " +
          team.name +
          " » et son espace ? Cette action est irréversible."
      )
    ) {
      return;
    }
    try {
      await fetch("/api/admin/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: team.id }),
      });
      toast.success("Équipe supprimée");
      onDeleted();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{team.name}</h2>
          {team.description && (
            <p className="text-sm text-muted-foreground">{team.description}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={deleteTeam}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Lien vers l'espace */}
      {teamSpace && (
        <Link
          href={`/s/${teamSpace.slug}`}
          className="flex items-center gap-2 px-4 py-3 mb-6 rounded-lg border border-border hover:bg-accent/30 transition-colors text-sm"
        >
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            Espace : <strong>{teamSpace.name}</strong>
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      )}

      {/* Membres */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">
          Membres ({members.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {/* Formulaire d'ajout */}
      {showAdd && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3 mb-4">
          <div className="flex gap-2">
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="member">Membre</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          {searching && (
            <p className="text-xs text-muted-foreground">Recherche...</p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => addMember(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <MemberAvatar email={u.email} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email}
                    </p>
                  </div>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Aucun utilisateur trouvé
            </p>
          )}
        </div>
      )}

      {/* Liste des membres */}
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
          Chargement des membres...
        </div>
      ) : members.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Aucun membre dans cette équipe.
        </div>
      ) : (
        <div className="space-y-1">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent/50 transition-colors group"
            >
              <MemberAvatar email={member.userEmail} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {member.userName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {member.userEmail}
                </p>
              </div>
              <select
                value={member.role}
                onChange={(e) => updateRole(member.userId, e.target.value)}
                className="px-2 py-1 rounded border border-input bg-background text-xs"
              >
                <option value="member">Membre</option>
                <option value="admin">Administrateur</option>
              </select>
              <button
                onClick={() => removeMember(member.userId)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                title="Retirer de l'équipe"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────
export function AdminTeamsTab() {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<AdminTeam | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teams");
      const data = await res.json();
      setTeams(data);
    } catch {
      toast.error("Erreur lors du chargement des équipes");
    }
    setLoading(false);
  }

  async function createTeam() {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc || null }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de la création");
        return;
      }
      toast.success("Équipe et espace créés");
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      fetchTeams();
    } catch {
      toast.error("Erreur lors de la création");
    }
  }

  // Vue détaillée d'une équipe
  if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        onBack={() => {
          setSelectedTeam(null);
          fetchTeams();
        }}
        onDeleted={() => {
          setSelectedTeam(null);
          fetchTeams();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Équipes</h2>
          <p className="text-sm text-muted-foreground">
            {teams.length} équipe{teams.length > 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger render={<Button size="sm" className="gap-2" />}>
            <Plus className="h-4 w-4" />
            Nouvelle équipe
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une équipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Nom</label>
                <Input
                  value={newName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                  placeholder="Nom de l'équipe"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description (optionnel)</label>
                <Input
                  value={newDesc}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDesc(e.target.value)}
                  placeholder="Description"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Un espace de travail sera automatiquement créé pour cette équipe.
              </p>
              <Button onClick={createTeam} disabled={!newName.trim()} className="w-full">
                Créer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">Aucune équipe</h3>
          <p className="text-sm text-muted-foreground">
            Créez une équipe pour collaborer avec d&apos;autres utilisateurs.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => setSelectedTeam(team)}
              className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:border-primary/30 transition-colors text-left w-full"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">{team.name}</h3>
                  {team.description && (
                    <p className="text-sm text-muted-foreground">{team.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {team.memberCount} membre{Number(team.memberCount) > 1 ? "s" : ""}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(team.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
