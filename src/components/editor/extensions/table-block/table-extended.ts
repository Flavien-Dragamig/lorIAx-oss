import { Table } from "@tiptap/extension-table";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TableBlockView } from "./table-block-view";

export const TableExtended = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tablePreset: {
        default: "default",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-table-preset") || "default",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-table-preset": attributes.tablePreset || "default",
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableBlockView, {
      contentDOMElementTag: "div",
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest(
          "button, select, [role='button'], .table-block-toolbar, .table-block-add-col, .table-block-add-row"
        );
      },
    });
  },
});
