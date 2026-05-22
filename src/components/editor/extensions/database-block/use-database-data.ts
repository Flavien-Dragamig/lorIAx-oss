import { useState, useEffect, useCallback, useMemo } from "react";
import type { DbData, DbColumn, DbRow, DbListItem, ColumnType, ColumnConfig, CellValue, SortConfig, FilterConfig } from "./types";
import { fetchJson, apiPost, apiPatch, apiDelete } from "./api";

// ─── Sort / Filter ───────────────────────────────────────────────────────────

export function applySortAndFilter(
  rows: DbRow[],
  columns: DbColumn[],
  sort: SortConfig | null,
  filters: FilterConfig[]
): DbRow[] {
  let result = [...rows];

  // Apply filters
  for (const filter of filters) {
    if (!filter.value.trim()) continue;
    const query = filter.value.toLowerCase();
    result = result.filter((row) => {
      const val = row.cells?.[filter.columnId];
      if (val == null) return false;
      return String(val).toLowerCase().includes(query);
    });
  }

  // Apply sort
  if (sort) {
    const col = columns.find((c) => c.id === sort.columnId);
    if (col) {
      result.sort((a, b) => {
        const va = a.cells?.[sort.columnId] ?? "";
        const vb = b.cells?.[sort.columnId] ?? "";
        let cmp = 0;
        if (col.type === "number") {
          cmp = (Number(va) || 0) - (Number(vb) || 0);
        } else if (col.type === "checkbox") {
          cmp = (va ? 1 : 0) - (vb ? 1 : 0);
        } else {
          cmp = String(va).localeCompare(String(vb), "fr");
        }
        return sort.direction === "desc" ? -cmp : cmp;
      });
    }
  }

  return result;
}

// ─── Custom Hook: useDatabaseData ────────────────────────────────────────────

export function useDatabaseData(data: DbData, spaceId: string, onRefresh: () => void) {
  const [localCells, setLocalCells] = useState<Record<string, Record<string, CellValue>>>({});
  const { columns } = data;
  const rows = useMemo(() => data.rows.map((row) => {
    const overrides = localCells[row.id];
    if (!overrides) return row;
    return { ...row, cells: { ...row.cells, ...overrides } };
  }), [data.rows, localCells]);

  useEffect(() => { setLocalCells({}); }, [data.rows]);

  const [allDatabases, setAllDatabases] = useState<DbListItem[]>([]);
  const [relationData, setRelationData] = useState<
    Record<string, { rows: DbRow[]; columns: DbColumn[] }>
  >({});
  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Fetch all databases in this space (for relation config)
  useEffect(() => {
    if (!spaceId) return;
    fetchJson<DbListItem[]>(`/api/databases?spaceId=${spaceId}`)
      .then(setAllDatabases)
      .catch(() => setAllDatabases([]));
  }, [spaceId]);

  // Collect all unique targetDatabaseIds from relation columns
  const targetDbIdsKey = useMemo(() => {
    const ids: string[] = [];
    for (const col of columns) {
      if (col.type === "relation" && col.config?.targetDatabaseId) {
        if (!ids.includes(col.config.targetDatabaseId)) {
          ids.push(col.config.targetDatabaseId);
        }
      }
    }
    return ids.sort().join(",");
  }, [columns]);

  // Fetch target database rows and columns
  useEffect(() => {
    if (!targetDbIdsKey) return;
    const ids = targetDbIdsKey.split(",");

    Promise.all(
      ids.map(async (dbId) => {
        try {
          const result = await fetchJson<DbData>(`/api/databases/${dbId}`);
          return [dbId, { rows: result.rows, columns: result.columns }] as const;
        } catch {
          return [dbId, { rows: [] as DbRow[], columns: [] as DbColumn[] }] as const;
        }
      })
    ).then((results) => {
      const map: Record<string, { rows: DbRow[]; columns: DbColumn[] }> = {};
      for (const [id, val] of results) {
        map[id] = val;
      }
      setRelationData(map);
    });
  }, [targetDbIdsKey]);

  const updateCell = useCallback(
    async (rowId: string, columnId: string, value: CellValue) => {
      setLocalCells((prev) => ({
        ...prev,
        [rowId]: { ...prev[rowId], [columnId]: value },
      }));
      await apiPatch(`/api/databases/${data.id}/rows`, {
        rows: [{ id: rowId, cells: { [columnId]: value } }],
      });
    },
    [data.id]
  );

  const addRow = useCallback(async () => {
    await apiPost(`/api/databases/${data.id}/rows`, { cells: {} });
    onRefresh();
  }, [data.id, onRefresh]);

  const deleteRow = useCallback(
    async (rowId: string) => {
      await apiDelete(`/api/databases/${data.id}/rows`, { rowId });
      onRefresh();
    },
    [data.id, onRefresh]
  );

  const addColumn = useCallback(
    async (name: string, type: ColumnType, config?: ColumnConfig) => {
      await apiPost(`/api/databases/${data.id}/columns`, { name, type, config });
      onRefresh();
    },
    [data.id, onRefresh]
  );

  const updateColumn = useCallback(
    async (columnId: string, updates: Partial<DbColumn>) => {
      await apiPatch(`/api/databases/${data.id}/columns`, {
        columns: [{ id: columnId, ...updates }],
      });
      onRefresh();
    },
    [data.id, onRefresh]
  );

  const deleteColumn = useCallback(
    async (columnId: string) => {
      await apiDelete(`/api/databases/${data.id}/columns`, { columnId });
      onRefresh();
    },
    [data.id, onRefresh]
  );

  function toggleSort(columnId: string) {
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, direction: "asc" };
      if (prev.direction === "asc") return { columnId, direction: "desc" };
      return null;
    });
  }

  function updateFilter(columnId: string, value: string) {
    setFilters((prev) => {
      const existing = prev.find((f) => f.columnId === columnId);
      if (existing) {
        if (!value) return prev.filter((f) => f.columnId !== columnId);
        return prev.map((f) => (f.columnId === columnId ? { ...f, value } : f));
      }
      if (!value) return prev;
      return [...prev, { columnId, value }];
    });
  }

  const filteredRows = useMemo(
    () => applySortAndFilter(rows, columns, sort, filters),
    [rows, columns, sort, filters]
  );

  return {
    columns,
    rows,
    allDatabases,
    relationData,
    sort,
    filters,
    showFilters,
    setShowFilters,
    showImport,
    setShowImport,
    updateCell,
    addRow,
    deleteRow,
    addColumn,
    updateColumn,
    deleteColumn,
    toggleSort,
    updateFilter,
    setFilters,
    filteredRows,
  };
}
