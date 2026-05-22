# Wizard de configuration initiale — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wizard pleine page au premier démarrage qui purge les données de démo et guide la configuration de la nouvelle organisation.

**Architecture:** Route group `(setup)` avec layout minimal sans sidebar. Wizard multi-étapes en état local React, chaque étape sauvegarde en BDD via des route handlers dédiés sous `/api/setup/*`. Le middleware redirige vers `/setup` tant que `setup_completed` est absent de `system_settings`.

**Tech Stack:** Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL, Tailwind CSS 4, shadcn/ui, bcryptjs, papaparse (CSV)

---

## Structure des fichiers

```
src/app/(setup)/layout.tsx                    — Layout minimal (logo centré, pas de sidebar)
src/app/(setup)/setup/page.tsx                — Composant wizard principal (stepper + navigation)
src/components/setup/setup-stepper.tsx        — Barre de progression visuelle
src/components/setup/step-welcome.tsx         — Écran d'accueil + confirmation purge
src/components/setup/step-identity.tsx        — Identité organisation (nom, desc, logo, favicon)
src/components/setup/step-context.tsx         — Contexte métier (facultatif)
src/components/setup/step-users.tsx           — Création super admin + utilisateurs (manuel/CSV/LDAP)
src/components/setup/step-spaces.tsx          — Espaces pré-remplis modifiables
src/components/setup/step-permissions.tsx     — Matrice autorisations
src/components/setup/step-summary.tsx         — Récapitulatif + lancement
src/app/api/setup/purge/route.ts              — Purge données de démo
src/app/api/setup/identity/route.ts           — Sauvegarde identité
src/app/api/setup/context/route.ts            — Sauvegarde contexte métier
src/app/api/setup/users/route.ts              — Création utilisateurs (manuel + CSV)
src/app/api/setup/users/ldap/route.ts         — Sync LDAP
src/app/api/setup/spaces/route.ts             — Création espaces + repos git
src/app/api/setup/permissions/route.ts        — Attribution autorisations
src/app/api/setup/complete/route.ts           — Finalisation
src/lib/setup/purge.ts                        — Logique de purge (fonction réutilisable)
src/lib/setup/csv-parser.ts                   — Parsing et validation du CSV utilisateurs
public/templates/import-utilisateurs.csv      — (déjà créé) Modèle CSV
```

---

## Task 1 : Middleware — Redirection setup

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Ajouter la route `/setup` aux chemins publics dans le middleware**

Dans `src/middleware.ts`, ajouter `/setup` et `/api/setup` aux routes qui ne requièrent pas d'authentification. Le setup doit être accessible sans session puisqu'il n'y a pas encore d'utilisateur.

Ajouter au début de la fonction `middleware`, avant les vérifications de routes publiques existantes :

```typescript
// Setup wizard — accessible sans authentification
if (pathname === "/setup" || pathname.startsWith("/setup/") || pathname.startsWith("/api/setup/")) {
  return addCspHeaders(req);
}
```

Ce bloc doit être placé juste après la déclaration `const { pathname } = req.nextUrl;` et avant le bloc `publicPaths`.

- [ ] **Step 2: Ajouter la vérification du flag `setup_completed`**

Après la ligne `const { pathname } = req.nextUrl;` et après le bloc setup ajouté à l'étape précédente, ajouter la logique de redirection :

```typescript
// Redirection vers le wizard si l'instance n'est pas configurée
const setupDone = req.cookies.get("loriax-setup-done")?.value;
if (setupDone !== "1") {
  // Pas de cookie → vérifier en BDD (sera fait côté page)
  // On laisse passer, la page (setup)/setup vérifiera
}
```

En réalité, la vérification fine (BDD) se fera côté serveur dans le layout `(app)`. Le middleware se contente de laisser passer `/setup`. La redirection automatique depuis l'app vers `/setup` sera gérée dans le layout `(app)` (Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(setup): autoriser les routes /setup dans le middleware"
```

---

## Task 2 : Layout (app) — Redirection automatique vers /setup

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Lire le layout actuel**

Lire `src/app/(app)/layout.tsx` pour comprendre sa structure.

- [ ] **Step 2: Ajouter la vérification `setup_completed` en haut du layout**

Ajouter un composant serveur qui vérifie si `setup_completed` existe dans `system_settings`. Si absent ou `false`, faire un `redirect("/setup")`.

```typescript
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

async function checkSetupCompleted() {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "setup_completed"))
    .limit(1);

  if (!row || row.value !== true) {
    redirect("/setup");
  }
}
```

Appeler `await checkSetupCompleted()` au début du layout serveur, avant le rendu.

- [ ] **Step 3: Vérifier que l'app redirige bien quand `setup_completed` est absent**

Lancer `npm run dev`, accéder à `http://localhost:3000/` → doit rediriger vers `/setup`.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat(setup): redirection automatique vers /setup si instance non configurée"
```

---

## Task 3 : Layout setup + page wizard principale

**Files:**
- Create: `src/app/(setup)/layout.tsx`
- Create: `src/app/(setup)/setup/page.tsx`
- Create: `src/components/setup/setup-stepper.tsx`

- [ ] **Step 1: Créer le layout setup minimal**

```typescript
// src/app/(setup)/layout.tsx
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Créer le composant stepper**

```typescript
// src/components/setup/setup-stepper.tsx
"use client";

const STEPS = [
  { id: "welcome", label: "Bienvenue" },
  { id: "identity", label: "Identité" },
  { id: "context", label: "Contexte métier" },
  { id: "users", label: "Utilisateurs" },
  { id: "spaces", label: "Espaces" },
  { id: "permissions", label: "Autorisations" },
  { id: "summary", label: "Récapitulatif" },
] as const;

export type SetupStep = (typeof STEPS)[number]["id"];

interface SetupStepperProps {
  currentStep: SetupStep;
}

export function SetupStepper({ currentStep }: SetupStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              i < currentIndex
                ? "bg-primary text-primary-foreground"
                : i === currentIndex
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < currentIndex ? "✓" : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-8 ${i < currentIndex ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export { STEPS };
```

