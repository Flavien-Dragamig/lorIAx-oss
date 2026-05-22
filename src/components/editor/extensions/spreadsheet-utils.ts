// Utilitaires partagés entre spreadsheet-modal et spreadsheet-block

export interface ChartDataRow {
  [key: string]: string | number;
}

export function colLetterToIndex(letters: string): number {
  return letters.toUpperCase().split("").reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

export function parseRange(range: string): { startRow: number; endRow: number; startCol: number; endCol: number } | null {
  const m = range.trim().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return {
    startCol: colLetterToIndex(m[1]),
    startRow: parseInt(m[2]) - 1,
    endCol: colLetterToIndex(m[3]),
    endRow: parseInt(m[4]) - 1,
  };
}

export function extractChartData(
  snapshot: Record<string, unknown> | null,
  range: string
): { data: ChartDataRow[]; columns: string[]; labelKey: string } | null {
  if (!snapshot?.sheets) return null;
  const parsed = parseRange(range);
  if (!parsed) return null;

  const { startRow, endRow, startCol, endCol } = parsed;
  if (endRow <= startRow || endCol < startCol) return null;

  const sheet = Object.values(snapshot.sheets as Record<string, unknown>)[0] as Record<string, unknown>;
  const cellData = (sheet?.cellData ?? {}) as Record<number, Record<number, { v?: unknown }>>;

  const getCellValue = (r: number, c: number): string | number => {
    const v = cellData[r]?.[c]?.v;
    if (v === null || v === undefined) return "";
    return typeof v === "number" ? v : String(v);
  };

  const headers: string[] = [];
  for (let c = startCol; c <= endCol; c++) {
    const val = getCellValue(startRow, c);
    headers.push(String(val) || `Col${c - startCol + 1}`);
  }

  const rows: ChartDataRow[] = [];
  for (let r = startRow + 1; r <= endRow; r++) {
    const row: ChartDataRow = {};
    for (let c = startCol; c <= endCol; c++) {
      row[headers[c - startCol]] = getCellValue(r, c);
    }
    rows.push(row);
  }

  if (rows.length === 0) return null;

  return { data: rows, columns: headers, labelKey: headers[0] };
}
