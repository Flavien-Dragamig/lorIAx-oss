"use client";

import Mention from "@tiptap/extension-mention";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Search } from "lucide-react";
import { VizHashAvatar } from "@/components/ui/vizhash-avatar";
import type { SuggestionListRef } from "@/types/editor";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserSuggestion {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

// ─── Suggestion List ────────────────────────────────────────────────────────

interface MentionListProps {
  items: UserSuggestion[];
  command: (item: { id: string; label: string }) => void;
  query: string;
}

interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command, query }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command({ id: item.id, label: item.name });
        }
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
        <div className="mention-menu">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            {query.length < 1
              ? "Tapez un nom pour mentionner..."
              : "Aucun utilisateur trouvé"}
          </div>
        </div>
      );
    }

    return (
      <div className="mention-menu">
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`mention-item ${
              index === selectedIndex ? "is-selected" : ""
            }`}
            onClick={() => selectItem(index)}
          >
            <VizHashAvatar email={item.email} size={28} className="mention-avatar" />
            <div className="flex flex-col items-start min-w-0">
              <span className="font-medium truncate w-full text-left text-sm">
                {item.name}
              </span>
              <span className="text-xs text-muted-foreground truncate w-full text-left">
                {item.email}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = "MentionList";

// ─── Mention Extension configurée ───────────────────────────────────────────

export const MentionExtension = Mention.configure({
  HTMLAttributes: {
    class: "mention",
  },
  suggestion: {
    items: async ({ query }: { query: string }) => {
      if (query.length < 1) return [];

      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}&limit=6`
        );
        return await res.json();
      } catch {
        return [];
      }
    },

    command: ({ editor, range, props }) => {
      const { state } = editor;
      const { $from } = state.selection;

      // Cherche un ancêtre taskItem
      let taskItemPos: number | null = null;
      let taskItemAttrs: Record<string, unknown> | null = null;
      for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === "taskItem") {
          taskItemPos = $from.before(depth);
          taskItemAttrs = { ...node.attrs };
          break;
        }
      }

      if (taskItemPos !== null && taskItemAttrs !== null) {
        // Dans un taskItem : supprime "@query" et assigne la tâche
        // taskItemPos < range.from donc la position ne bouge pas après la suppression
        editor.view.dispatch(
          state.tr
            .delete(range.from, range.to)
            .setNodeMarkup(taskItemPos, undefined, {
              ...taskItemAttrs,
              assigneeId: props.id,
              assigneeName: props.label,
            })
        );
      } else {
        // Hors taskItem : comportement mention standard
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: "mention", attrs: props },
            { type: "text", text: " " },
          ])
          .run();
      }
    },

    render: () => {
      let component: ReactRenderer | null = null;
      let popup: TippyInstance | null = null;

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(MentionList, {
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
  },
});
