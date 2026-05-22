"use client";

import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionOptions, type SuggestionProps, type SuggestionKeyDownProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SuggestionListRef } from "@/types/editor";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DocumentSuggestion {
  id: string;
  title: string;
  spaceSlug: string;
  spaceName: string;
}

// ─── Node View (rendu du wiki-link dans l'éditeur) ─────────────────────────

function WikiLinkView({ node }: Pick<NodeViewProps, "node">) {
  const router = useRouter();
  const target = node.attrs.target as string;
  const label = (node.attrs.label as string) || target;
  const spaceSlug = node.attrs.spaceSlug as string;
  const docId = node.attrs.docId as string;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (spaceSlug && docId) {
      router.push(`/s/${spaceSlug}/${docId}`);
    }
  }

  return (
    <NodeViewWrapper as="span" className="wiki-link-wrapper">
      <a
        href={spaceSlug && docId ? `/s/${spaceSlug}/${docId}` : "#"}
        onClick={handleClick}
        className="wiki-link text-primary hover:underline cursor-pointer font-medium"
        title={`Lien vers : ${target}`}
      >
        {label}
      </a>
    </NodeViewWrapper>
  );
}

// ─── Extension TipTap : WikiLink Node ──────────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attrs: {
        target: string;
        label?: string;
        docId?: string;
        spaceSlug?: string;
      }) => ReturnType;
    };
  }
}

export const WikiLink = Node.create({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      target: { default: "" },
      label: { default: "" },
      docId: { default: "" },
      spaceSlug: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            target: el.getAttribute("data-target") || "",
            label: el.getAttribute("data-label") || "",
            docId: el.getAttribute("data-doc-id") || "",
            spaceSlug: el.getAttribute("data-space-slug") || "",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-link": "",
        "data-target": HTMLAttributes.target,
        "data-label": HTMLAttributes.label || HTMLAttributes.target,
        "data-doc-id": HTMLAttributes.docId,
        "data-space-slug": HTMLAttributes.spaceSlug,
      }),
      HTMLAttributes.label || HTMLAttributes.target,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView);
  },

  addCommands() {
    return {
      setWikiLink:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run();
        },
    };
  },

  // Sérialisation markdown : [[target|label]]
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs: Record<string, string> }) {
          const target = node.attrs.target || "";
          const label = node.attrs.label || "";
          if (label && label !== target) {
            state.write(`[[${target}|${label}]]`);
          } else {
            state.write(`[[${target}]]`);
          }
        },
        parse: {
          // Le parsing se fait via inputRules
        },
      },
    };
  },

  addInputRules() {
    const nodeType = this.type;
    return [
      new InputRule({
        find: /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/,
        handler: ({ state, range, match }) => {
          const target = match[1]?.trim() || "";
          const label = match[2]?.trim() || target;
          const { tr } = state;

          if (target) {
            tr.replaceWith(
              range.from,
              range.to,
              nodeType.create({ target, label })
            );
          }
        },
      }),
    ];
  },
});

// ─── Suggestion List (dropdown autocomplétion) ─────────────────────────────

interface WikiLinkListProps {
  items: DocumentSuggestion[];
  command: (item: DocumentSuggestion) => void;
  query: string;
}

interface WikiLinkListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const WikiLinkList = forwardRef<WikiLinkListRef, WikiLinkListProps>(
  ({ items, command, query }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="wiki-link-menu">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            {query.length < 2
              ? "Tapez pour rechercher un document..."
              : "Aucun document trouvé"}
          </div>
        </div>
      );
    }

    return (
      <div className="wiki-link-menu">
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`wiki-link-item ${
              index === selectedIndex ? "is-selected" : ""
            }`}
            onClick={() => selectItem(index)}
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col items-start min-w-0">
              <span className="font-medium truncate w-full text-left">
                {item.title}
              </span>
              <span className="text-xs text-muted-foreground truncate w-full text-left">
                {item.spaceName}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

WikiLinkList.displayName = "WikiLinkList";

// ─── Extension Suggestion [[ ──────────────────────────────────────────────

export const WikiLinkSuggestion = Node.create({
  name: "wikiLinkSuggestion",

  addOptions() {
    return {
      suggestion: {
        char: "[[",
        allowSpaces: true,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: DocumentSuggestion;
        }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setWikiLink({
              target: props.title,
              label: props.title,
              docId: props.id,
              spaceSlug: props.spaceSlug,
            })
            .run();
        },
      } as Partial<SuggestionOptions<DocumentSuggestion>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey("wikiLinkSuggestion"),
        editor: this.editor,
        ...this.options.suggestion,
        items: async ({ query }: { query: string }) => {
          if (query.length < 2) return [];

          try {
            const res = await fetch(
              `/api/search?q=${encodeURIComponent(query)}&limit=8`
            );
            const data = await res.json();

            return (data.results || []).map(
              (r: { id: string; title: string; spaceSlug: string; spaceName: string }): DocumentSuggestion => ({
                id: r.id,
                title: r.title,
                spaceSlug: r.spaceSlug,
                spaceName: r.spaceName,
              })
            );
          } catch {
            return [];
          }
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: TippyInstance | null = null;

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(WikiLinkList, {
                props: { ...props, query: props.query || "" },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy(document.body, {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              }) as unknown as TippyInstance;
            },
            onUpdate(props: SuggestionProps) {
              component?.updateProps({
                ...props,
                query: props.query || "",
              });
              if (props.clientRect) {
                popup?.setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              }
            },
            onKeyDown(props: SuggestionKeyDownProps) {
              if (props.event.key === "Escape") {
                popup?.hide();
                return true;
              }
              const ref = component?.ref as SuggestionListRef | null;
              return ref?.onKeyDown?.(props) || false;
            },
            onExit() {
              popup?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
