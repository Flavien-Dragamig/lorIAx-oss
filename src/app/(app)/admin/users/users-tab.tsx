"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MoreVertical, Trash2, Shield, UserPlus, Eye, EyeOff } from "lucide-react";
import { VizHashAvatar } from "@/components/ui/vizhash-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "next-auth/react";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrateur",
  editor: "Éditeur",
  viewer: "Lecteur",
};

const roleBadgeColors: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  admin: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  editor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const ROLES_FOR_ADMIN = ["viewer", "editor", "admin"] as const;
const ROLES_FOR_SUPER_ADMIN = ["viewer", "editor", "admin", "super_admin"] as const;

export function AdminUsersTab() {
  const { data: session } = useSession();
  const currentRole = (session?.user as { globalRole?: string })?.globalRole ?? "admin";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    globalRole: "editor",
    sendWelcomeEmail: false,
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data);
    } catch {
      toast.error("Erreur lors du chargement des utilisateurs");
    }
    setLoading(false);
  }

  function openDialog() {
    setForm({ name: "", email: "", password: "", globalRole: "editor", sendWelcomeEmail: false });
    setShowPassword(false);
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caractères");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la création");
        return;
      }
      if (data.emailSent) {
        toast.success("Utilisateur créé — email de bienvenue envoyé");
      } else if (form.sendWelcomeEmail) {
        toast.success("Utilisateur créé", { description: "L'email de bienvenue n'a pas pu être envoyé" });
      } else {
        toast.success("Utilisateur créé avec succès");
      }
      setDialogOpen(false);
      fetchUsers();
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  }

  async function updateRole(userId: string, role: string) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, globalRole: role }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Erreur lors de la mise à jour");
        return;
      }
      toast.success("Rôle mis à jour");
      fetchUsers();
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  }

  async function deleteUser(userId: string, name: string) {
    if (!confirm(`Supprimer l'utilisateur « ${name} » ? Cette action est irréversible.`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success("Utilisateur supprimé");
      fetchUsers();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  const availableRoles = currentRole === "super_admin" ? ROLES_FOR_SUPER_ADMIN : ROLES_FOR_ADMIN;

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
          <h2 className="text-lg font-semibold">Utilisateurs</h2>
          <p className="text-sm text-muted-foreground">
            {users.length} utilisateur{users.length > 1 ? "s" : ""} enregistré{users.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openDialog} size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Utilisateur</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Rôle</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Inscrit le</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <VizHashAvatar email={u.email} size={32} />
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeColors[u.globalRole] || roleBadgeColors.viewer}`}>
                    <Shield className="h-3 w-3" />
                    {roleLabels[u.globalRole] || u.globalRole}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[180px]">
                      {availableRoles.map((role) => (
                        <DropdownMenuItem
                          key={role}
                          className="whitespace-nowrap"
                          onClick={() => updateRole(u.id, role)}
                          disabled={u.globalRole === role}
                        >
                          Définir {roleLabels[role]}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem
                        className="text-destructive whitespace-nowrap"
                        onClick={() => deleteUser(u.id, u.name)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog création utilisateur */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="create-name">Nom</Label>
              <Input
                id="create-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Prénom Nom"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="prenom.nom@organisation.fr"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="create-password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 caractères"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="create-role">Rôle</Label>
              <Select
                value={form.globalRole}
                onValueChange={(v) => setForm((f) => ({ ...f, globalRole: v ?? f.globalRole }))}
              >
                <SelectTrigger id="create-role">
                  <SelectValue>{roleLabels[form.globalRole]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="create-send-email"
                checked={form.sendWelcomeEmail}
                onCheckedChange={(v) => setForm((f) => ({ ...f, sendWelcomeEmail: v }))}
              />
              <Label htmlFor="create-send-email" className="cursor-pointer font-normal">
                Envoyer un email de bienvenue avec les identifiants
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Création…" : "Créer l'utilisateur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
