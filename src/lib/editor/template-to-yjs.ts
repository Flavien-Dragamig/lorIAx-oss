import * as Y from "yjs";

interface TemplateDatabase {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    config?: Record<string, unknown>;
  }>;
}

interface TemplateContent {
  markdown?: string;
  database?: TemplateDatabase;
}

/**
 * Construit un fragment Yjs (XmlFragment "default") à partir de markdown.
 * Supporte : # h1, ## h2, ### h3, paragraphes, listes - (basique).
 * Utilisé uniquement côté serveur pour initialiser le contenu d'un nouveau document.
 */
function markdownToXmlFragment(markdown: string, fragment: Y.XmlFragment): void {
  const nodes: Array<Y.XmlElement> = [];
  // Blocs séparés par une ligne vide
  const blocks = markdown.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const h3 = line.match(/^### (.+)$/);
      const h2 = line.match(/^## (.+)$/);
      const h1 = line.match(/^# (.+)$/);
      const li = line.match(/^[-*] (.+)$/);

      if (h1 || h2 || h3) {
        const level = h1 ? 1 : h2 ? 2 : 3;
        const text = (h1 || h2 || h3)![1];
        const el = new Y.XmlElement("heading");
        el.setAttribute("level", String(level));
        const yText = new Y.XmlText();
        yText.applyDelta([{ insert: text }]);
        el.insert(0, [yText]);
        nodes.push(el);
      } else if (li) {
        const el = new Y.XmlElement("listItem");
        const para = new Y.XmlElement("paragraph");
        const yText = new Y.XmlText();
        yText.applyDelta([{ insert: li[1] }]);
        para.insert(0, [yText]);
        el.insert(0, [para]);
        nodes.push(el);
      } else {
        const el = new Y.XmlElement("paragraph");
        const yText = new Y.XmlText();
        yText.applyDelta([{ insert: line }]);
        el.insert(0, [yText]);
        nodes.push(el);
      }
    }
  }

  if (nodes.length > 0) {
    fragment.insert(0, nodes);
  }
}

/**
 * Convertit un contenu de template (markdown + optionnel: databaseBlock) en état Yjs binaire.
 * Retourne null si le contenu est vide.
 */
export function templateContentToYjsState(
  content: TemplateContent,
  databaseId?: string
): Uint8Array | null {
  if (!content.markdown && !content.database) return null;

  const ydoc = new Y.Doc();
  const fragment = ydoc.getXmlFragment("default");

  if (content.markdown) {
    markdownToXmlFragment(content.markdown, fragment);
  }

  if (content.database && databaseId) {
    const dbBlock = new Y.XmlElement("databaseBlock");
    dbBlock.setAttribute("databaseId", databaseId);
    dbBlock.setAttribute("databaseName", content.database.name);
    dbBlock.setAttribute("viewMode", "table");
    fragment.insert(fragment.length, [dbBlock]);
  }

  const state = Y.encodeStateAsUpdate(ydoc);
  ydoc.destroy();
  return state;
}
