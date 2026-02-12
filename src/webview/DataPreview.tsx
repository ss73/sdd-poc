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

interface RowSelection {
  rowIndex: number;
  rowIdentifier: Record<string, unknown>;
}

interface DeleteConfirmation {
  rowIndex: number;
  rowIdentifier: Record<string, unknown>;
  isDeleting: boolean;
  error: string | null;
}

interface NewRow {
  values: Record<string, string>;
  errors: Record<string, string>;
  isSaving: boolean;
  globalError: string | null;
}

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
  const [selectedRow, setSelectedRow] = useState<RowSelection | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [newRow, setNewRow] = useState<NewRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const newRowRef = useRef<HTMLTableRowElement>(null);
  const newRowInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
    setSelectedRow(null);
    setDeleteConfirmation(null);
    setNewRow(null);
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
      if (message.type === 'delete-result') {
        if (message.payload.success && message.payload.updatedData) {
          const updated = message.payload.updatedData;
          // Handle last-row-on-page: if page is now empty and we're not on page 0
          if (updated.rows.length === 0 && updated.page > 0) {
            setPage(updated.page - 1);
            setDeleteConfirmation(null);
            setSelectedRow(null);
            const reqId = generateRequestId();
            sendMessage({
              type: 'request-data',
              requestId: reqId,
              payload: {
                tableName: updated.tableName,
                page: updated.page - 1,
                sortColumn: updated.sortColumn,
                sortDirection: updated.sortDirection,
              },
            });
          } else {
            setData(updated);
            setDeleteConfirmation(null);
            setSelectedRow(null);
          }
        } else if (!message.payload.success) {
          setDeleteConfirmation((prev) =>
            prev ? { ...prev, isDeleting: false, error: message.payload.error } : null
          );
        }
      }
      if (message.type === 'insert-result') {
        if (message.payload.success && message.payload.updatedData) {
          const updated = message.payload.updatedData;
          setData(updated);
          setPage(updated.page);
          setNewRow(null);
          // Select the newly inserted row
          if (message.payload.insertedRowIndex !== null && message.payload.insertedRowIndex !== undefined) {
            const idx = message.payload.insertedRowIndex;
            setSelectedRow({
              rowIndex: idx,
              rowIdentifier: updated.rowIdentifiers[idx],
            });
          }
        } else if (!message.payload.success) {
          setNewRow((prev) =>
            prev ? { ...prev, isSaving: false, globalError: message.payload.error } : null
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

  // Cancel cell edit with error when clicking outside the editing cell
  useEffect(() => {
    if (!cellEdit?.error) return;
    const handler = (e: MouseEvent) => {
      const editingCell = document.querySelector('.cell-editing');
      if (editingCell && editingCell.contains(e.target as Node)) return;
      setCellEdit(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cellEdit?.error]);

  // Scroll new row into view and focus first input
  useEffect(() => {
    if (newRow && !newRow.isSaving) {
      newRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      // Focus the first editable input
      if (data) {
        const firstEditableCol = data.columns.find(
          (col) => data.editableColumns.includes(col) && !data.blobColumns.includes(col)
        );
        if (firstEditableCol) {
          setTimeout(() => newRowInputRefs.current[firstEditableCol]?.focus(), 100);
        }
      }
    }
  }, [newRow !== null]); // only trigger when newRow is created/removed

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
      setSelectedRow(null);
      setDeleteConfirmation(null);
      fetchData(0, newCol, newDir);
    },
    [sort, fetchData]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      setCellEdit(null);
      setSelectedRow(null);
      setDeleteConfirmation(null);
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
    // If there's an error showing, clicking outside should cancel
    if (cellEdit?.error) {
      cancelEdit();
      return;
    }
    commitEdit();
  }, [commitEdit, cancelEdit, cellEdit?.error]);

  // Row selection
  const handleRowClick = useCallback(
    (rowIndex: number) => {
      if (!data || cellEdit || newRow) return;
      if (selectedRow?.rowIndex === rowIndex) {
        setSelectedRow(null);
        setDeleteConfirmation(null);
        return;
      }
      setSelectedRow({
        rowIndex,
        rowIdentifier: data.rowIdentifiers[rowIndex],
      });
      setDeleteConfirmation(null);
    },
    [data, cellEdit, newRow, selectedRow]
  );

  // Delete flow
  const handleDeleteClick = useCallback(() => {
    if (!selectedRow) return;
    setDeleteConfirmation({
      rowIndex: selectedRow.rowIndex,
      rowIdentifier: selectedRow.rowIdentifier,
      isDeleting: false,
      error: null,
    });
  }, [selectedRow]);

  const confirmDelete = useCallback(() => {
    if (!deleteConfirmation || !data || deleteConfirmation.isDeleting) return;
    setDeleteConfirmation((prev) => prev ? { ...prev, isDeleting: true, error: null } : null);
    const requestId = generateRequestId();
    sendMessage({
      type: 'delete-row',
      requestId,
      payload: {
        tableName: data.tableName,
        rowIdentifier: deleteConfirmation.rowIdentifier,
      },
    });
  }, [deleteConfirmation, data]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmation(null);
  }, []);

  // Insert flow
  const handleAddRowClick = useCallback(() => {
    setNewRow({
      values: {},
      errors: {},
      isSaving: false,
      globalError: null,
    });
    setSelectedRow(null);
    setDeleteConfirmation(null);
  }, []);

  const handleNewRowChange = useCallback((colName: string, value: string) => {
    setNewRow((prev) =>
      prev ? { ...prev, values: { ...prev.values, [colName]: value }, errors: { ...prev.errors, [colName]: '' }, globalError: null } : null
    );
  }, []);

  const commitNewRow = useCallback(() => {
    if (!newRow || !data || newRow.isSaving) return;
    // Collect non-empty values
    const columnValues: Record<string, unknown> = {};
    for (const [col, val] of Object.entries(newRow.values)) {
      if (val !== '') {
        columnValues[col] = val;
      }
    }
    setNewRow((prev) => prev ? { ...prev, isSaving: true, globalError: null } : null);
    const requestId = generateRequestId();
    sendMessage({
      type: 'insert-row',
      requestId,
      payload: {
        tableName: data.tableName,
        columnValues,
      },
    });
  }, [newRow, data]);

  const cancelNewRow = useCallback(() => {
    if (!newRow) return;
    const hasValues = Object.values(newRow.values).some((v) => v !== '');
    if (hasValues && !window.confirm('Discard unsaved new row?')) return;
    setNewRow(null);
  }, [newRow]);

  const handleNewRowKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelNewRow();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commitNewRow();
      }
    },
    [cancelNewRow, commitNewRow]
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.totalRows / 50)) : 1;

  const isEditingCell = (ri: number, ci: number) =>
    cellEdit !== null && cellEdit.rowIndex === ri && cellEdit.colIndex === ci;

  return (
    <div className="data-preview">
      <div className="data-toolbar">
        <span className="table-title">{tableName}</span>
        {data && !data.readOnly && !databaseChanged && (
          <>
            <button
              className="header-btn"
              onClick={handleAddRowClick}
              disabled={!!newRow || data.editableColumns.length === 0}
              title={data.editableColumns.length === 0 ? 'No editable columns' : 'Add a new row'}
            >
              + Add Row
            </button>
            <button
              className="header-btn"
              onClick={handleDeleteClick}
              disabled={!selectedRow || !!newRow}
              title={!selectedRow ? 'Select a row first' : 'Delete selected row'}
            >
              Delete
            </button>
          </>
        )}
        {data && (
          <span className="row-count">
            {data.totalRows.toLocaleString()} rows
          </span>
        )}
        <button className="close-btn" onClick={onClose} title="Close preview">
          ×
        </button>
      </div>

      {deleteConfirmation && (
        <div className={`delete-confirmation-bar${deleteConfirmation.error ? ' has-error' : ''}`}>
          {deleteConfirmation.error ? (
            <>
              <span className="delete-error">{deleteConfirmation.error}</span>
              <button className="header-btn" onClick={cancelDelete}>
                Dismiss
              </button>
            </>
          ) : (
            <>
              <span>Delete this row?</span>
              <button
                className="header-btn"
                onClick={confirmDelete}
                disabled={deleteConfirmation.isDeleting}
              >
                {deleteConfirmation.isDeleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                className="header-btn"
                onClick={cancelDelete}
                disabled={deleteConfirmation.isDeleting}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

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
                  <tr
                    key={ri}
                    className={selectedRow?.rowIndex === ri ? 'row-selected' : ''}
                    onClick={() => handleRowClick(ri)}
                  >
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
                {data.rows.length === 0 && !newRow && (
                  <tr>
                    <td
                      colSpan={data.columns.length}
                      style={{ textAlign: 'center', color: 'var(--vscode-descriptionForeground)', padding: '20px' }}
                    >
                      No data in this table
                    </td>
                  </tr>
                )}
                {newRow && (
                  <tr className="new-row" ref={newRowRef}>
                    {data.columns.map((col) => {
                      const isPk = data.primaryKeyColumns.includes(col);
                      const isBlob = data.blobColumns.includes(col);
                      const isEditable = !isPk && !isBlob && data.editableColumns.includes(col);
                      return (
                        <td key={col} className={isEditable ? 'cell-editing' : ''}>
                          {isPk ? (
                            <span className="null-value">(auto)</span>
                          ) : isBlob ? (
                            <span className="blob-value">(blob)</span>
                          ) : isEditable ? (
                            <input
                              ref={(el) => { newRowInputRefs.current[col] = el; }}
                              className="cell-edit-input"
                              type="text"
                              value={newRow.values[col] ?? ''}
                              onChange={(e) => handleNewRowChange(col, e.target.value)}
                              onKeyDown={handleNewRowKeyDown}
                              disabled={newRow.isSaving}
                              placeholder={col}
                            />
                          ) : (
                            <span className="null-value">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}
                {newRow && (
                  <tr className="new-row-actions">
                    <td colSpan={data.columns.length}>
                      <div className="new-row-action-bar">
                        {newRow.globalError && (
                          <span className="delete-error">{newRow.globalError}</span>
                        )}
                        <button
                          className="header-btn"
                          onClick={commitNewRow}
                          disabled={newRow.isSaving}
                        >
                          {newRow.isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="header-btn"
                          onClick={cancelNewRow}
                          disabled={newRow.isSaving}
                        >
                          Cancel
                        </button>
                      </div>
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
