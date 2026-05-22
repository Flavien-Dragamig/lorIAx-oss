import type { ExternalProvider, ExternalColumn, ExternalRow } from "../base";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Mapping types Notion → LorIAx
const TYPE_MAP: Record<string, ExternalColumn["loriaxType"]> = {
  title: "text",
  rich_text: "text",
  email: "email",
  url: "url",
  phone_number: "text",
  number: "number",
  date: "date",
  select: "select",
  multi_select: "select",
  checkbox: "checkbox",
  relation: "relation",
  files: "attachment",
  place: "text",
  // Types en lecture seule
  formula: "text",
  rollup: "text",
  people: "text",
  created_time: "date",
  last_edited_time: "date",
  created_by: "text",
  last_edited_by: "text",
  status: "select",
  unique_id: "text",
};

interface NotionProperty {
  id: string;
  name: string;
  type: string;
  select?: { options: { name: string }[] };
  status?: { options: { name: string }[] };
  multi_select?: { options: { name: string }[] };
}

interface NotionPage {
  id: string;
  properties: Record<string, NotionPropertyValue>;
  last_edited_time: string;
}

type NotionPropertyValue = {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  number?: number | null;
  date?: { start: string | null } | null;
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  checkbox?: boolean;
  email?: string | null;
  url?: string | null;
  phone_number?: string | null;
  relation?: { id: string }[];
  files?: { type: "file" | "external"; name: string; file?: { url: string; expiry_time: string }; external?: { url: string } }[];
  place?: { id: string } | null;
  formula?: { type: string; string?: string; number?: number; boolean?: boolean; date?: { start: string } };
  people?: { name: string }[];
  created_time?: string;
  last_edited_time?: string;
  status?: { name: string } | null;
  unique_id?: { prefix: string; number: number };
};