- [ ] **Step 3: Créer la page wizard principale**

```typescript
// src/app/(setup)/setup/page.tsx
"use client";

import { useState } from "react";
import { SetupStepper, type SetupStep } from "@/components/setup/setup-stepper";
import { StepWelcome } from "@/components/setup/step-welcome";
import { StepIdentity } from "@/components/setup/step-identity";
import { StepContext } from "@/components/setup/step-context";
import { StepUsers } from "@/components/setup/step-users";
import { StepSpaces } from "@/components/setup/step-spaces";
import { StepPermissions } from "@/components/setup/step-permissions";
import { StepSummary } from "@/components/setup/step-summary";

export interface SetupData {
  purged: boolean;
  identity: {
    name: string;
    description: string;
    logoUrl: string | null;
    faviconUrl: string | null;
  };
  context: {
    website: string;
    sector: string;
    presentation: string;
    values: string;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    team?: string;
    generatedPassword?: string;
  }>;
  spaces: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    classification: string;
    icon: string | null;
  }>;
  permissions: Array<{
    spaceId: string;
    userId: string;
    level: string;
  }>;
}

const initialData: SetupData = {
  purged: false,
  identity: { name: "", description: "", logoUrl: null, faviconUrl: null },
  context: { website: "", sector: "", presentation: "", values: "" },
  users: [],
  spaces: [],
  permissions: [],
};

export default function SetupPage() {
  const [step, setStep] = useState<SetupStep>("welcome");
  const [data, setData] = useState<SetupData>(initialData);

  function updateData(partial: Partial<SetupData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function nextStep(next: SetupStep) {
    setStep(next);
  }

  return (
    <div>
      <SetupStepper currentStep={step} />

      {step === "welcome" && (
        <StepWelcome
          data={data}
          onPurged={() => updateData({ purged: true })}
          onNext={() => nextStep("identity")}
          onSkip={() => {
            // "Plus tard" → retour à l'app avec les données de démo
            window.location.href = "/";
          }}
        />
      )}
      {step === "identity" && (
        <StepIdentity
          data={data}
          onUpdate={(identity) => updateData({ identity })}
          onNext={() => nextStep("context")}
        />
      )}
      {step === "context" && (
        <StepContext
          data={data}
          onUpdate={(context) => updateData({ context })}
          onNext={() => nextStep("users")}
          onSkip={() => nextStep("users")}
        />
      )}
      {step === "users" && (
        <StepUsers
          data={data}
          onUpdate={(users) => updateData({ users })}
          onNext={() => nextStep("spaces")}
        />
      )}
      {step === "spaces" && (
        <StepSpaces
          data={data}
          onUpdate={(spaces) => updateData({ spaces })}
          onNext={() => nextStep("permissions")}
        />
      )}
      {step === "permissions" && (
        <StepPermissions
          data={data}
          onUpdate={(permissions) => updateData({ permissions })}
          onNext={() => nextStep("summary")}
          onSkip={() => nextStep("summary")}
        />
      )}
      {step === "summary" && <StepSummary data={data} />}
    </div>
  );
}
```

- [ ] **Step 4: Vérifier que la page `/setup` s'affiche (placeholder)**

Créer d'abord des stubs pour chaque composant d'étape (juste un `<div>Étape X</div>`) pour que la page compile. Lancer `npm run dev`, accéder à `/setup`.

- [ ] **Step 5: Commit**

```bash
git add src/app/(setup)/layout.tsx src/app/(setup)/setup/page.tsx src/components/setup/setup-stepper.tsx
git commit -m "feat(setup): layout, page wizard et stepper de progression"
```

---

## Task 4 : API et composant — Purge des données de démo

**Files:**
- Create: `src/lib/setup/purge.ts`
- Create: `src/app/api/setup/purge/route.ts`
- Create: `src/components/setup/step-welcome.tsx`

- [ ] **Step 1: Créer la fonction de purge**

```typescript
// src/lib/setup/purge.ts
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Purge toutes les données de démo.
 * Conserve : ai_providers, ai_prompts, ai_prompt_versions, setup_completed.
 * L'ordre respecte les contraintes FK (enfants d'abord).
 */
export async function purgeAllData() {
  await db.transaction(async (tx) => {
    // 1. Tables enfants (dépendances profondes)
    await tx.execute(sql`DELETE FROM meeting_participants`);
    await tx.execute(sql`DELETE FROM meetings`);
    await tx.execute(sql`DELETE FROM event_dependencies`);
    await tx.execute(sql`DELETE FROM calendar_events`);
    await tx.execute(sql`DELETE FROM calendars`);
    await tx.execute(sql`DELETE FROM favorites`);
    await tx.execute(sql`DELETE FROM public_shares`);
    await tx.execute(sql`DELETE FROM document_comments`);
    await tx.execute(sql`DELETE FROM document_links`);
    await tx.execute(sql`DELETE FROM notifications`);
    await tx.execute(sql`DELETE FROM activity_log`);
    await tx.execute(sql`DELETE FROM api_keys`);

    // 2. Bases de données utilisateur
    await tx.execute(sql`DELETE FROM user_database_rows`);
    await tx.execute(sql`DELETE FROM user_database_columns`);
    await tx.execute(sql`DELETE FROM user_databases`);

    // 3. Documents et espaces
    await tx.execute(sql`DELETE FROM documents`);
    await tx.execute(sql`DELETE FROM space_permissions`);
    await tx.execute(sql`DELETE FROM spaces`);

    // 4. Équipes
    await tx.execute(sql`DELETE FROM team_members`);
    await tx.execute(sql`DELETE FROM teams`);

    // 5. Templates et utilisateurs
    await tx.execute(sql`DELETE FROM templates`);
    await tx.execute(sql`DELETE FROM users`);

    // 6. system_settings (sauf setup_completed)
    await tx.execute(
      sql`DELETE FROM system_settings WHERE key != 'setup_completed'`
    );

    // 7. Logs IA (purger aussi)
    await tx.execute(sql`DELETE FROM ai_usage_logs`);
    await tx.execute(sql`DELETE FROM ai_quotas`);
    await tx.execute(sql`DELETE FROM ai_model_assignments`);
  });
}
```

