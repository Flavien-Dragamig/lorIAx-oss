"use client";

import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

interface MobileHeaderProps {
  onOpenMenu: () => void;
}

export function MobileHeader({ onOpenMenu }: MobileHeaderProps) {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4 bg-background/95 backdrop-blur-sm border-b border-border md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon-32.png"
          alt="LorIAx"
          width={24}
          height={24}
          className="rounded-sm"
        />
        <span className="text-base font-semibold tracking-tight">LorIAx</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-md hover:bg-accent text-foreground/70 hover:text-foreground transition-colors"
          title={darkMode ? "Mode clair" : "Mode sombre"}
          aria-label={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
        >
          {darkMode ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={onOpenMenu}
          className="p-2 rounded-md hover:bg-accent text-foreground/70 hover:text-foreground transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
