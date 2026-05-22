"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Play,
  Copy,
  Check,
  Loader2,
  GitCompareArrows,
  RotateCcw,
  Clock,
  Coins,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Provider {
  id: string;
  name: string;
  displayName: string;
  connectorType: string;
  defaultModel: string | null;
  isEnabled: boolean;
  pricing: Record<string, number> | null;
}

interface Prompt {
  id: string;
  name: string;
  slug: string;
  usageType: string;
}

interface PromptVersion {
  id: string;
  systemPrompt: string;
  userPromptTemplate: string | null;
  variables: Array<{ name: string; description?: string }>;
  isActive: boolean;
  versionNumber: number;
}

interface RunMetrics {
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costEstimate: number | null;
}

interface PanelState {
  providerId: string;
  model: string;
  response: string;
  isStreaming: boolean;
  metrics: RunMetrics | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

function replaceVariables(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] || `{{${name}}}`);
}

async function streamFromPlayground(
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
  onDone: (metrics: RunMetrics) => void,
  signal?: AbortSignal
) {
  const startTime = Date.now();
  let fullText = "";
  let tokensIn = 0;
  let tokensOut = 0;

  const res = await fetch("/api/admin/ai/playground", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
    throw new Error(err.error || `Erreur HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Pas de stream disponible");

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    // Parse Vercel AI data stream protocol
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;

      // Text chunk: 0:"text content"
      if (line.startsWith("0:")) {
        try {
          const text = JSON.parse(line.slice(2));
          fullText += text;
          onChunk(fullText);
        } catch {
          // skip unparseable
        }
      }

      // Usage data: d:{...}  or  e:{...}
      if (line.startsWith("d:")) {
        try {
          const data = JSON.parse(line.slice(2));
          if (data.usage) {
            tokensIn = data.usage.promptTokens || 0;
            tokensOut = data.usage.completionTokens || 0;
          }
        } catch {
          // skip
        }
      }
    }
  }

  const latencyMs = Date.now() - startTime;
  onDone({
    tokensIn,
    tokensOut,
    latencyMs,
    costEstimate: null, // calculated below if pricing available
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function estimateCost(
  metrics: RunMetrics,
  pricing: Record<string, number> | null
): number | null {
  if (!pricing) return null;
  const inputCost =
    (metrics.tokensIn * (pricing.inputPerMillion || 0)) / 1_000_000;
  const outputCost =
    (metrics.tokensOut * (pricing.outputPerMillion || 0)) / 1_000_000;
  return inputCost + outputCost;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function MetricsDisplay({
  metrics,
  pricing,
}: {
  metrics: RunMetrics;
  pricing: Record<string, number> | null;
}) {
  const cost = estimateCost(metrics, pricing);
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3 mt-3">
      <span className="flex items-center gap-1">
        <Hash className="h-3 w-3" />
        {metrics.tokensIn} in / {metrics.tokensOut} out
      </span>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {formatDuration(metrics.latencyMs)}
      </span>
      {cost !== null && (
        <span className="flex items-center gap-1">
          <Coins className="h-3 w-3" />~{cost.toFixed(4)} $
        </span>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Copier la réponse"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

function ProviderModelSelector({
  providers,
  providerId,
  model,
  onProviderChange,
  onModelChange,
  disabled,
}: {
  providers: Provider[];
  providerId: string;
  model: string;
  onProviderChange: (id: string) => void;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}) {
  const _provider = providers.find((p) => p.id === providerId);

  return (
    <div className="flex gap-2">
      <select
        value={providerId}
        onChange={(e) => {
          onProviderChange(e.target.value);
          const p = providers.find((p) => p.id === e.target.value);
          if (p?.defaultModel) onModelChange(p.defaultModel);
        }}
        disabled={disabled}
        className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="">Choisir un fournisseur...</option>
        {providers
          .filter((p) => p.isEnabled)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
      </select>
      <input
        type="text"
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        placeholder="Modèle (ex: gpt-4o)"
        disabled={disabled}
        className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function ResponsePanel({
  response,
  isStreaming,
  metrics,
  pricing,
}: {
  response: string;
  isStreaming: boolean;
  metrics: RunMetrics | null;
  pricing: Record<string, number> | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isStreaming) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [response, isStreaming]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Réponse</h3>
        {response && <CopyButton text={response} />}
      </div>
      <div
        ref={scrollRef}
        className="flex-1 min-h-[200px] max-h-[500px] overflow-y-auto rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap font-mono"
      >
        {!response && !isStreaming && (
          <span className="text-muted-foreground italic">
            La réponse du modèle apparaîtra ici...
          </span>
        )}
        {response}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-foreground/70 animate-pulse ml-0.5" />
        )}
      </div>
      {metrics && <MetricsDisplay metrics={metrics} pricing={pricing} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PlaygroundPage() {
  const searchParams = useSearchParams();
  const promptIdParam = searchParams.get("promptId");

  // Data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  // Config
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [topP, setTopP] = useState(1);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Result
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [metrics, setMetrics] = useState<RunMetrics | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [panelA, setPanelA] = useState<PanelState>({
    providerId: "",
    model: "",
    response: "",
    isStreaming: false,
    metrics: null,
  });
  const [panelB, setPanelB] = useState<PanelState>({
    providerId: "",
    model: "",
    response: "",
    isStreaming: false,
    metrics: null,
  });

  // Detected variables from system prompt
  const detectedVars = useMemo(
    () => extractVariables(systemPrompt),
    [systemPrompt]
  );

  // Load providers and prompts
  useEffect(() => {
    fetch("/api/admin/ai/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => {});

    fetch("/api/admin/ai/prompts")
      .then((r) => r.json())
      .then(setPrompts)
      .catch(() => {});
  }, []);

  // Auto-select first enabled provider
  useEffect(() => {
    if (providers.length > 0 && !providerId) {
      const enabled = providers.find((p) => p.isEnabled);
      if (enabled) {
        setProviderId(enabled.id);
        if (enabled.defaultModel) setModel(enabled.defaultModel);
      }
    }
  }, [providers, providerId]);

  // Load prompt from URL param
  useEffect(() => {
    if (promptIdParam && prompts.length > 0) {
      setSelectedPromptId(promptIdParam);
      loadPromptVersions(promptIdParam);
    }
  }, [promptIdParam, prompts]);  

  const loadPromptVersions = async (promptId: string) => {
    try {
      const res = await fetch(`/api/admin/ai/prompts/${promptId}/versions`);
      const versions: PromptVersion[] = await res.json();
      const active = versions.find((v) => v.isActive) || versions[0];
      if (active) {
        setSystemPrompt(active.systemPrompt);
        if (active.userPromptTemplate) {
          setUserPrompt(active.userPromptTemplate);
        }
        // Initialize variable fields
        if (active.variables && Array.isArray(active.variables)) {
          const vars: Record<string, string> = {};
          for (const v of active.variables as Array<{ name: string }>) {
            vars[v.name] = "";
          }
          setVariables(vars);
        }
      }
    } catch {
      // ignore
    }
  };

  const handlePromptSelect = (promptId: string) => {
    setSelectedPromptId(promptId);
    if (promptId) {
      loadPromptVersions(promptId);
    } else {
      setSystemPrompt("");
      setUserPrompt("");
      setVariables({});
    }
  };

  const getResolvedPrompts = useCallback(() => {
    const resolvedSystem = replaceVariables(systemPrompt, variables);
    const resolvedUser = replaceVariables(userPrompt, variables);
    return { resolvedSystem, resolvedUser };
  }, [systemPrompt, userPrompt, variables]);

  const selectedProvider = providers.find((p) => p.id === providerId);

  // ---------------------------------------------------------------------------
  // Execute — normal mode
  // ---------------------------------------------------------------------------

  const handleExecute = async () => {
    if (!providerId || !model || !userPrompt) return;

    // Abort previous
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResponse("");
    setMetrics(null);
    setError("");
    setIsStreaming(true);

    const { resolvedSystem, resolvedUser } = getResolvedPrompts();

    try {
      await streamFromPlayground(
        {
          providerId,
          model,
          systemPrompt: resolvedSystem || undefined,
          userPrompt: resolvedUser,
          temperature,
          maxTokens,
          topP,
        },
        (text) => setResponse(text),
        (m) => {
          setMetrics(m);
          setIsStreaming(false);
        },
        controller.signal
      );
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || "Erreur lors de l'exécution");
        setIsStreaming(false);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Execute — compare mode
  // ---------------------------------------------------------------------------

  const handleCompareExecute = async () => {
    if (!userPrompt) return;
    if (!panelA.providerId || !panelA.model) return;
    if (!panelB.providerId || !panelB.model) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError("");
    setPanelA((prev) => ({ ...prev, response: "", isStreaming: true, metrics: null }));
    setPanelB((prev) => ({ ...prev, response: "", isStreaming: true, metrics: null }));

    const { resolvedSystem, resolvedUser } = getResolvedPrompts();

    const runPanel = (
      panel: PanelState,
      setPanel: React.Dispatch<React.SetStateAction<PanelState>>
    ) =>
      streamFromPlayground(
        {
          providerId: panel.providerId,
          model: panel.model,
          systemPrompt: resolvedSystem || undefined,
          userPrompt: resolvedUser,
          temperature,
          maxTokens,
          topP,
        },
        (text) => setPanel((prev) => ({ ...prev, response: text })),
        (m) => setPanel((prev) => ({ ...prev, metrics: m, isStreaming: false })),
        controller.signal
      ).catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") {
          setPanel((prev) => ({
            ...prev,
            response: `Erreur : ${(err as Error).message}`,
            isStreaming: false,
          }));
        }
      });

    await Promise.all([runPanel(panelA, setPanelA), runPanel(panelB, setPanelB)]);
  };

  // Sync panel A/B provider when switching to compare mode
  useEffect(() => {
    if (compareMode) {
      if (!panelA.providerId && providerId) {
        setPanelA((prev) => ({ ...prev, providerId, model }));
      }
    }
  }, [compareMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    abortRef.current?.abort();
    setResponse("");
    setMetrics(null);
    setError("");
    setIsStreaming(false);
    setSystemPrompt("");
    setUserPrompt("");
    setSelectedPromptId("");
    setVariables({});
    setTemperature(0.7);
    setMaxTokens(2048);
    setTopP(1);
    setPanelA({ providerId: "", model: "", response: "", isStreaming: false, metrics: null });
    setPanelB({ providerId: "", model: "", response: "", isStreaming: false, metrics: null });
  };

  const isAnyStreaming =
    isStreaming || panelA.isStreaming || panelB.isStreaming;

  const pricingA = providers.find((p) => p.id === panelA.providerId)?.pricing ?? null;
  const pricingB = providers.find((p) => p.id === panelB.providerId)?.pricing ?? null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Playground IA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Testez vos prompts en temps réel avec streaming
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              compareMode
                ? "bg-primary text-primary-foreground"
                : "border bg-background hover:bg-accent"
            )}
          >
            <GitCompareArrows className="h-4 w-4" />
            Comparer
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Shared prompt area (compare mode) or 2 columns (normal mode) */}
      {compareMode ? (
        <CompareLayout
          providers={providers}
          prompts={prompts}
          systemPrompt={systemPrompt}
          setSystemPrompt={setSystemPrompt}
          userPrompt={userPrompt}
          setUserPrompt={setUserPrompt}
          selectedPromptId={selectedPromptId}
          onPromptSelect={handlePromptSelect}
          detectedVars={detectedVars}
          variables={variables}
          setVariables={setVariables}
          temperature={temperature}
          setTemperature={setTemperature}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          topP={topP}
          setTopP={setTopP}
          panelA={panelA}
          setPanelA={setPanelA}
          panelB={panelB}
          setPanelB={setPanelB}
          pricingA={pricingA}
          pricingB={pricingB}
          onExecute={handleCompareExecute}
          isAnyStreaming={isAnyStreaming}
          error={error}
        />
      ) : (
        <NormalLayout
          providers={providers}
          prompts={prompts}
          providerId={providerId}
          setProviderId={setProviderId}
          model={model}
          setModel={setModel}
          systemPrompt={systemPrompt}
          setSystemPrompt={setSystemPrompt}
          userPrompt={userPrompt}
          setUserPrompt={setUserPrompt}
          selectedPromptId={selectedPromptId}
          onPromptSelect={handlePromptSelect}
          detectedVars={detectedVars}
          variables={variables}
          setVariables={setVariables}
          temperature={temperature}
          setTemperature={setTemperature}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          topP={topP}
          setTopP={setTopP}
          response={response}
          isStreaming={isStreaming}
          metrics={metrics}
          selectedProvider={selectedProvider}
          onExecute={handleExecute}
          error={error}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Normal layout (2 columns)
// ---------------------------------------------------------------------------

function NormalLayout({
  providers,
  prompts,
  providerId,
  setProviderId,
  model,
  setModel,
  systemPrompt,
  setSystemPrompt,
  userPrompt,
  setUserPrompt,
  selectedPromptId,
  onPromptSelect,
  detectedVars,
  variables,
  setVariables,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  topP,
  setTopP,
  response,
  isStreaming,
  metrics,
  selectedProvider,
  onExecute,
  error,
}: {
  providers: Provider[];
  prompts: Prompt[];
  providerId: string;
  setProviderId: (id: string) => void;
  model: string;
  setModel: (m: string) => void;
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
  userPrompt: string;
  setUserPrompt: (s: string) => void;
  selectedPromptId: string;
  onPromptSelect: (id: string) => void;
  detectedVars: string[];
  variables: Record<string, string>;
  setVariables: (v: Record<string, string>) => void;
  temperature: number;
  setTemperature: (t: number) => void;
  maxTokens: number;
  setMaxTokens: (m: number) => void;
  topP: number;
  setTopP: (t: number) => void;
  response: string;
  isStreaming: boolean;
  metrics: RunMetrics | null;
  selectedProvider: Provider | undefined;
  onExecute: () => void;
  error: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left column — config */}
      <div className="space-y-4">
        {/* Provider & Model */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">Fournisseur et modèle</label>
          <ProviderModelSelector
            providers={providers}
            providerId={providerId}
            model={model}
            onProviderChange={setProviderId}
            onModelChange={setModel}
            disabled={isStreaming}
          />
        </fieldset>

        {/* Sliders */}
        <div className="grid grid-cols-3 gap-4">
          <SliderField
            label="Température"
            value={temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={setTemperature}
          />
          <SliderField
            label="Max tokens"
            value={maxTokens}
            min={100}
            max={8192}
            step={100}
            onChange={setMaxTokens}
          />
          <SliderField
            label="Top P"
            value={topP}
            min={0}
            max={1}
            step={0.1}
            onChange={setTopP}
          />
        </div>

        {/* Prompt library */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">
            Bibliothèque de prompts{" "}
            <span className="text-muted-foreground font-normal">(optionnel)</span>
          </label>
          <select
            value={selectedPromptId}
            onChange={(e) => onPromptSelect(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Aucun — saisie libre</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.usageType})
              </option>
            ))}
          </select>
        </fieldset>

        {/* System prompt */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">Prompt système</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Définissez le comportement du modèle..."
            rows={4}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y font-mono"
          />
        </fieldset>

        {/* Variable fields */}
        {detectedVars.length > 0 && (
          <fieldset className="space-y-2">
            <label className="text-sm font-medium">Variables détectées</label>
            <div className="grid gap-2">
              {detectedVars.map((name) => (
                <div key={name} className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded shrink-0">
                    {`{{${name}}}`}
                  </code>
                  <input
                    type="text"
                    value={variables[name] || ""}
                    onChange={(e) =>
                      setVariables({ ...variables, [name]: e.target.value })
                    }
                    placeholder={`Valeur de ${name}`}
                    className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {/* User prompt */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">Prompt utilisateur</label>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Votre question ou instruction..."
            rows={6}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y font-mono"
          />
        </fieldset>

        {/* Execute */}
        <button
          onClick={onExecute}
          disabled={isStreaming || !providerId || !model || !userPrompt}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          {isStreaming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Exécuter
            </>
          )}
        </button>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Right column — response */}
      <div>
        <ResponsePanel
          response={response}
          isStreaming={isStreaming}
          metrics={metrics}
          pricing={selectedProvider?.pricing ?? null}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare layout
// ---------------------------------------------------------------------------

function CompareLayout({
  providers,
  prompts,
  systemPrompt,
  setSystemPrompt,
  userPrompt,
  setUserPrompt,
  selectedPromptId,
  onPromptSelect,
  detectedVars,
  variables,
  setVariables,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  topP,
  setTopP,
  panelA,
  setPanelA,
  panelB,
  setPanelB,
  pricingA,
  pricingB,
  onExecute,
  isAnyStreaming,
  error,
}: {
  providers: Provider[];
  prompts: Prompt[];
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
  userPrompt: string;
  setUserPrompt: (s: string) => void;
  selectedPromptId: string;
  onPromptSelect: (id: string) => void;
  detectedVars: string[];
  variables: Record<string, string>;
  setVariables: (v: Record<string, string>) => void;
  temperature: number;
  setTemperature: (t: number) => void;
  maxTokens: number;
  setMaxTokens: (m: number) => void;
  topP: number;
  setTopP: (t: number) => void;
  panelA: PanelState;
  setPanelA: React.Dispatch<React.SetStateAction<PanelState>>;
  panelB: PanelState;
  setPanelB: React.Dispatch<React.SetStateAction<PanelState>>;
  pricingA: Record<string, number> | null;
  pricingB: Record<string, number> | null;
  onExecute: () => void;
  isAnyStreaming: boolean;
  error: string;
}) {
  return (
    <div className="space-y-6">
      {/* Shared config */}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="grid grid-cols-3 gap-4">
          <SliderField
            label="Température"
            value={temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={setTemperature}
          />
          <SliderField
            label="Max tokens"
            value={maxTokens}
            min={100}
            max={8192}
            step={100}
            onChange={setMaxTokens}
          />
          <SliderField
            label="Top P"
            value={topP}
            min={0}
            max={1}
            step={0.1}
            onChange={setTopP}
          />
        </div>

        {/* Prompt library */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">Bibliothèque de prompts</label>
          <select
            value={selectedPromptId}
            onChange={(e) => onPromptSelect(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Aucun — saisie libre</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.usageType})
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="space-y-2">
          <label className="text-sm font-medium">Prompt système</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Définissez le comportement du modèle..."
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y font-mono"
          />
        </fieldset>

        {/* Variable fields */}
        {detectedVars.length > 0 && (
          <fieldset className="space-y-2">
            <label className="text-sm font-medium">Variables détectées</label>
            <div className="grid gap-2">
              {detectedVars.map((name) => (
                <div key={name} className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded shrink-0">
                    {`{{${name}}}`}
                  </code>
                  <input
                    type="text"
                    value={variables[name] || ""}
                    onChange={(e) =>
                      setVariables({ ...variables, [name]: e.target.value })
                    }
                    placeholder={`Valeur de ${name}`}
                    className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="space-y-2">
          <label className="text-sm font-medium">Prompt utilisateur</label>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Votre question ou instruction..."
            rows={4}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y font-mono"
          />
        </fieldset>

        <button
          onClick={onExecute}
          disabled={
            isAnyStreaming ||
            !panelA.providerId ||
            !panelA.model ||
            !panelB.providerId ||
            !panelB.model ||
            !userPrompt
          }
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          {isAnyStreaming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Exécuter les deux
            </>
          )}
        </button>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Side by side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel A */}
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">Panneau A</h3>
          <ProviderModelSelector
            providers={providers}
            providerId={panelA.providerId}
            model={panelA.model}
            onProviderChange={(id) => {
              setPanelA((prev) => ({ ...prev, providerId: id }));
              const p = providers.find((pr) => pr.id === id);
              if (p?.defaultModel)
                setPanelA((prev) => ({ ...prev, model: p.defaultModel! }));
            }}
            onModelChange={(m) => setPanelA((prev) => ({ ...prev, model: m }))}
            disabled={panelA.isStreaming}
          />
          <ResponsePanel
            response={panelA.response}
            isStreaming={panelA.isStreaming}
            metrics={panelA.metrics}
            pricing={pricingA}
          />
        </div>

        {/* Panel B */}
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">Panneau B</h3>
          <ProviderModelSelector
            providers={providers}
            providerId={panelB.providerId}
            model={panelB.model}
            onProviderChange={(id) => {
              setPanelB((prev) => ({ ...prev, providerId: id }));
              const p = providers.find((pr) => pr.id === id);
              if (p?.defaultModel)
                setPanelB((prev) => ({ ...prev, model: p.defaultModel! }));
            }}
            onModelChange={(m) => setPanelB((prev) => ({ ...prev, model: m }))}
            disabled={panelB.isStreaming}
          />
          <ResponsePanel
            response={panelB.response}
            isStreaming={panelB.isStreaming}
            metrics={panelB.metrics}
            pricing={pricingB}
          />
        </div>
      </div>

      {/* Comparison table */}
      {panelA.metrics && panelB.metrics && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Comparaison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                    Métrique
                  </th>
                  <th className="text-right py-2 px-4 font-medium">Panneau A</th>
                  <th className="text-right py-2 pl-4 font-medium">Panneau B</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 pr-4 text-muted-foreground">Tokens (entrée)</td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {panelA.metrics.tokensIn}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {panelB.metrics.tokensIn}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-muted-foreground">Tokens (sortie)</td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {panelA.metrics.tokensOut}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {panelB.metrics.tokensOut}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-muted-foreground">Latence</td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {formatDuration(panelA.metrics.latencyMs)}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {formatDuration(panelB.metrics.latencyMs)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-muted-foreground">Coût estimé</td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {estimateCost(panelA.metrics, pricingA)?.toFixed(4) ?? "—"} $
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {estimateCost(panelB.metrics, pricingB)?.toFixed(4) ?? "—"} $
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider field
// ---------------------------------------------------------------------------

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}:{" "}
        <span className="text-foreground tabular-nums">
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </fieldset>
  );
}
