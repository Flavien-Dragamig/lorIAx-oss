"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface ThemeContextValue {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  darkMode: false,
  toggleDarkMode: () => {},
  setDarkMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkModeState] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("loriax-theme");
    let isDark: boolean;
    if (saved === "dark") {
      isDark = true;
    } else if (saved === "light") {
      isDark = false;
    } else {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    document.documentElement.classList.toggle("dark", isDark);
    setDarkModeState(isDark);
  }, []);

  function setDarkMode(dark: boolean) {
    setDarkModeState(dark);
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("loriax-theme", dark ? "dark" : "light");
  }

  function toggleDarkMode() {
    setDarkMode(!darkMode);
  }

  return (
    <ThemeContext value={{ darkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
