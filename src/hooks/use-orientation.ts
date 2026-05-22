"use client";

import { useState, useEffect } from "react";

export type Orientation = "portrait" | "landscape";

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  useEffect(() => {
    const mql = window.matchMedia("(orientation: portrait)");
    setOrientation(mql.matches ? "portrait" : "landscape");

    function onChange(e: MediaQueryListEvent) {
      setOrientation(e.matches ? "portrait" : "landscape");
    }

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return orientation;
}
