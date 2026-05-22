"use client";

import { Extension } from "@tiptap/core";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";

export interface EditorContextStorage {
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
}

export const EditorContext = Extension.create<object, EditorContextStorage>({
  name: "editorContext",

  addStorage() {
    return {
      ydoc: null,
      provider: null,
    };
  },
});