- [ ] **Step 2: Créer la route API de purge**

```typescript
// src/app/api/setup/purge/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { purgeAllData } from "@/lib/setup/purge";

export async function POST() {
  // Vérifier que le setup n'est pas déjà terminé
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "setup_completed"))
    .limit(1);

  if (row?.value === true) {
    return NextResponse.json(
      { error: "L'instance est déjà configurée" },
      { status: 400 }
    );
  }

  await purgeAllData();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Créer le composant step-welcome**

```typescript
// src/components/setup/step-welcome.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepWelcomeProps {
  data: SetupData;
  onPurged: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepWelcome({ data, onPurged, onNext, onSkip }: StepWelcomeProps) {
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);

  async function handlePurge() {
    setPurging(true);
    try {
      const res = await fetch("/api/setup/purge", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la purge");
      }
      onPurged();
      onNext();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setPurging(false);
    }
  }

  if (data.purged) {
    // Déjà purgé (retour arrière impossible, on passe à la suite)
    onNext();
    return null;
  }

  return (
    <div className="text-center space-y-6">
      <Sparkles className="h-16 w-16 text-primary mx-auto" />
      <h1 className="text-3xl font-bold">Bienvenue sur LorIAx</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        Configurez votre instance en quelques étapes : identité de votre
        organisation, utilisateurs, espaces de travail et autorisations.
      </p>

      {!confirming ? (
        <div className="flex flex-col gap-3 items-center pt-4">
          <Button size="lg" className="gap-2" onClick={() => setConfirming(true)}>
            Configurer mon instance
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Plus tard
          </Button>
        </div>
      ) : (
        <div className="space-y-4 p-6 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            Cette opération va supprimer toutes les données de démonstration
            (utilisateurs, documents, espaces, etc.). Les fournisseurs IA et les
            prompts système seront conservés.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={purging}
            >
              Annuler
            </Button>
            <Button
              onClick={handlePurge}
              disabled={purging}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {purging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression en cours...
                </>
              ) : (
                "Confirmer et continuer"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Tester la purge en dev**

Lancer `npm run dev`, aller sur `/setup`, cliquer « Configurer » puis « Confirmer ». Vérifier dans la BDD que les tables sont vides (sauf `ai_providers` et `ai_prompts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/setup/purge.ts src/app/api/setup/purge/route.ts src/components/setup/step-welcome.tsx
git commit -m "feat(setup): purge des données de démo + écran de bienvenue"
```

---

## Task 5 : Étape 1 — Identité de l'organisation

**Files:**
- Create: `src/app/api/setup/identity/route.ts`
- Create: `src/components/setup/step-identity.tsx`

- [ ] **Step 1: Créer la route API identity**

```typescript
// src/app/api/setup/identity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, logoUrl, faviconUrl } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Le nom de l'organisation est obligatoire" },
      { status: 400 }
    );
  }

  const now = new Date();
  const entries = [
    { key: "org_name", value: name.trim() },
    { key: "org_description", value: description?.trim() || "" },
    { key: "org_logo_url", value: logoUrl || null },
    { key: "org_favicon_url", value: faviconUrl || null },
  ];

  for (const entry of entries) {
    await db
      .insert(systemSettings)
      .values({ key: entry.key, value: entry.value, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: entry.value, updatedAt: now },
      });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Créer le composant step-identity**

Formulaire avec les champs : nom (obligatoire), description (textarea), upload logo, upload favicon. L'upload utilise le système existant (endpoint `/api/upload` ou écriture directe). Pour le MVP, les uploads de logo/favicon seront stockés dans `public/uploads/` avec un appel `fetch` vers un endpoint dédié, ou en base64 dans `system_settings`. Préférer la simplicité : upload vers `/api/upload` existant si disponible, sinon stocker en base64 temporairement.

Le composant doit :
- Appeler `POST /api/setup/identity` au clic sur « Suivant »
- Valider que le nom n'est pas vide
- Appeler `onUpdate()` puis `onNext()` en cas de succès

```typescript
// src/components/setup/step-identity.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, Building2 } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepIdentityProps {
  data: SetupData;
  onUpdate: (identity: SetupData["identity"]) => void;
  onNext: () => void;
}

export function StepIdentity({ data, onUpdate, onNext }: StepIdentityProps) {
  const [name, setName] = useState(data.identity.name);
  const [description, setDescription] = useState(data.identity.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleNext() {
    if (!name.trim()) {
      setError("Le nom de l'organisation est obligatoire");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/setup/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          logoUrl: null,
          faviconUrl: null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }

      onUpdate({
        name: name.trim(),
        description: description.trim(),
        logoUrl: null,
        faviconUrl: null,
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Building2 className="h-12 w-12 text-primary mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Identité de l'organisation</h2>
        <p className="text-muted-foreground mt-1">
          Ces informations seront affichées dans l'interface.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Nom de l'organisation *</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mon organisation"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-desc">Description courte</Label>
          <textarea
            id="org-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Quelques mots sur votre organisation..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
          />
        </div>

        {/* TODO Task ultérieure : upload logo et favicon */}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Suivant
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Tester l'étape identité**

Lancer le wizard, passer la purge, vérifier que l'étape identité s'affiche, saisir un nom, cliquer « Suivant ». Vérifier que `org_name` est bien dans `system_settings`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/setup/identity/route.ts src/components/setup/step-identity.tsx
git commit -m "feat(setup): étape identité de l'organisation"
```

---

## Task 6 : Étape 2 — Contexte métier

**Files:**
- Create: `src/app/api/setup/context/route.ts`
- Create: `src/components/setup/step-context.tsx`

- [ ] **Step 1: Créer la route API context**

```typescript
// src/app/api/setup/context/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { website, sector, presentation, values } = body;

  const contextData = {
    website: website?.trim() || "",
    sector: sector?.trim() || "",
    presentation: presentation?.trim() || "",
    values: values?.trim() || "",
  };

  const now = new Date();
  await db
    .insert(systemSettings)
    .values({ key: "org_context", value: contextData, updatedAt: now })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: contextData, updatedAt: now },
    });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Créer le composant step-context**

Formulaire avec les champs : site web, secteur d'activité (input avec datalist de suggestions), présentation (textarea), valeurs/mission (textarea). Boutons « Passer » et « Suivant ».

```typescript
// src/components/setup/step-context.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, SkipForward, Briefcase } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

const SECTORS = [
  "Agriculture",
  "Artisanat",
  "Association",
  "BTP / Construction",
  "Commerce / Distribution",
  "Communication / Média",
  "Conseil",
  "Culture / Loisirs",
  "Éducation / Formation",
  "Énergie / Environnement",
  "Finance / Assurance",
  "Immobilier",
  "Industrie / Fabrication",
  "Informatique / Numérique",
  "Juridique",
  "Logistique / Transport",
  "Recherche / Science",
  "Santé / Social",
  "Services aux entreprises",
  "Tourisme / Hôtellerie",
];

interface StepContextProps {
  data: SetupData;
  onUpdate: (context: SetupData["context"]) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepContext({ data, onUpdate, onNext, onSkip }: StepContextProps) {
  const [website, setWebsite] = useState(data.context.website);
  const [sector, setSector] = useState(data.context.sector);
  const [presentation, setPresentation] = useState(data.context.presentation);
  const [values, setValues] = useState(data.context.values);
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    setSaving(true);
    try {
      const res = await fetch("/api/setup/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website, sector, presentation, values }),
      });
      if (!res.ok) throw new Error("Erreur");

      onUpdate({ website, sector, presentation, values });
      onNext();
    } catch {
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Briefcase className="h-12 w-12 text-primary mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Contexte métier</h2>
        <p className="text-muted-foreground mt-1">
          Ces informations permettront à l'assistant IA de mieux comprendre votre activité.
          Tous les champs sont facultatifs.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ctx-website">Site web institutionnel</Label>
          <Input
            id="ctx-website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://www.monorganisation.fr"
            type="url"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctx-sector">Secteur d'activité</Label>
          <Input
            id="ctx-sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Ex : Conseil, Éducation, Santé..."
            list="sectors-list"
          />
          <datalist id="sectors-list">
            {SECTORS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctx-presentation">Présentation de l'organisation</Label>
          <textarea
            id="ctx-presentation"
            value={presentation}
            onChange={(e) => setPresentation(e.target.value)}
            placeholder="Décrivez brièvement votre organisation, ses missions..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-y"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctx-values">Valeurs et mission</Label>
          <textarea
            id="ctx-values"
            value={values}
            onChange={(e) => setValues(e.target.value)}
            placeholder="Les valeurs fondatrices, la mission principale..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip} className="gap-2">
          <SkipForward className="h-4 w-4" />
          Passer
        </Button>
        <Button onClick={handleNext} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Suivant
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/setup/context/route.ts src/components/setup/step-context.tsx
git commit -m "feat(setup): étape contexte métier (facultatif)"
```

---

## Task 7 : Parsing CSV utilisateurs

**Files:**
- Create: `src/lib/setup/csv-parser.ts`

- [ ] **Step 1: Créer le parser CSV**

```typescript
// src/lib/setup/csv-parser.ts

export interface CsvUser {
  nom: string;
  email: string;
  role: string;
  mot_de_passe: string;
  equipe: string;
}

export interface ParsedUser {
  name: string;
  email: string;
  role: "super_admin" | "admin" | "editor" | "viewer";
  password: string;
  team: string;
}

export interface CsvParseResult {
  users: ParsedUser[];
  errors: string[];
}

const VALID_ROLES = ["super_admin", "admin", "editor", "viewer"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export function parseCsvUsers(csvText: string): CsvParseResult {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    return { users: [], errors: ["Le fichier CSV est vide ou ne contient que l'en-tête"] };
  }

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const nomIdx = header.indexOf("nom");
  const emailIdx = header.indexOf("email");
  const roleIdx = header.indexOf("role");
  const pwdIdx = header.indexOf("mot_de_passe");
  const teamIdx = header.indexOf("equipe");

  if (nomIdx === -1 || emailIdx === -1) {
    return { users: [], errors: ["Colonnes obligatoires manquantes : nom, email"] };
  }

  const users: ParsedUser[] = [];
  const errors: string[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(",").map((c) => c.trim());
    const nom = cols[nomIdx] || "";
    const email = (cols[emailIdx] || "").toLowerCase();
    const role = (roleIdx >= 0 ? cols[roleIdx] : "") || "editor";
    const pwd = pwdIdx >= 0 ? cols[pwdIdx] || "" : "";
    const team = teamIdx >= 0 ? cols[teamIdx] || "" : "";

    if (!nom) {
      errors.push(`Ligne ${i + 1} : nom manquant`);
      continue;
    }
    if (!email || !EMAIL_RE.test(email)) {
      errors.push(`Ligne ${i + 1} : email invalide (${email || "vide"})`);
      continue;
    }
    if (seenEmails.has(email)) {
      errors.push(`Ligne ${i + 1} : email en doublon (${email})`);
      continue;
    }
    if (!VALID_ROLES.includes(role)) {
      errors.push(`Ligne ${i + 1} : rôle invalide « ${role} » (attendu : ${VALID_ROLES.join(", ")})`);
      continue;
    }

    seenEmails.add(email);
    users.push({
      name: nom,
      email,
      role: role as ParsedUser["role"],
      password: pwd || generatePassword(),
      team,
    });
  }

  return { users, errors };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/setup/csv-parser.ts
git commit -m "feat(setup): parser CSV pour import utilisateurs"
```

---

## Task 8 : Étape 3 — Utilisateurs (super admin + manuel + CSV + LDAP)

**Files:**
- Create: `src/app/api/setup/users/route.ts`
- Create: `src/app/api/setup/users/ldap/route.ts`
- Create: `src/components/setup/step-users.tsx`

- [ ] **Step 1: Créer la route API users**

```typescript
// src/app/api/setup/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, teams, teamMembers, spaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { initRepository } from "@/lib/git/repository";
import slugify from "slugify";
import { ensurePersonalCalendar } from "@/lib/calendar/auto-provision";

interface UserInput {
  name: string;
  email: string;
  role: string;
  password: string;
  team?: string;
}

export async function POST(request: NextRequest) {
  const body: { users: UserInput[] } = await request.json();

  if (!body.users || !Array.isArray(body.users) || body.users.length === 0) {
    return NextResponse.json({ error: "Aucun utilisateur fourni" }, { status: 400 });
  }

  const createdUsers: Array<{ id: string; name: string; email: string; role: string; team?: string; generatedPassword?: string }> = [];
  const teamMap = new Map<string, string>(); // teamName → teamId

  for (const u of body.users) {
    // Vérifier doublon
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, u.email.toLowerCase()))
      .limit(1);

    if (existing) continue;

    // Hasher le mot de passe
    const hash = await bcrypt.hash(u.password, 10);

    // Créer l'utilisateur
    const [newUser] = await db
      .insert(users)
      .values({
        email: u.email.toLowerCase().trim(),
        name: u.name.trim(),
        passwordHash: hash,
        globalRole: u.role as "super_admin" | "admin" | "editor" | "viewer",
      })
      .returning({ id: users.id });

    // Créer l'espace personnel
    const slug = slugify(u.name, { lower: true, strict: true });
    const gitRepoPath = `repos/personal-${slug}`;
    await db.insert(spaces).values({
      name: `Espace de ${u.name}`,
      slug: `personal-${slug}-${newUser.id.slice(0, 8)}`,
      type: "personal",
      ownerUserId: newUser.id,
      gitRepoPath,
    });
    await initRepository(gitRepoPath);

    // Calendrier personnel
    try {
      await ensurePersonalCalendar(newUser.id, u.name);
    } catch {
      // Non bloquant
    }

    // Gérer l'équipe si renseignée
    if (u.team?.trim()) {
      const teamName = u.team.trim();
      let teamId = teamMap.get(teamName);

      if (!teamId) {
        // Chercher ou créer l'équipe
        const [existingTeam] = await db
          .select({ id: teams.id })
          .from(teams)
          .where(eq(teams.name, teamName))
          .limit(1);

        if (existingTeam) {
          teamId = existingTeam.id;
        } else {
          const [newTeam] = await db
            .insert(teams)
            .values({ name: teamName, createdBy: newUser.id })
            .returning({ id: teams.id });
          teamId = newTeam.id;
        }
        teamMap.set(teamName, teamId);
      }

      await db.insert(teamMembers).values({
        teamId,
        userId: newUser.id,
        role: "member",
      });
    }

    createdUsers.push({
      id: newUser.id,
      name: u.name,
      email: u.email,
      role: u.role,
      team: u.team,
    });
  }

  return NextResponse.json({ users: createdUsers });
}
```

- [ ] **Step 2: Créer la route API LDAP**

```typescript
// src/app/api/setup/users/ldap/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { ldapUrl, ldapBindDn, ldapBindPassword, ldapBaseDn, ldapSearchFilter, ldapNameAttribute, ldapEmailAttribute } = body;

  if (!ldapUrl) {
    return NextResponse.json({ error: "URL LDAP requise" }, { status: 400 });
  }

  // Sauvegarder la config LDAP dans system_settings
  const now = new Date();
  const ldapConfig = {
    ldapEnabled: true,
    ldapUrl,
    ldapBindDn: ldapBindDn || "",
    ldapBindPassword: ldapBindPassword || "",
    ldapBaseDn: ldapBaseDn || "",
    ldapSearchFilter: ldapSearchFilter || "(mail={{email}})",
    ldapNameAttribute: ldapNameAttribute || "cn",
    ldapEmailAttribute: ldapEmailAttribute || "mail",
    ldapRejectUnauthorized: true,
  };

  await db
    .insert(systemSettings)
    .values({ key: "ldap", value: ldapConfig, updatedAt: now })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: ldapConfig, updatedAt: now },
    });

  return NextResponse.json({ success: true, message: "Configuration LDAP sauvegardée. Les utilisateurs pourront se connecter via LDAP." });
}
```

- [ ] **Step 3: Créer le composant step-users**

Composant avec 3 sections :
1. **Super admin** (obligatoire) : nom, email, mot de passe
2. **Ajouter des utilisateurs** : onglets Manuel / CSV / LDAP
   - Manuel : formulaire inline pour ajouter un utilisateur à la fois → s'ajoute à une liste
   - CSV : zone de drop/upload + aperçu des lignes parsées + erreurs
   - LDAP : formulaire de configuration LDAP (URL, Bind DN, etc.)
3. **Liste des utilisateurs** ajoutés, avec possibilité de supprimer

Le composant est long — créer un fichier dédié avec les sous-composants inline. Appeler `POST /api/setup/users` au clic sur « Suivant » avec l'ensemble des utilisateurs (super admin inclus).

Inclure un lien de téléchargement du modèle CSV (`/templates/import-utilisateurs.csv`).

Après la création, si des mots de passe ont été générés, proposer un bouton « Télécharger les identifiants » qui génère un fichier CSV avec les colonnes `nom,email,mot_de_passe`.

- [ ] **Step 4: Tester la création du super admin + import CSV**

1. Saisir le super admin → vérifier qu'il apparaît dans la liste
2. Uploader le modèle CSV → vérifier l'aperçu
3. Cliquer « Suivant » → vérifier les utilisateurs créés en BDD

- [ ] **Step 5: Commit**

```bash
git add src/app/api/setup/users/route.ts src/app/api/setup/users/ldap/route.ts src/components/setup/step-users.tsx
git commit -m "feat(setup): étape utilisateurs (super admin + manuel + CSV + LDAP)"
```

---

## Task 9 : Étape 4 — Espaces

**Files:**
- Create: `src/app/api/setup/spaces/route.ts`
- Create: `src/components/setup/step-spaces.tsx`

- [ ] **Step 1: Créer la route API spaces**

```typescript
// src/app/api/setup/spaces/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import slugify from "slugify";
import { initRepository } from "@/lib/git/repository";

interface SpaceInput {
  name: string;
  description: string;
  classification: string;
  icon: string | null;
}

export async function POST(request: NextRequest) {
  const body: { spaces: SpaceInput[] } = await request.json();

  if (!body.spaces || !Array.isArray(body.spaces) || body.spaces.length === 0) {
    return NextResponse.json({ error: "Aucun espace fourni" }, { status: 400 });
  }

  const created: Array<{ id: string; name: string; slug: string; description: string; classification: string; icon: string | null }> = [];

  for (const s of body.spaces) {
    const slug = slugify(s.name, { lower: true, strict: true });
    const gitRepoPath = `repos/org-${slug}`;

    const [newSpace] = await db
      .insert(spaces)
      .values({
        name: s.name.trim(),
        slug: `${slug}-${Date.now().toString(36)}`,
        type: "organization",
        description: s.description?.trim() || null,
        classification: s.classification as "public" | "internal" | "confidential" | "secret",
        icon: s.icon,
        gitRepoPath,
      })
      .returning({
        id: spaces.id,
        name: spaces.name,
        slug: spaces.slug,
        description: spaces.description,
        classification: spaces.classification,
        icon: spaces.icon,
      });

    await initRepository(gitRepoPath);
    created.push(newSpace);
  }

  return NextResponse.json({ spaces: created });
}
```

- [ ] **Step 2: Créer le composant step-spaces**

Liste d'espaces pré-remplis (Général, Direction, Ressources humaines, Projets). Chaque ligne est modifiable (nom, description, classification, icône) et supprimable. Bouton « Ajouter un espace ». Appeler l'API au clic « Suivant ».

```typescript
// src/components/setup/step-spaces.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, Plus, Trash2, FolderOpen } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface SpaceRow {
  tempId: string;
  name: string;
  description: string;
  classification: string;
  icon: string | null;
}

const DEFAULT_SPACES: SpaceRow[] = [
  { tempId: "1", name: "Général", description: "Espace commun à toute l'organisation", classification: "internal", icon: "🏢" },
  { tempId: "2", name: "Direction", description: "Documents de direction et stratégie", classification: "confidential", icon: "👔" },
  { tempId: "3", name: "Ressources humaines", description: "Documents RH", classification: "confidential", icon: "👥" },
  { tempId: "4", name: "Projets", description: "Suivi des projets en cours", classification: "internal", icon: "📋" },
];

interface StepSpacesProps {
  data: SetupData;
  onUpdate: (spaces: SetupData["spaces"]) => void;
  onNext: () => void;
}

export function StepSpaces({ data, onUpdate, onNext }: StepSpacesProps) {
  const [rows, setRows] = useState<SpaceRow[]>(
    data.spaces.length > 0
      ? data.spaces.map((s) => ({ tempId: s.id, name: s.name, description: s.description, classification: s.classification, icon: s.icon }))
      : DEFAULT_SPACES
  );
  const [saving, setSaving] = useState(false);

  function addRow() {
    setRows((prev) => [
      ...prev,
      { tempId: String(Date.now()), name: "", description: "", classification: "internal", icon: null },
    ]);
  }

  function removeRow(tempId: string) {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  }

  function updateRow(tempId: string, field: keyof SpaceRow, value: string | null) {
    setRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, [field]: value } : r))
    );
  }

  async function handleNext() {
    const validRows = rows.filter((r) => r.name.trim());
    if (validRows.length === 0) {
      alert("Créez au moins un espace");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/setup/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaces: validRows.map((r) => ({
            name: r.name,
            description: r.description,
            classification: r.classification,
            icon: r.icon,
          })),
        }),
      });

      if (!res.ok) throw new Error("Erreur");
      const result = await res.json();

      onUpdate(
        result.spaces.map((s: { id: string; name: string; slug: string; description: string; classification: string; icon: string | null }) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          description: s.description || "",
          classification: s.classification,
          icon: s.icon,
        }))
      );
      onNext();
    } catch {
      alert("Erreur lors de la création des espaces");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <FolderOpen className="h-12 w-12 text-primary mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Espaces de travail</h2>
        <p className="text-muted-foreground mt-1">
          Organisez votre base de connaissances en espaces. Vous pouvez modifier les espaces proposés ou en ajouter.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.tempId} className="flex items-start gap-2 p-3 rounded-lg border border-border">
            <div className="flex-1 space-y-2">
              <Input
                value={row.name}
                onChange={(e) => updateRow(row.tempId, "name", e.target.value)}
                placeholder="Nom de l'espace"
                className="font-medium"
              />
              <Input
                value={row.description}
                onChange={(e) => updateRow(row.tempId, "description", e.target.value)}
                placeholder="Description (facultatif)"
                className="text-sm"
              />
              <select
                value={row.classification}
                onChange={(e) => updateRow(row.tempId, "classification", e.target.value)}
                className="px-2 py-1 rounded border border-input bg-background text-xs"
              >
                <option value="public">Public</option>
                <option value="internal">Interne</option>
                <option value="confidential">Confidentiel</option>
                <option value="secret">Secret</option>
              </select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeRow(row.tempId)} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" onClick={addRow} className="gap-2 w-full">
        <Plus className="h-4 w-4" />
        Ajouter un espace
      </Button>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Suivant
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/setup/spaces/route.ts src/components/setup/step-spaces.tsx
git commit -m "feat(setup): étape espaces de travail pré-remplis"
```

---

## Task 10 : Étape 5 — Autorisations

**Files:**
- Create: `src/app/api/setup/permissions/route.ts`
- Create: `src/components/setup/step-permissions.tsx`

- [ ] **Step 1: Créer la route API permissions**

```typescript
// src/app/api/setup/permissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spacePermissions } from "@/lib/db/schema";

interface PermissionInput {
  spaceId: string;
  userId: string;
  level: "viewer" | "editor" | "admin";
}

export async function POST(request: NextRequest) {
  const body: { permissions: PermissionInput[] } = await request.json();

  if (!body.permissions || !Array.isArray(body.permissions)) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  for (const p of body.permissions) {
    await db.insert(spacePermissions).values({
      spaceId: p.spaceId,
      userId: p.userId,
      level: p.level,
    });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Créer le composant step-permissions**

Matrice visuelle : lignes = espaces (depuis `data.spaces`), colonnes = utilisateurs (depuis `data.users`). Chaque cellule est un sélecteur de niveau (aucun / lecteur / éditeur / admin). Pré-rempli avec des valeurs par défaut intelligentes. Boutons « Passer » et « Suivant ».

```typescript
// src/components/setup/step-permissions.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, SkipForward, Shield } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

type Level = "" | "viewer" | "editor" | "admin";

interface StepPermissionsProps {
  data: SetupData;
  onUpdate: (permissions: SetupData["permissions"]) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepPermissions({ data, onUpdate, onNext, onSkip }: StepPermissionsProps) {
  // Matrice : { [spaceId-userId]: level }
  const [matrix, setMatrix] = useState<Record<string, Level>>(() => {
    const m: Record<string, Level> = {};
    // Pré-remplir : tous les utilisateurs en éditeur sur tous les espaces
    for (const space of data.spaces) {
      for (const user of data.users) {
        const key = `${space.id}-${user.id}`;
        // Super admin → admin partout, autres → éditeur
        m[key] = user.role === "super_admin" || user.role === "admin" ? "admin" : "editor";
      }
    }
    return m;
  });
  const [saving, setSaving] = useState(false);

  function setLevel(spaceId: string, userId: string, level: Level) {
    setMatrix((prev) => ({ ...prev, [`${spaceId}-${userId}`]: level }));
  }

  async function handleNext() {
    const permissions: SetupData["permissions"] = [];
    for (const [key, level] of Object.entries(matrix)) {
      if (!level) continue;
      const [spaceId, userId] = key.split("-");
      permissions.push({ spaceId, userId, level });
    }

    setSaving(true);
    try {
      const res = await fetch("/api/setup/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error("Erreur");

      onUpdate(permissions);
      onNext();
    } catch {
      alert("Erreur lors de l'attribution des autorisations");
    } finally {
      setSaving(false);
    }
  }

  if (data.spaces.length === 0 || data.users.length === 0) {
    return (
      <div className="text-center space-y-4">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">
          Aucun espace ou utilisateur configuré. Vous pourrez gérer les autorisations plus tard.
        </p>
        <Button onClick={onSkip}>Continuer</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Shield className="h-12 w-12 text-primary mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Autorisations</h2>
        <p className="text-muted-foreground mt-1">
          Définissez qui accède à quoi. Vous pourrez affiner plus tard.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 border-b border-border font-medium text-muted-foreground">Espace</th>
              {data.users.map((u) => (
                <th key={u.id} className="p-2 border-b border-border font-medium text-muted-foreground text-center">
                  <div className="truncate max-w-[100px]" title={u.name}>{u.name}</div>
                  <div className="text-xs font-normal">{u.role}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.spaces.map((space) => (
              <tr key={space.id} className="border-b border-border last:border-0">
                <td className="p-2 font-medium">
                  {space.icon && <span className="mr-1">{space.icon}</span>}
                  {space.name}
                </td>
                {data.users.map((user) => {
                  const key = `${space.id}-${user.id}`;
                  return (
                    <td key={key} className="p-2 text-center">
                      <select
                        value={matrix[key] || ""}
                        onChange={(e) => setLevel(space.id, user.id, e.target.value as Level)}
                        className="px-1 py-0.5 rounded border border-input bg-background text-xs"
                      >
                        <option value="">Aucun</option>
                        <option value="viewer">Lecteur</option>
                        <option value="editor">Éditeur</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip} className="gap-2">
          <SkipForward className="h-4 w-4" />
          Passer
        </Button>
        <Button onClick={handleNext} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Suivant
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/setup/permissions/route.ts src/components/setup/step-permissions.tsx
git commit -m "feat(setup): étape autorisations (matrice espaces × utilisateurs)"
```

---

## Task 11 : Récapitulatif + finalisation

**Files:**
- Create: `src/app/api/setup/complete/route.ts`
- Create: `src/components/setup/step-summary.tsx`

- [ ] **Step 1: Créer la route API complete**

```typescript
// src/app/api/setup/complete/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";

export async function POST() {
  const now = new Date();
  await db
    .insert(systemSettings)
    .values({ key: "setup_completed", value: true, updatedAt: now })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: true, updatedAt: now },
    });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Créer le composant step-summary**

Affiche un récapitulatif de tout ce qui a été configuré : nom de l'organisation, nombre d'utilisateurs, liste des espaces, nombre de permissions. Bouton « Lancer l'application » qui appelle `POST /api/setup/complete` puis redirige vers `/`.

```typescript
// src/components/setup/step-summary.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, CheckCircle2 } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepSummaryProps {
  data: SetupData;
}

export function StepSummary({ data }: StepSummaryProps) {
  const [launching, setLaunching] = useState(false);

  async function handleLaunch() {
    setLaunching(true);
    try {
      const res = await fetch("/api/setup/complete", { method: "POST" });
      if (!res.ok) throw new Error("Erreur");
      window.location.href = "/login";
    } catch {
      alert("Erreur lors de la finalisation");
      setLaunching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Configuration terminée</h2>
        <p className="text-muted-foreground mt-1">
          Voici un récapitulatif de votre configuration.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-lg border border-border">
          <h3 className="font-medium mb-2">Organisation</h3>
          <p className="text-sm">{data.identity.name || "—"}</p>
          {data.identity.description && (
            <p className="text-sm text-muted-foreground">{data.identity.description}</p>
          )}
        </div>

        {(data.context.sector || data.context.website) && (
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-medium mb-2">Contexte métier</h3>
            {data.context.sector && <p className="text-sm">Secteur : {data.context.sector}</p>}
            {data.context.website && <p className="text-sm">Site : {data.context.website}</p>}
          </div>
        )}

        <div className="p-4 rounded-lg border border-border">
          <h3 className="font-medium mb-2">Utilisateurs</h3>
          <p className="text-sm">{data.users.length} utilisateur{data.users.length > 1 ? "s" : ""} créé{data.users.length > 1 ? "s" : ""}</p>
          <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
            {data.users.slice(0, 5).map((u) => (
              <li key={u.id}>{u.name} ({u.email}) — {u.role}</li>
            ))}
            {data.users.length > 5 && <li>... et {data.users.length - 5} autres</li>}
          </ul>
        </div>

        <div className="p-4 rounded-lg border border-border">
          <h3 className="font-medium mb-2">Espaces de travail</h3>
          <ul className="text-sm space-y-0.5">
            {data.spaces.map((s) => (
              <li key={s.id}>
                {s.icon && <span className="mr-1">{s.icon}</span>}
                {s.name} <span className="text-muted-foreground">({s.classification})</span>
              </li>
            ))}
          </ul>
        </div>

        {data.permissions.length > 0 && (
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-medium mb-2">Autorisations</h3>
            <p className="text-sm">{data.permissions.length} permission{data.permissions.length > 1 ? "s" : ""} configurée{data.permissions.length > 1 ? "s" : ""}</p>
          </div>
        )}
      </div>

      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={handleLaunch} disabled={launching} className="gap-2">
          {launching ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Finalisation...
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5" />
              Lancer l'application
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/setup/complete/route.ts src/components/setup/step-summary.tsx
git commit -m "feat(setup): récapitulatif et finalisation du wizard"
```

---

## Task 12 : Test d'intégration complet

**Files:**
- Aucun nouveau fichier

- [ ] **Step 1: Réinitialiser la BDD de dev et tester le flux complet**

```bash
npm run db:push
```

Supprimer manuellement la clé `setup_completed` de `system_settings` si elle existe :

```bash
npx tsx -e "
  const { db } = require('./src/lib/db');
  const { systemSettings } = require('./src/lib/db/schema');
  const { eq } = require('drizzle-orm');
  db.delete(systemSettings).where(eq(systemSettings.key, 'setup_completed')).then(() => console.log('OK'));
"
```

- [ ] **Step 2: Tester le flux wizard bout en bout**

1. Lancer `npm run dev`
2. Accéder à `http://localhost:3000/` → doit rediriger vers `/setup`
3. Cliquer « Configurer » → confirmer la purge
4. Saisir le nom de l'organisation → Suivant
5. Remplir ou passer le contexte métier
6. Créer le super admin + tester l'import CSV avec le modèle fourni
7. Vérifier les espaces par défaut, modifier un nom → Suivant
8. Vérifier la matrice d'autorisations → Suivant
9. Vérifier le récapitulatif → « Lancer l'application »
10. Vérifier la redirection vers `/login`
11. Se connecter avec le super admin créé

- [ ] **Step 3: Tester le scénario « Plus tard »**

1. Supprimer `setup_completed`
2. Reseed les données de démo : `npm run db:seed:demo`
3. Accéder à `/` → wizard
4. Cliquer « Plus tard » → doit retourner à l'app avec les données de démo

- [ ] **Step 4: Commit final si corrections nécessaires**

```bash
git add -A
git commit -m "fix(setup): corrections suite au test d'intégration"
```
