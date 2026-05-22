"use client";

import { Extension } from "@tiptap/react";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { Editor, Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import tippy, { type Instance as TippyInstance } from "tippy.js";

import { commands, defaultAliases } from "./commands";
import { CommandList } from "./command-list";
import type { SuggestionListRef } from "@/types/editor";

// Alias custom chargés depuis l'API admin — remplacent les défauts par commande
let _customAliases: Record<string, string[]> = {};

export function setCustomAliases(aliases: Record<string, string[]>) {
  _customAliases = aliases;
}

function getEffectiveAliases(title: string): string[] {
  return _customAliases[title] ?? defaultAliases[title] ?? [];
}

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        allowSpaces: true,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SuggestionProps;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey("slashCommands"),
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
          return commands.filter(
            (item) =>
              (!isMobile || !item.desktopOnly) &&
              (item.title.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              getEffectiveAliases(item.title).some((alias) => alias.toLowerCase().includes(q)))
          );
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: TippyInstance | null = null;

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(CommandList, {
                props,
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
              component?.updateProps(props);
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
