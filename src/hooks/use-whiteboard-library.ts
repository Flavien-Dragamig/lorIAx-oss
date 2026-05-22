"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const BUNDLED_FILES = [
  "architecture",
  "basic-shapes",
  "bubbles",
  "canvases",
  "decision-flow-control",
  "icons",
  "lo-fi-wireframing-kit",
  "post-it",
  "scrum-board",
];

const SAVE_DEBOUNCE_MS = 2000;

interface LibraryItem {
  id: string;
  status: "published" | "unpublished";
  elements: unknown[];
  [key: string]: unknown;
}

interface ExcalidrawLibFile {
  libraryItems?: LibraryItem[];
}

async function fetchBundledLibraries(): Promise<LibraryItem[]> {
  const results = await Promise.allSettled(
    BUNDLED_FILES.map((name) =>
      fetch(`/excalidraw-libraries/${name}.excalidrawlib`)
        .then((r) => r.json() as Promise<ExcalidrawLibFile>)
        .then((data) => data.libraryItems ?? [])
    )
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function fetchPersonalItems(): Promise<LibraryItem[]> {
  const res = await fetch("/api/whiteboard/library");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export function useWhiteboardLibrary() {
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const bundledIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([fetchBundledLibraries(), fetchPersonalItems()])
      .then(([bundled, personal]) => {
        bundledIdsRef.current = new Set(bundled.map((item) => item.id));

        // Déduplication : les items personnels priment sur bundled si même id
        const personalIds = new Set(personal.map((item) => item.id));
        const filteredBundled = bundled.filter((item) => !personalIds.has(item.id));

        setLibraryItems([...filteredBundled, ...personal]);
        setIsLoaded(true);
      })
      .catch(() => {
        setIsLoaded(true);
      });

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const onLibraryChange = useCallback((items: LibraryItem[]) => {
    // Filtrer uniquement les items personnels (non bundlés)
    const personalItems = items.filter(
      (item) => !bundledIdsRef.current.has(item.id)
    );

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/whiteboard/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: personalItems }),
      }).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  }, []);

  return { libraryItems, onLibraryChange, isLoaded };
}
