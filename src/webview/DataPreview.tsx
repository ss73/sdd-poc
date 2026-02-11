import { useState, useEffect, useCallback } from 'react';
import type { DataPage, ExtensionToWebviewMessage } from '../types';
import { sendMessage, onMessage, generateRequestId } from './vscodeApi';

interface DataPreviewProps {
  tableName: string;
  onClose: () => void;
}

type SortState = {
  column: string | null;
  direction: 'asc' | 'desc' | null;
};

export function DataPreview({ tableName, onClose }: DataPreviewProps) {
  const [data, setData] = useState<DataPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });
  const [page, setPage] = useState(0);

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
    fetchData(0, null, null);
  }, [tableName, fetchData]);

  // Listen for data-page responses
  useEffect(() => {
    const unsubscribe = onMessage((message: ExtensionToWebviewMessage) => {
      if (message.type === 'data-page' && message.payload.tableName === tableName) {
        setData(message.payload);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [tableName]);

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
      fetchData(0, newCol, newDir);
    },
    [sort, fetchData]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      fetchData(newPage, sort.column, sort.direction);
    },
    [sort, fetchData]
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.totalRows / 50)) : 1;

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
                    {row.map((cell, ci) => (
                      <td key={ci}>
                        {cell === null ? (
                          <span className="null-value">NULL</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
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