async function notionFetch(
  path: string,
  token: string,
  options?: RequestInit
): Promise<unknown> {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion ${res.status}: ${body}`);
  }
  return res.json();
}

/** Extraire une valeur brute d'une propriété Notion */
function extractValue(prop: NotionPropertyValue): unknown {
  switch (prop.type) {
    case "title":
      return prop.title?.map((t) => t.plain_text).join("") || "";
    case "rich_text":
      return prop.rich_text?.map((t) => t.plain_text).join("") || "";
    case "number":
      return prop.number ?? 0;
    case "date":
      return prop.date?.start || "";
    case "select":
      return prop.select?.name || "";
    case "multi_select":
      return (prop.multi_select || []).map((s) => s.name);
    case "checkbox":
      return prop.checkbox ?? false;
    case "email":
      return prop.email || "";
    case "url":
      return prop.url || "";
    case "phone_number":
      return prop.phone_number || "";
    case "relation":
      return (prop.relation || []).map((r) => r.id);
    case "formula":
      if (prop.formula?.type === "string") return prop.formula.string || "";
      if (prop.formula?.type === "number") return prop.formula.number ?? 0;
      if (prop.formula?.type === "boolean") return String(prop.formula.boolean ?? false);
      if (prop.formula?.type === "date") return prop.formula.date?.start || "";
      return "";
    case "people":
      return (prop.people || []).map((p) => p.name).join(", ");
    case "created_time":
      return prop.created_time || "";
    case "last_edited_time":
      return prop.last_edited_time || "";
    case "status":
      return prop.status?.name || "";
    case "unique_id":
      return prop.unique_id ? `${prop.unique_id.prefix}-${prop.unique_id.number}` : "";
    case "files":
      return (prop.files || []).map((f) =>
        f.type === "external"
          ? { url: f.external!.url, filename: f.name }
          : { url: f.file!.url, filename: f.name, expiry: f.file!.expiry_time }
      );
    case "place":
      return "";
    default:
      return "";
  }
}

/** Convertir une valeur LorIAx en propriété Notion */
function toNotionProperty(
  type: string,
  value: unknown
): Record<string, unknown> {
  switch (type) {
    case "title":
      return { title: [{ text: { content: String(value || "") } }] };
    case "rich_text":
      return { rich_text: [{ text: { content: String(value || "") } }] };
    case "number":
      return { number: typeof value === "number" ? value : parseFloat(String(value)) || 0 };
    case "date":
      return value ? { date: { start: String(value) } } : { date: null };
    case "select":
      return value ? { select: { name: String(value) } } : { select: null };
    case "checkbox":
      return { checkbox: Boolean(value) };
    case "email":
      return { email: value ? String(value) : null };
    case "url":
      return { url: value ? String(value) : null };
    case "phone_number":
      return { phone_number: value ? String(value) : null };
    case "relation":
      return {
        relation: Array.isArray(value)
          ? value.map((id) => ({ id: String(id) }))
          : [],
      };
    case "multi_select":
      return {
        multi_select: Array.isArray(value)
          ? value.map((v) => ({ name: String(v) }))
          : [],
      };
    default:
      return {};
  }
}

export const notionProvider: ExternalProvider = {
  async fetchSchema(externalId, credentials) {
    const data = (await notionFetch(
      `/databases/${externalId}`,
      credentials
    )) as { properties: Record<string, NotionProperty> };

    return Object.entries(data.properties).map(([name, prop]) => ({
      externalId: prop.id,
      name,
      type: prop.type,
      loriaxType: TYPE_MAP[prop.type] || "text",
      options:
        prop.select?.options?.map((o) => o.name) ||
        prop.status?.options?.map((o) => o.name) ||
        prop.multi_select?.options?.map((o) => o.name),
      config: prop.type === "multi_select" ? { multiple: true } : undefined,
    }));
  },

  async fetchRows(externalId, credentials) {
    const rows: ExternalRow[] = [];
    let startCursor: string | undefined;

    do {
      const body: Record<string, unknown> = { page_size: 100 };
      if (startCursor) body.start_cursor = startCursor;

      const data = (await notionFetch(
        `/databases/${externalId}/query`,
        credentials,
        { method: "POST", body: JSON.stringify(body) }
      )) as { results: NotionPage[]; next_cursor?: string; has_more: boolean };

      for (const page of data.results) {
        const cells: Record<string, unknown> = {};
        for (const [name, prop] of Object.entries(page.properties)) {
          cells[name] = extractValue(prop);
        }
        rows.push({
          externalId: page.id,
          cells,
          lastModified: page.last_edited_time,
        });
      }

      startCursor = data.has_more ? data.next_cursor : undefined;
    } while (startCursor);

    return rows;
  },

  async createRows(externalId, credentials, rows) {
    const results: { externalId: string }[] = [];

    // Notion : 1 page par requête, récupérer le schema pour les types
    const schema = await this.fetchSchema(externalId, credentials);
    const typeMap = new Map(schema.map((c) => [c.name, c.type]));

    for (const row of rows) {
      const properties: Record<string, Record<string, unknown>> = {};
      for (const [key, value] of Object.entries(row.cells)) {
        const notionType = typeMap.get(key);
        if (notionType) {
          properties[key] = toNotionProperty(notionType, value);
        }
      }

      const page = (await notionFetch("/pages", credentials, {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: externalId },
          properties,
        }),
      })) as { id: string };

      results.push({ externalId: page.id });
    }

    return results;
  },

  async updateRows(externalId, credentials, rows) {
    const schema = await this.fetchSchema(externalId, credentials);
    const typeMap = new Map(schema.map((c) => [c.name, c.type]));

    for (const row of rows) {
      const properties: Record<string, Record<string, unknown>> = {};
      for (const [key, value] of Object.entries(row.cells)) {
        const notionType = typeMap.get(key);
        if (notionType) {
          properties[key] = toNotionProperty(notionType, value);
        }
      }

      await notionFetch(`/pages/${row.externalRowId}`, credentials, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      });
    }
  },

  async deleteRows(_externalId, credentials, externalRowIds) {
    for (const pageId of externalRowIds) {
      await notionFetch(`/pages/${pageId}`, credentials, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      });
    }
  },
};
