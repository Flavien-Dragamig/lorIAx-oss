"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  FlaskConical,
  Check,
  RotateCcw,
  Loader2,
  GitCompare,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptVariable {
  name: string;
  description: string;
}

interface PromptVersion {
  id: string;
  promptId: string;
  versionNumber: number;
  systemPrompt: string;
  userPromptTemplate: string | null;
  variables: PromptVariable[];
  isActive: boolean;
  trafficPercentage: number;
  changeNote: string;
  createdBy: string | null;
  createdAt: string;
}

interface PromptData {
  id: string;
  name: string;
  slug: string;
  usageType: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  versions: PromptVersion[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USAGE_TYPE_LABELS: Record<string, string> = {
  chat: "Chat RAG",
  summary_doc: "Résumé document",
  summary_meeting: "Résumé réunion",
  embeddings: "Embeddings",
  playground: "Playground",
};

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

function computeLineDiff(oldText: string, newText: string) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: { type: "same" | "add" | "remove"; text: string }[] = [];

  // Simple LCS-based line diff
  const n = oldLines.length;
  const m = newLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const actions: { type: "same" | "add" | "remove"; text: string }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      actions.unshift({ type: "same", text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      actions.unshift({ type: "add", text: newLines[j - 1] });
      j--;
    } else {
      actions.unshift({ type: "remove", text: oldLines[i - 1] });
      i--;
    }
  }

  return actions.length > 0 ? actions : result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminAIPromptEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [prompt, setPrompt] = useState<PromptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editing state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editUserPromptTemplate, setEditUserPromptTemplate] = useState("");
  const [editVariables, setEditVariables] = useState<PromptVariable[]>([]);
  const [editChangeNote, setEditChangeNote] = useState("");

  // Version panel state
  const [togglingVersion, setTogglingVersion] = useState<string | null>(null);

