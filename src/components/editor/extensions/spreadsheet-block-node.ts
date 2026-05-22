import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLazyNodeView } from "./lazy-node-view";

const LazySpreadsheetBlockView = createLazyNodeView(
  () =>
    import("./spreadsheet-block").then((m) => ({
      default: m.SpreadsheetBlockView,
    })),
  "Tableur"
);

export const SpreadsheetBlock = Node.create({
  name: "spreadsheetBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      sheetId: { default: null },
      title: { default: "Nouveau tableur" },
      rowCount: { default: 0 },
      colCount: { default: 0 },
      chartType: { default: null },
      chartRange: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="spreadsheet-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "spreadsheet-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LazySpreadsheetBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest(
          "input, button, select, textarea, [role='button']"
        );
      },
    });
  },
});
