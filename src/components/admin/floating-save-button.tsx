"use client";

import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingSaveButtonProps {
  onClick: () => void;
  saving: boolean;
  label?: string;
}

export function FloatingSaveButton({
  onClick,
  saving,
  label = "Enregistrer",
}: FloatingSaveButtonProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={onClick}
        disabled={saving}
        size="lg"
        className="shadow-lg"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        {saving ? "Enregistrement…" : label}
      </Button>
    </div>
  );
}
