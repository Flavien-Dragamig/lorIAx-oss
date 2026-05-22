/**
 * Couche de conversion bidirectionnelle Fortune Sheet ↔ Univer.
 * Ce fichier n'importe aucun package @univerjs/* (chargement dynamique dans le composant).
 */

// ---------------------------------------------------------------------------
// Types locaux (sous-ensemble des interfaces Fortune Sheet / Univer)
// ---------------------------------------------------------------------------

interface FortuneCellValue {
  v?: unknown;
  f?: string;
  ct?: { t?: string };
  bl?: number;
  it?: number;
  fs?: number;
  ff?: number;
  fc?: string;
  bg?: string;
  ht?: number;
  vt?: number;
  un?: number;
  cl?: number;
}

interface FortuneCellEntry {
  r: number;
  c: number;
  v: FortuneCellValue | null;
}

interface FortuneSheet {
  name?: string;
  celldata?: FortuneCellEntry[];
  row?: number;
  column?: number;
  status?: number;
  config?: {
    merge?: Record<string, { r: number; c: number; rs: number; cs: number }>;
    rowlen?: Record<string, number>;
    columnlen?: Record<string, number>;
  };
}

// Map des polices Fortune Sheet (index → nom)
const FORTUNE_FONT_MAP: Record<number, string> = {
  0: "Times New Roman",
  1: "Arial",
  2: "Tahoma",
  3: "Verdana",
};

// Map du type de cellule Fortune Sheet → Univer
const CELL_TYPE_MAP: Record<string, number> = {
  n: 2, // number
  s: 1, // string
  b: 3, // boolean
};

// ---------------------------------------------------------------------------
// Utilitaire : hash JSON pour déduplication des styles
// ---------------------------------------------------------------------------

function hashStyle(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

// ---------------------------------------------------------------------------
// Conversion d'un style inline Fortune Sheet → objet style Univer
// ---------------------------------------------------------------------------

function extractStyle(v: FortuneCellValue): Record<string, unknown> | null {
  const style: Record<string, unknown> = {};

  if (v.bl !== undefined) style.bl = v.bl; // bold
  if (v.it !== undefined) style.it = v.it; // italic
  if (v.un !== undefined) style.ul = { s: v.un }; // underline
  if (v.cl !== undefined) style.st = { s: v.cl }; // strikethrough
  if (v.fs !== undefined) style.fs = v.fs; // font size
  if (v.fc !== undefined) style.cl = { rgb: v.fc }; // font color
  if (v.bg !== undefined) style.bg = { rgb: v.bg }; // background
  if (v.ht !== undefined) style.ht = v.ht; // horizontal align
  if (v.vt !== undefined) style.vt = v.vt; // vertical align

  // Police : index Fortune → nom string Univer
  if (v.ff !== undefined) {
    style.ff = FORTUNE_FONT_MAP[v.ff as number] ?? "Arial";
  }

  return Object.keys(style).length > 0 ? style : null;
}

// ---------------------------------------------------------------------------
// fortuneSheetsToWorkbookData
// ---------------------------------------------------------------------------

export function fortuneSheetsToWorkbookData(sheets: FortuneSheet[]): Record<string, unknown> {
  const workbookId = crypto.randomUUID();
  const sheetOrder: string[] = [];
  const sheetsRecord: Record<string, unknown> = {};
  const globalStyles: Record<string, Record<string, unknown>> = {}; // hash → style object
  const styleIndex: Map<string, string> = new Map(); // hash → styleId

  function getStyleId(style: Record<string, unknown>): string {
    const hash = hashStyle(style);
    if (styleIndex.has(hash)) {
      return styleIndex.get(hash)!;
    }
    const id = `s${styleIndex.size}`;
    styleIndex.set(hash, id);
    globalStyles[id] = style;
    return id;
  }

  // Feuille par défaut si le tableau est vide
  if (sheets.length === 0) {
    const sheetId = workbookId + "_sheet1";
    sheetOrder.push(sheetId);
    sheetsRecord[sheetId] = {
      id: sheetId,
      name: "Feuille 1",
      cellData: {},
      rowCount: 30,
      columnCount: 20,
      defaultColumnWidth: 100,
      defaultRowHeight: 24,
      defaultStyle: { ff: "Arial", fs: 10 },
      mergeData: [],
      rowData: {},
      columnData: {},
    };

    return {
      id: workbookId,
      name: "Classeur",
      appVersion: "0.2.0",
      locale: "fr-FR",
      styles: {},
      sheetOrder,
      sheets: sheetsRecord,
    };
  }

  for (const fortune of sheets) {
    const sheetId = crypto.randomUUID();
    sheetOrder.push(sheetId);

    // celldata (plat) → cellData (map 2D)
    const cellData: Record<number, Record<number, Record<string, unknown>>> = {};

    for (const entry of fortune.celldata ?? []) {
      const { r, c, v } = entry;
      if (v === null || v === undefined) continue;

      const cellObj: Record<string, unknown> = {};

      // Valeur
      if (v.v !== undefined && v.v !== null) cellObj.v = v.v;

      // Formule
      if (v.f) cellObj.f = v.f;

      // Type de cellule
      if (v.ct?.t) {
        const mapped = CELL_TYPE_MAP[v.ct.t];
        if (mapped !== undefined) cellObj.t = mapped;
      }

      // Style
      const style = extractStyle(v);
      if (style) {
        cellObj.s = getStyleId(style);
      }

      if (!cellData[r]) cellData[r] = {};
      cellData[r][c] = cellObj;
    }

    // Merges
    const mergeData: unknown[] = [];
    const merge = fortune.config?.merge ?? {};
    for (const key of Object.keys(merge)) {
      const m = merge[key];
      mergeData.push({
        startRow: m.r,
        startColumn: m.c,
        endRow: m.r + m.rs - 1,
        endColumn: m.c + m.cs - 1,
      });
    }

    // Dimensions de lignes
    const rowData: Record<number, { h: number }> = {};
    const rowlen = fortune.config?.rowlen ?? {};
    for (const [n, h] of Object.entries(rowlen)) {
      rowData[Number(n)] = { h };
    }

    // Dimensions de colonnes
    const columnData: Record<number, { w: number }> = {};
    const columnlen = fortune.config?.columnlen ?? {};
    for (const [n, w] of Object.entries(columnlen)) {
      columnData[Number(n)] = { w };
    }

    sheetsRecord[sheetId] = {
      id: sheetId,
      name: fortune.name ?? "Feuille 1",
      cellData,
      rowCount: fortune.row ?? 30,
      columnCount: fortune.column ?? 20,
      defaultColumnWidth: 100,
      defaultRowHeight: 24,
      defaultStyle: { ff: "Arial", fs: 10 },
      mergeData,
      rowData,
      columnData,
    };
  }

  return {
    id: workbookId,
    name: "Classeur",
    appVersion: "0.2.0",
    locale: "fr-FR",
    styles: globalStyles,
    sheetOrder,
    sheets: sheetsRecord,
  };
}

// ---------------------------------------------------------------------------
// isWorkbookData — détection de format (Univer = objet avec clé "sheets")
// ---------------------------------------------------------------------------

export function isWorkbookData(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    "sheets" in (data as object)
  );
}