  // Diff state
  const [diffMode, setDiffMode] = useState(false);
  const [diffVersionA, setDiffVersionA] = useState<string | null>(null);
  const [diffVersionB, setDiffVersionB] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchPrompt = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ai/prompts/${id}`);
      if (res.ok) {
        const data: PromptData = await res.json();
        setPrompt(data);

        // Load latest active version into editor (or latest version)
        const activeVersion =
          data.versions.find((v) => v.isActive) ?? data.versions[0];
        if (activeVersion) {
          setEditSystemPrompt(activeVersion.systemPrompt);
          setEditUserPromptTemplate(activeVersion.userPromptTemplate ?? "");
          setEditVariables(
            Array.isArray(activeVersion.variables) ? activeVersion.variables : []
          );
        }
        setEditName(data.name);
        setEditDescription(data.description ?? "");
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPrompt();
  }, [fetchPrompt]);

  // ---------------------------------------------------------------------------
  // Auto-detect variables
  // ---------------------------------------------------------------------------

  const detectedVars = useMemo(() => {
    const allText = `${editSystemPrompt} ${editUserPromptTemplate}`;
    const matches = allText.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, "")))];
  }, [editSystemPrompt, editUserPromptTemplate]);

  // Sync detected vars with editVariables
  useEffect(() => {
    setEditVariables((prev) => {
      const existing = new Map(prev.map((v) => [v.name, v]));
      return detectedVars.map((name) => ({
        name,
        description: existing.get(name)?.description ?? "",
      }));
    });
  }, [detectedVars]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function saveNewVersion() {
    if (!editChangeNote || !editSystemPrompt) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/ai/prompts/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: editSystemPrompt,
          userPromptTemplate: editUserPromptTemplate || null,
          variables: editVariables,
          changeNote: editChangeNote,
          isActive: true,
          trafficPercentage: 100,
        }),
      });
      if (res.ok) {
        setEditChangeNote("");
        await fetchPrompt();
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateMetadata() {
    await fetch(`/api/admin/ai/prompts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        description: editDescription || null,
      }),
    });
    await fetchPrompt();
  }

  async function toggleVersionActive(versionId: string, currentActive: boolean) {
    setTogglingVersion(versionId);
    try {
      await fetch(`/api/admin/ai/prompts/${id}/versions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, isActive: !currentActive }),
      });
      await fetchPrompt();
    } finally {
      setTogglingVersion(null);
    }
  }

  async function updateTrafficPercentage(versionId: string, trafficPercentage: number) {
    await fetch(`/api/admin/ai/prompts/${id}/versions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId, trafficPercentage }),
    });
    await fetchPrompt();
  }

  function restoreVersion(version: PromptVersion) {
    setEditSystemPrompt(version.systemPrompt);
    setEditUserPromptTemplate(version.userPromptTemplate ?? "");
    setEditVariables(
      Array.isArray(version.variables) ? version.variables : []
    );
    setEditChangeNote(`Restauration de la v${version.versionNumber}`);
  }

  // ---------------------------------------------------------------------------
  // Diff
  // ---------------------------------------------------------------------------

  const versionAData = prompt?.versions.find((v) => v.id === diffVersionA);
  const versionBData = prompt?.versions.find((v) => v.id === diffVersionB);

  const diffLines = useMemo(() => {
    if (!versionAData || !versionBData) return [];
    return computeLineDiff(versionAData.systemPrompt, versionBData.systemPrompt);
  }, [versionAData, versionBData]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading || !prompt) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeVersions = prompt.versions.filter((v) => v.isActive);
  const hasAbTest = activeVersions.length > 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => router.push("/admin/ai/prompts")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <input
            className="text-2xl font-bold bg-transparent border-none outline-none w-full"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={updateMetadata}
          />
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground font-mono">
              {prompt.slug}
            </span>
            <span className="text-xs text-muted-foreground">
              {USAGE_TYPE_LABELS[prompt.usageType] ?? prompt.usageType}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(`/admin/ai/playground?promptId=${prompt.id}`)
          }
        >
          <FlaskConical className="h-4 w-4 mr-1" />
          Tester dans le Playground
        </Button>
      </div>

      {/* 2-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left panel — editing */}
        <div className="lg:col-span-3 space-y-4">
          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px]"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              onBlur={updateMetadata}
              placeholder="Description du prompt..."
            />
          </div>

          {/* System prompt */}
          <div>
            <label className="text-sm font-medium">System prompt</label>
            <textarea
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[200px] leading-relaxed"
              value={editSystemPrompt}
              onChange={(e) => setEditSystemPrompt(e.target.value)}
              placeholder="Tu es un assistant..."
            />
            {detectedVars.length > 0 && (
              <div className="mt-1 flex items-center gap-1 flex-wrap">
                <span className="text-xs text-muted-foreground">Variables :</span>
                {detectedVars.map((v) => (
                  <span
                    key={v}
                    className="rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 text-xs font-mono"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* User prompt template */}
          <div>
            <label className="text-sm font-medium">
              Template prompt utilisateur
            </label>
            <textarea
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[120px] leading-relaxed"
              value={editUserPromptTemplate}
              onChange={(e) => setEditUserPromptTemplate(e.target.value)}
              placeholder="{{context}}\n\nQuestion: {{question}}"
            />
          </div>

          {/* Variables */}
          {editVariables.length > 0 && (
            <div>
              <label className="text-sm font-medium">Variables détectées</label>
              <div className="mt-2 space-y-2">
                {editVariables.map((v, i) => (
                  <div key={v.name} className="flex items-center gap-3">
                    <span className="rounded bg-muted px-2 py-1 text-xs font-mono min-w-[100px]">
                      {`{{${v.name}}}`}
                    </span>
                    <input
                      className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                      value={v.description}
                      onChange={(e) => {
                        const updated = [...editVariables];
                        updated[i] = { ...v, description: e.target.value };
                        setEditVariables(updated);
                      }}
                      placeholder="Description de la variable..."
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save section */}
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <label className="text-sm font-medium">
                Note de changement <span className="text-red-500">*</span>
              </label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={editChangeNote}
                onChange={(e) => setEditChangeNote(e.target.value)}
                placeholder="Décrivez les modifications..."
              />
            </div>
            <Button
              onClick={saveNewVersion}
              disabled={saving || !editChangeNote || !editSystemPrompt}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Sauvegarder nouvelle version
            </Button>
          </div>
        </div>

        {/* Right panel — version history */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Historique des versions</h2>
            <Button
              variant={diffMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDiffMode(!diffMode);
                setDiffVersionA(null);
                setDiffVersionB(null);
              }}
            >
              <GitCompare className="h-4 w-4 mr-1" />
              Comparer
            </Button>
          </div>

          {hasAbTest && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4" />
                Test A/B actif — {activeVersions.length} versions actives
              </p>
            </div>
          )}

          {/* Diff selection helper */}
          {diffMode && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              {!diffVersionA
                ? "Sélectionnez la première version (ancienne)"
                : !diffVersionB
                  ? "Sélectionnez la seconde version (nouvelle)"
                  : "Comparaison affichée ci-dessous"}
              {(diffVersionA || diffVersionB) && (
                <button
                  className="ml-2 text-xs underline"
                  onClick={() => {
                    setDiffVersionA(null);
                    setDiffVersionB(null);
                  }}
                >
                  Réinitialiser
                </button>
              )}
            </div>
          )}

          {/* Version list */}
          <div className="space-y-2">
            {prompt.versions.map((version) => {
              const isDiffSelected =
                diffVersionA === version.id || diffVersionB === version.id;

              return (
                <div
                  key={version.id}
                  className={cn(
                    "rounded-lg border p-3 space-y-2 transition-colors",
                    isDiffSelected && "ring-2 ring-primary",
                    diffMode && "cursor-pointer hover:bg-muted/30"
                  )}
                  onClick={() => {
                    if (!diffMode) return;
                    if (!diffVersionA) {
                      setDiffVersionA(version.id);
                    } else if (!diffVersionB && version.id !== diffVersionA) {
                      setDiffVersionB(version.id);
                    }
                  }}
                >
                  {/* Version header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">
                        v{version.versionNumber}
                      </span>
                      {version.isActive && (
                        <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 text-xs font-medium">
                          Active
                        </span>
                      )}
                      {version.isActive && hasAbTest && (
                        <span className="text-xs text-muted-foreground">
                          {version.trafficPercentage} % du trafic
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Change note */}
                  <p className="text-sm text-muted-foreground">
                    {version.changeNote}
                  </p>

                  {/* Traffic percentage slider (visible when A/B test) */}
                  {version.isActive && hasAbTest && !diffMode && (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={version.trafficPercentage}
                        onChange={(e) =>
                          updateTrafficPercentage(
                            version.id,
                            parseInt(e.target.value)
                          )
                        }
                        className="flex-1 h-1.5 accent-primary"
                      />
                      <span className="text-xs font-mono w-10 text-right">
                        {version.trafficPercentage} %
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {!diffMode && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleVersionActive(version.id, version.isActive)
                        }
                        disabled={togglingVersion === version.id}
                      >
                        {togglingVersion === version.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : version.isActive ? (
                          <X className="h-3 w-3 mr-1" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        {version.isActive ? "Désactiver" : "Activer"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restoreVersion(version)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restaurer
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Diff view */}
          {diffMode && versionAData && versionBData && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-sm font-medium flex items-center justify-between">
                <span>
                  v{versionAData.versionNumber} → v{versionBData.versionNumber}
                </span>
                <span className="text-xs text-muted-foreground">
                  System prompt
                </span>
              </div>
              <div className="p-0 text-sm font-mono overflow-x-auto max-h-[400px] overflow-y-auto">
                {diffLines.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "px-4 py-0.5 border-l-2",
                      line.type === "add" &&
                        "bg-green-50 dark:bg-green-950/30 border-green-500 text-green-800 dark:text-green-300",
                      line.type === "remove" &&
                        "bg-red-50 dark:bg-red-950/30 border-red-500 text-red-800 dark:text-red-300",
                      line.type === "same" &&
                        "border-transparent text-muted-foreground"
                    )}
                  >
                    <span className="select-none mr-2 text-xs opacity-50">
                      {line.type === "add"
                        ? "+"
                        : line.type === "remove"
                          ? "-"
                          : " "}
                    </span>
                    {line.text || "\u00A0"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
