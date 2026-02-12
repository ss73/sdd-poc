import { useState, useEffect, useCallback, useRef } from 'react';
import type { DataPage, ExtensionToWebviewMessage } from '../types';
import { sendMessage, onMessage, generateRequestId } from './vscodeApi';

interface DataPreviewProps {
  tableName: string;
  onClose: () => void;
  databaseChanged: boolean;
}

type SortState = {
  column: string | null;
  direction: 'asc' | 'desc' | null;
};

interface CellEdit {
  rowIndex: number;
  colIndex: number;
  columnName: string;
  originalValue: unknown;
  currentValue: string;
  isSaving: boolean;
  error: string | null;
}

export function DataPreview({ tableName, onClose, databaseChanged }: DataPreviewProps) {
  const [data, setData] = useState<DataPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });
  const [page, setPage] = useState(0);
  const [cellEdit, setCellEdit] = useState<CellEdit | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(
    (p: number, sortCol: string | null, sortDir: 'asc' | 'desc' | null) => {
      setLoading(true);
      const requestId = generateRequestId();
      sendMessage({
        type: 'request-data',
        requestId,
        payload: {
          tableName,
          page: p,
          sortColumn: sortCol,
          sortDirection: sortDir,
        },
      });
    },
    [tableName]
  );

  // Initial fetch
  useEffect(() => {
    setPage(0);
    setSort({ column: null, direction: null });
    setCellEdit(null);
    fetchData(0, null, null);
  }, [tableName, fetchData]);

  // Listen for data-page and update-result responses
  useEffect(() => {
    const unsubscribe = onMessage((message: ExtensionToWebviewMessage) => {
      if (message.type === 'data-page' && message.payload.tableName === tableName) {
        setData(message.payload);
        setLoading(false);
      }
      if (message.type === 'update-result') {
        if (message.payload.success && message.payload.updatedData) {
          setData(message.payload.updatedData);
          setCellEdit(null);
        } else if (!message.payload.success) {
          setCellEdit((prev) =>
            prev ? { ...prev, isSaving: false, error: message.payload.error } : null
          );
        }
      }
    });
    return unsubscribe;
  }, [tableName]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (cellEdit && !cellEdit.isSaving) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [cellEdit?.rowIndex, cellEdit?.colIndex]);

  const handleSort = useCallback(
    (colName: string) => {
      let newDir: 'asc' | 'desc' | null;
      if (sort.column === colName) {
        if (sort.direction === 'asc') {
          newDir = 'desc';
        } else if (sort.direction === 'desc') {
          newDir = null;
        } else {
          newDir = 'asc';
        }
      } else {
        newDir = 'asc';
      }

      const newCol = newDir ? colName : null;
      setSort({ column: newCol, direction: newDir });
      setPage(0);
      setCellEdit(null);
      fetchData(0, newCol, newDir);
    },
    [sort, fetchData]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      setCellEdit(null);
      fetchData(newPage, sort.column, sort.direction);
    },
    [sort, fetchData]
  );

  const isEditable = useCallback(
    (colName: string): boolean => {
      if (!data) return false;
      if (data.readOnly) return false;
      if (databaseChanged) return false;
      return data.editableColumns.includes(colName);
    },
    [data, databaseChanged]
  );

  const handleCellDoubleClick = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!data) return;
      const colName = data.columns[colIndex];
      if (!isEditable(colName)) return;

      const cellValue = data.rows[rowIndex][colIndex];
      setCellEdit({
        rowIndex,
        colIndex,
        columnName: colName,
        originalValue: cellValue,
        currentValue: cellValue === null ? '' : String(cellValue),
        isSaving: false,
        error: null,
      });
    },
    [data, isEditable]
  );

  const handleEditChange = useCallback((value: string) => {
    setCellEdit((prev) =>
      prev ? { ...prev, currentValue: value, error: null } : null
    );
  }, []);

  const commitEdit = useCallback(() => {
    if (!cellEdit || !data || cellEdit.isSaving) return;

    // No change — just close edit mode
    const originalStr = cellEdit.originalValue === null ? '' : String(cellEdit.originalValue);
    if (cellEdit.currentValue === originalStr) {
      setCellEdit(null);
      return;
    }

    const newValue = cellEdit.currentValue === '' && cellEdit.originalValue === null
      ? null
      : cellEdit.currentValue;

    setCellEdit((prev) => prev ? { ...prev, isSaving: true } : null);

    const requestId = generateRequestId();
    sendMessage({
      type: 'update-cell',
      requestId,
      payload: {
        tableName: data.tableName,
        columnName: cellEdit.columnName,
        newValue,
        rowIdentifier: data.rowIdentifiers[cellEdit.rowIndex],
      },
    });
  }, [cellEdit, data]);

  const cancelEdit = useCallback(() => {
    setCellEdit(null);
  }, []);

  const setNull = useCallback(() => {
    if (!cellEdit || !data || cellEdit.isSaving) return;

    setCellEdit((prev) => prev ? { ...prev, isSaving: true } : null);

    const requestId = generateRequestId();
    sendMessage({
      type: 'update-cell',
      requestId,
      payload: {
        tableName: data.tableName,
        columnName: cellEdit.columnName,
        newValue: null,
        rowIdentifier: data.rowIdentifiers[cellEdit.rowIndex],
      },
    });
  }, [cellEdit, data]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit]
  );

  const handleBlur = useCallback(() => {
    commitEdit();
  }, [commitEdit]);

  const totalPages = data ? Math.max(1, Math.ceil(data.totalRows / 50)) : 1;

  const isEditingCell = (ri: number, ci: number) =>
    cellEdit !== null && cellEdit.rowIndex === ri && cellEdit.colIndex === ci;

  return (
    <div className="data-preview">
      <div className="data-toolbar">
        <span className="table-title">{tableName}</span>
        {data && (
          <span className="row-count">
            {data.totalRows.toLocaleString()} rows
          </span>
        )}
        <button className="close-btn" onClick={onClose} title="Close preview">
          ×
        </button>
      </div>

      {loading && !data ? (
        <div className="loading">
          <div className="spinner" />
          Loading data...
        </div>
      ) : data ? (
        <>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  {data.columns.map((col) => (
                    <th key={col} onClick={() => handleSort(col)}>
                      {col}
                      {sort.column === col && (
                        <span className="sort-arrow">
                          {sort.direction === 'asc' ? '\u25B4' : '\u25BE'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => {
                      const editing = isEditingCell(ri, ci);
                      const editable = isEditable(data.columns[ci]);
                      return (
                        <td
                          key={ci}
                          className={editing ? 'cell-editing' : editable ? 'cell-editable' : ''}
                          onDoubleClick={() => handleCellDoubleClick(ri, ci)}
                        >
                          {editing && cellEdit ? (
                            <div className="cell-edit-container">
                              <div className="cell-edit-row">
                                <input
                                  ref={inputRef}
                                  className="cell-edit-input"
                                  type="text"
                                  value={cellEdit.currentValue}
                                  onChange={(e) => handleEditChange(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                  onBlur={(e) => {
                                    // Prevent blur-commit when clicking Set NULL button
                                    if (e.relatedTarget?.classList.contains('set-null-btn')) return;
                                    handleBlur();
                                  }}
                                  disabled={cellEdit.isSaving}
                                />
                                {data && !data.notNullColumns.includes(cellEdit.columnName) && (
                                  <button
                                    className="set-null-btn"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={setNull}
                                    disabled={cellEdit.isSaving}
                                    title="Set value to NULL"
                                  >
                                    NULL
                                  </button>
                                )}
                              </div>
                              {cellEdit.error && (
                                <div className="cell-edit-error">{cellEdit.error}</div>
                              )}
                            </div>
                          ) : data.blobColumns.includes(data.columns[ci]) ? (
                            <span className="blob-value">(BLOB)</span>
                          ) : cell === null ? (
                            <span className="null-value">NULL</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={data.columns.length}
                      style={{ textAlign: 'center', color: 'var(--vscode-descriptionForeground)', padding: '20px' }}
                    >
                      No data in this table
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data.totalRows > 50 && (
            <div className="pagination">
              <button
                disabled={page === 0}
                onClick={() => handlePageChange(page - 1)}
              >
                Previous
              </button>
              <span className="page-info">
                Page {page + 1} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
