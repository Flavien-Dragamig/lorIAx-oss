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
          onSkip={async () => {
            await fetch("/api/setup/skip", { method: "POST" });
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
          onBack={() => nextStep("identity")}
        />
      )}
      {step === "users" && (
        <StepUsers
          data={data}
          onUpdate={(users) => updateData({ users })}
          onNext={() => nextStep("spaces")}
          onBack={() => nextStep("context")}
        />
      )}
      {step === "spaces" && (
        <StepSpaces
          data={data}
          onUpdate={(spaces) => updateData({ spaces })}
          onNext={() => nextStep("permissions")}
          onBack={() => nextStep("users")}
        />
      )}
      {step === "permissions" && (
        <StepPermissions
          data={data}
          onUpdate={(permissions) => updateData({ permissions })}
          onNext={() => nextStep("summary")}
          onSkip={() => nextStep("summary")}
          onBack={() => nextStep("spaces")}
        />
      )}
      {step === "summary" && (
        <StepSummary data={data} onBack={() => nextStep("permissions")} />
      )}
    </div>
  );
}
