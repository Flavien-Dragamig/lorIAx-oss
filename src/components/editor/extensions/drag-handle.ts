import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";

const dragHandleKey = new PluginKey("dragHandle");

export const DragHandle = Extension.create({
  name: "dragHandle",

  addProseMirrorPlugins() {
    let dragHandleEl: HTMLElement | null = null;
    let hoveredPos: number | null = null;

    const createDragHandle = () => {
      const el = document.createElement("div");
      el.className = "drag-handle";
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
      el.draggable = true;
      el.style.display = "none";
      document.body.appendChild(el);
      return el;
    };

    return [
      new Plugin({
        key: dragHandleKey,

        view(editorView) {
          dragHandleEl = createDragHandle();

          const handleMouseMove = (event: MouseEvent) => {
            if (!dragHandleEl) return;

            const editorRect = editorView.dom.getBoundingClientRect();
            const pos = editorView.posAtCoords({
              left: editorRect.left + 20,
              top: event.clientY,
            });

            if (!pos) {
              dragHandleEl.style.display = "none";
              hoveredPos = null;
              return;
            }

            // Trouver le nœud bloc le plus proche
            const $pos = editorView.state.doc.resolve(pos.pos);
            const node = $pos.node($pos.depth);

            // Ne pas afficher pour les nœuds inline ou le doc lui-même
            if (!node || $pos.depth === 0) {
              dragHandleEl.style.display = "none";
              hoveredPos = null;
              return;
            }

            // Position du début du bloc
            const blockPos = $pos.before($pos.depth);
            hoveredPos = blockPos;

            // Trouver l'élément DOM du bloc
            const domNode = editorView.nodeDOM(blockPos);
            if (!domNode || !(domNode instanceof HTMLElement)) {
              dragHandleEl.style.display = "none";
              return;
            }

            const nodeRect = domNode.getBoundingClientRect();

            dragHandleEl.style.display = "flex";
            dragHandleEl.style.position = "fixed";
            dragHandleEl.style.left = `${editorRect.left - 4}px`;
            dragHandleEl.style.top = `${nodeRect.top + 2}px`;
          };

          const handleMouseLeave = () => {
            if (dragHandleEl) {
              dragHandleEl.style.display = "none";
              hoveredPos = null;
            }
          };

          const handleDragStart = (event: DragEvent) => {
            if (hoveredPos === null) return;

            const { state, dispatch } = editorView;
            const nodeSelection = NodeSelection.create(state.doc, hoveredPos);
            dispatch(state.tr.setSelection(nodeSelection));

            // Laisser ProseMirror gérer le drag natif
            editorView.dragging = {
              slice: nodeSelection.content(),
              move: true,
            };

            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = "move";
              const domNode = editorView.nodeDOM(hoveredPos);
              if (domNode instanceof HTMLElement) {
                event.dataTransfer.setDragImage(domNode, 0, 0);
              }
            }
          };

          editorView.dom.addEventListener("mousemove", handleMouseMove);
          editorView.dom.addEventListener("mouseleave", handleMouseLeave);
          dragHandleEl.addEventListener("dragstart", handleDragStart);

          return {
            destroy() {
              editorView.dom.removeEventListener("mousemove", handleMouseMove);
              editorView.dom.removeEventListener(
                "mouseleave",
                handleMouseLeave
              );
              if (dragHandleEl) {
                dragHandleEl.removeEventListener("dragstart", handleDragStart);
                dragHandleEl.remove();
                dragHandleEl = null;
              }
            },
          };
        },
      }),
    ];
  },
});
