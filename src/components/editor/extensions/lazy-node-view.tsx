"use client";

import { lazy, Suspense, type ComponentType } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { EditorBlockErrorBoundary } from "../editor-error-boundary";

export function createLazyNodeView(
  importFn: () => Promise<{ default: ComponentType<NodeViewProps> }>,
  blockType?: string
) {
  const LazyComponent = lazy(importFn);
  return function LazyNodeView(props: NodeViewProps) {
    return (
      <NodeViewWrapper>
        <EditorBlockErrorBoundary blockType={blockType}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-32 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Chargement...
                </div>
              </div>
            }
          >
            <LazyComponent {...props} />
          </Suspense>
        </EditorBlockErrorBoundary>
      </NodeViewWrapper>
    );
  };
}
