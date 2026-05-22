import type { ExternalProvider, ExternalColumn, ExternalRow } from "../base";

const AIRTABLE_API = "https://api.airtable.com/v0";

// Mapping types Airtable → LorIAx
const TYPE_MAP: Record<string, ExternalColumn["loriaxType"]> = {
  singleLineText: "text",
  multilineText: "text",
  email: "email",
  url: "url",
  phoneNumber: "text",
  richText: "text",
  number: "number",
  currency: "number",
  percent: "number",
  duration: "number",
  rating: "number",
  date: "date",
  dateTime: "date",
  singleSelect: "select",
  multipleSelects: "select",
  checkbox: "checkbox",
  multipleRecordLinks: "relation",
  attachment: "attachment",
  button: "url",
  singleCollaborator: "text",
  multipleCollaborators: "text",
  foreignKey: "relation",
  aiText: "text",
  ai: "text",
  time: "time",
  syncSource: "text",
  externalSyncSource: "text",
  // Types en lecture seule
  formula: "text",
  rollup: "text",
  lookup: "text",
  count: "number",
  autoNumber: "number",
  createdTime: "date",
  lastModifiedTime: "date",
  createdBy: "text",
  lastModifiedBy: "text",
};

async function airtableFetch(
  path: string,
  token: string,
  options?: RequestInit
): Promise<unknown> {
  const res = await fetch(`${AIRTABLE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Parse un externalId Airtable au format "baseId/tableId"
 */
function parseExternalId(externalId: string) {
  const [baseId, tableId] = externalId.split("/");
  if (!baseId || !tableId) throw new Error("Format externalId invalide (attendu: baseId/tableId)");
  return { baseId, tableId };
}

/** Convertit des secondes depuis minuit en "HH:MM" */
function _secondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Convertit "HH:MM" en secondes depuis minuit */
function _timeToSeconds(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h || 0) * 3600) + ((m || 0) * 60);
}

export const airtableProvider: ExternalProvider = {
  async fetchSchema(externalId, credentials) {
    const { baseId, tableId } = parseExternalId(externalId);
    const data = (await airtableFetch(
      `/meta/bases/${baseId}/tables`,
      credentials
    )) as { tables: { id: string; name: string; fields: { id: string; name: string; type: string; options?: { choices?: { name: string }[] } }[] }[] };

    const table = data.tables.find((t) => t.id === tableId || t.name === tableId);
    if (!table) throw new Error(`Table "${tableId}" introuvable dans la base Airtable`);

    return table.fields.map((f) => ({
      externalId: f.id,
      name: f.name,
      type: f.type,
      loriaxType: TYPE_MAP[f.type] || "text",
      options: f.options?.choices?.map((c) => c.name),
      config: f.type === "multipleSelects" ? { multiple: true } : undefined,
    }));
  },

  async fetchRows(externalId, credentials) {
    const { baseId, tableId } = parseExternalId(externalId);
    const rows: ExternalRow[] = [];
    let offset: string | undefined;

    do {
      const params = offset ? `?offset=${offset}` : "";
      const data = (await airtableFetch(
        `/${baseId}/${tableId}${params}`,
        credentials
      )) as { records: { id: string; fields: Record<string, unknown>; createdTime: string }[]; offset?: string };

      for (const rec of data.records) {
        rows.push({
          externalId: rec.id,
          cells: rec.fields,
          lastModified: rec.createdTime,
        });
      }
      offset = data.offset;
    } while (offset);

    return rows;
  },

  async createRows(externalId, credentials, rows) {
    const { baseId, tableId } = parseExternalId(externalId);
    const results: { externalId: string }[] = [];

    // Airtable limite à 10 records par requête
    for (let i = 0; i < rows.length; i += 10) {
      const batch = rows.slice(i, i + 10);
      const data = (await airtableFetch(`/${baseId}/${tableId}`, credentials, {
        method: "POST",
        body: JSON.stringify({
          records: batch.map((r) => ({ fields: r.cells })),
        }),
      })) as { records: { id: string }[] };

      for (const rec of data.records) {
        results.push({ externalId: rec.id });
      }
    }

    return results;
  },

  async updateRows(externalId, credentials, rows) {
    const { baseId, tableId } = parseExternalId(externalId);

    for (let i = 0; i < rows.length; i += 10) {
      const batch = rows.slice(i, i + 10);
      await airtableFetch(`/${baseId}/${tableId}`, credentials, {
        method: "PATCH",
        body: JSON.stringify({
          records: batch.map((r) => ({
            id: r.externalRowId,
            fields: r.cells,
          })),
        }),
      });
    }
  },

  async deleteRows(externalId, credentials, externalRowIds) {
    const { baseId, tableId } = parseExternalId(externalId);

    for (let i = 0; i < externalRowIds.length; i += 10) {
      const batch = externalRowIds.slice(i, i + 10);
      const params = batch.map((id) => `records[]=${id}`).join("&");
      await airtableFetch(`/${baseId}/${tableId}?${params}`, credentials, {
        method: "DELETE",
      });
    }
  },
};
