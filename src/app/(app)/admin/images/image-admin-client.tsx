"use client";

import { useState, useEffect } from "react";
import { Trash2, Pencil, Upload, Plus, X } from "lucide-react";

interface OrgImage {
  id: string;
  name: string;
  url: string;
  sizeBytes: number | null;
  contentType: string;
  createdAt: string;
}

interface ImageProvider {
  id: string;
  name: string;
  displayName: string;
  providerType: string;
  isEnabled: boolean;
  hasApiKey: boolean;
}

const KNOWN_PROVIDERS = [
  { value: "unsplash", label: "Unsplash", slug: "unsplash" },
  { value: "pexels", label: "Pexels", slug: "pexels" },
  { value: "pixabay", label: "Pixabay", slug: "pixabay" },
  { value: "shutterstock", label: "Shutterstock", slug: "shutterstock" },
  { value: "getty", label: "Getty Images", slug: "getty" },
] as const;

export function ImageAdminClient() {
  const [images, setImages] = useState<OrgImage[]>([]);
  const [providers, setProviders] = useState<ImageProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [editProviderId, setEditProviderId] = useState<string | null>(null);
  const [editProviderKey, setEditProviderKey] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<string>("unsplash");
  const [addDisplayName, setAddDisplayName] = useState("Unsplash");
  const [addSlug, setAddSlug] = useState("unsplash");
  const [addBaseUrl, setAddBaseUrl] = useState("");
  const [addApiKey, setAddApiKey] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/images").then((r) => r.json()).catch(() => []),
      fetch("/api/admin/image-providers").then((r) => r.json()).catch(() => []),
    ]).then(([imgs, provs]) => {
      setImages(Array.isArray(imgs) ? imgs : []);
      setProviders(Array.isArray(provs) ? provs : []);
      setLoading(false);
    });
  }, []);

  function handleTypeChange(type: string) {
    setAddType(type);
    if (type !== "custom") {
      const known = KNOWN_PROVIDERS.find((p) => p.value === type);
      if (known) {
        setAddDisplayName(known.label);
        setAddSlug(known.slug);
      }
      setAddBaseUrl("");
    } else {
      setAddDisplayName("");
      setAddSlug("");
      setAddBaseUrl("");
    }
  }

  async function addProvider() {
    if (!addSlug || !addDisplayName) return;
    setAdding(true);
    const res = await fetch("/api/admin/image-providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addSlug,
        displayName: addDisplayName,
        providerType: addType,
        baseUrl: addBaseUrl || null,
        apiKey: addApiKey || null,
      }),
    });
    if (res.ok) {
      const row = await res.json();
      setProviders((prev) => [...prev, { ...row, hasApiKey: !!addApiKey }]);
      setShowAddForm(false);
      setAddType("unsplash");
      setAddDisplayName("Unsplash");
      setAddSlug("unsplash");
      setAddBaseUrl("");
      setAddApiKey("");
    }
    setAdding(false);
  }

  async function deleteProvider(id: string) {
    if (!confirm("Supprimer ce fournisseur ?")) return;
    await fetch(`/api/admin/image-providers/${id}`, { method: "DELETE" });
    setProviders((prev) => prev.filter((p) => p.id !== id));
  }

  async function uploadOrgImage(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", file.name);
    const res = await fetch("/api/admin/images", { method: "POST", body: fd });
    const data = await res.json();
    if (data.id) setImages((prev) => [...prev, data]);
  }

  async function deleteImage(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" de la bibliothèque org ?`)) return;
    await fetch(`/api/admin/images/${id}`, { method: "DELETE" });
    setImages((prev) => prev.filter((i) => i.id !== id));
  }

  async function renameImage(id: string) {
    await fetch(`/api/admin/images/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameName }),
    });
    setImages((prev) =>
      prev.map((i) => (i.id === id ? { ...i, name: renameName } : i))
    );
    setRenameId(null);
  }

  async function toggleProvider(id: string, current: boolean) {
    const res = await fetch(`/api/admin/image-providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !current }),
    });
    if (res.ok)
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isEnabled: !current } : p))
      );
  }

  async function updateProviderKey(id: string) {
    await fetch(`/api/admin/image-providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: editProviderKey }),
    });
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, hasApiKey: true } : p))
    );
    setEditProviderId(null);
    setEditProviderKey("");
  }

  if (loading) return <p className="text-muted-foreground text-sm">Chargement…</p>;

  return (
    <div className="space-y-8">
      {/* Images organisationnelles */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Images organisationnelles</h2>
          <label className="cursor-pointer flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm font-medium hover:bg-primary/90">
            <Upload size={14} /> Ajouter une image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadOrgImage(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Ces images (logos, visuels institutionnels) sont accessibles par tous les membres dans le Studio, onglet Bibliothèque.
        </p>
        {images.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune image partagée. Ajoutez vos logos et visuels institutionnels.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {images.map((img) => (
            <div key={img.id} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name}
                className="w-full aspect-square object-cover rounded-lg border border-border"
              />
              {renameId === img.id ? (
                <input
                  autoFocus
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && renameImage(img.id)}
                  className="w-full text-xs border rounded px-1 py-0.5"
                />
              ) : (
                <p className="text-xs text-muted-foreground truncate" title={img.name}>
                  {img.name}
                </p>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setRenameId(img.id);
                    setRenameName(img.name);
                  }}
                  className="flex-1 text-xs border rounded px-1 py-0.5 hover:bg-accent flex items-center justify-center gap-1"
                >
                  <Pencil size={10} /> Renommer
                </button>
                <button
                  onClick={() => deleteImage(img.id, img.name)}
                  className="flex-1 text-xs border rounded px-1 py-0.5 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center gap-1"
                >
                  <Trash2 size={10} /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fournisseurs d'images */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Fournisseurs d&apos;images</h2>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 text-sm border rounded px-3 py-1.5 hover:bg-accent"
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
            {showAddForm ? "Annuler" : "Ajouter"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Configurez les clés API pour les banques d&apos;images. Unsplash gratuit (50 req/h) est disponible via la clé serveur.
        </p>

        {/* Formulaire d'ajout inline */}
        {showAddForm && (
          <div className="border rounded-lg p-4 mb-4 bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Type de fournisseur</label>
                <select
                  value={addType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                >
                  {KNOWN_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                  <option value="custom">Autre (personnalisé)</option>
                </select>
              </div>
              {addType === "custom" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Identifiant unique (slug)</label>
                  <input
                    type="text"
                    placeholder="ex : mon-service"
                    value={addSlug}
                    onChange={(e) => setAddSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
              )}
            </div>
            {addType === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Nom affiché</label>
                  <input
                    type="text"
                    placeholder="ex : Ma banque d'images"
                    value={addDisplayName}
                    onChange={(e) => setAddDisplayName(e.target.value)}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">URL du service</label>
                  <input
                    type="url"
                    placeholder="https://monservice.com"
                    value={addBaseUrl}
                    onChange={(e) => setAddBaseUrl(e.target.value)}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Clé API {addType === "custom" ? "(optionnel)" : ""}
              </label>
              <input
                type="password"
                placeholder="Clé API"
                value={addApiKey}
                onChange={(e) => setAddApiKey(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1.5"
              />
            </div>
            {addType === "custom" && (
              <p className="text-xs text-muted-foreground">
                Les fournisseurs personnalisés sont enregistrés pour référence. La recherche automatique n&apos;est pas disponible pour les fournisseurs inconnus.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="text-sm px-3 py-1.5 border rounded hover:bg-accent"
              >
                Annuler
              </button>
              <button
                onClick={addProvider}
                disabled={adding || !addSlug || !addDisplayName}
                className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {adding ? "Ajout…" : "Ajouter le fournisseur"}
              </button>
            </div>
          </div>
        )}

        {providers.length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground">Aucun fournisseur configuré.</p>
        )}

        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center gap-4 border rounded p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{p.displayName}</p>
                  {p.providerType === "custom" && (
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      intégration manuelle
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.name} — Clé API : {p.hasApiKey ? "configurée" : "non configurée"}
                </p>
              </div>
              {editProviderId === p.id ? (
                <div className="flex gap-2 items-center">
                  <input
                    autoFocus
                    type="password"
                    placeholder="Nouvelle clé API"
                    value={editProviderKey}
                    onChange={(e) => setEditProviderKey(e.target.value)}
                    className="text-xs border rounded px-2 py-1 w-48"
                  />
                  <button
                    onClick={() => updateProviderKey(p.id)}
                    className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setEditProviderId(null)}
                    className="text-xs px-2 py-1 rounded border"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditProviderId(p.id)}
                    className="text-xs border rounded px-2 py-1 hover:bg-accent"
                  >
                    {p.hasApiKey ? "Modifier la clé" : "Ajouter une clé"}
                  </button>
                  <button
                    onClick={() => toggleProvider(p.id, p.isEnabled)}
                    className={`text-xs rounded px-2 py-1 ${
                      p.isEnabled
                        ? "bg-primary text-primary-foreground"
                        : "border text-muted-foreground"
                    }`}
                  >
                    {p.isEnabled ? "Activé" : "Désactivé"}
                  </button>
                  <button
                    onClick={() => deleteProvider(p.id)}
                    className="text-xs border rounded px-2 py-1 hover:bg-destructive hover:text-destructive-foreground"
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
