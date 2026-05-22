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
