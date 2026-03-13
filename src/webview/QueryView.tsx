import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExtensionToWebviewMessage, ExportCsvResultMessage } from '../types';
import { sendMessage, onMessage, generateRequestId } from './vscodeApi';

interface QueryResult {
  type: 'rows' | 'affected' | 'error';
  columns: string[];
  rows: unknown[][];
  affectedRows: number;
  error: string | null;
}

interface QueryTab {
  id: string;
  label: string;
  query: string;
  result: QueryResult | null;
  isExecuting: boolean;
  pendingRequestId: string | null;
}

let tabCounter = 0;

function createTab(): QueryTab {
  tabCounter++;
  return {
    id: `tab-${tabCounter}`,
    label: `Query ${tabCounter}`,
    query: '',
    result: null,
    isExecuting: false,
    pendingRequestId: null,
  };
}

export function QueryView() {
  const [tabs, setTabs] = useState<QueryTab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState<string>(() => `tab-${tabCounter}`);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // Listen for query-result messages
  useEffect(() => {
    const unsubscribe = onMessage((message: ExtensionToWebviewMessage) => {
      if (message.type === 'query-result') {
        const { requestId, payload } = message;
        setTabs((prev) =>
          prev.map((tab) =>
            tab.pendingRequestId === requestId
              ? { ...tab, result: payload, isExecuting: false, pendingRequestId: null }
              : tab
          )
        );
      }
    });
    return unsubscribe;
  }, []);

  const executeQuery = useCallback(() => {
    if (!activeTab || activeTab.isExecuting || !activeTab.query.trim()) return;

    const requestId = generateRequestId();
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? { ...tab, isExecuting: true, pendingRequestId: requestId }
          : tab
      )
    );

    sendMessage({
      type: 'execute-query',
      requestId,
      payload: { sql: activeTab.query },
    });
  }, [activeTab]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, query: value } : tab
        )
      );
    },
    [activeTabId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeQuery();
      }
    },
    [executeQuery]
  );

  const addTab = useCallback(() => {
    const newTab = createTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const closeTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== tabId);
        if (remaining.length === 0) {
          const newTab = createTab();
          return [newTab];
        }
        return remaining;
      });
      if (activeTabId === tabId) {
        setTabs((prev) => {
          // need to compute new active from remaining
          return prev;
        });
        // Switch to nearest tab
        setActiveTabId((prevId) => {
          if (prevId !== tabId) return prevId;
          const idx = tabs.findIndex((t) => t.id === tabId);
          const remaining = tabs.filter((t) => t.id !== tabId);
          if (remaining.length === 0) return `tab-${tabCounter}`;
          const newIdx = Math.min(idx, remaining.length - 1);
          return remaining[newIdx].id;
        });
      }
    },
    [activeTabId, tabs]
  );

  // Focus textarea when switching tabs
  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeTabId]);

  const [isExporting, setIsExporting] = useState(false);

  // Listen for export-csv-result messages
  useEffect(() => {
    const unsubscribe = onMessage((message: ExtensionToWebviewMessage) => {
      if (message.type === 'export-csv-result') {
        setIsExporting(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!activeTab?.result || activeTab.result.type !== 'rows' || isExporting) return;
    setIsExporting(true);
    const requestId = generateRequestId();
    sendMessage({
      type: 'export-csv',
      requestId,
      payload: {
        source: 'query-tab' as const,
        columns: activeTab.result.columns,
        rows: activeTab.result.rows,
        suggestedFilename: `${activeTab.label}.csv`,
      },
    });
  }, [activeTab, isExporting]);

  const result = activeTab?.result ?? null;
  const isExecuting = activeTab?.isExecuting ?? false;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  // Sort state
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Reset pagination and sort when results change
  useEffect(() => {
    setCurrentPage(0);
    setSortColumn(null);
    setSortDirection('asc');
  }, [activeTab?.result]);

  // Reset pagination when switching tabs
  useEffect(() => {
    setCurrentPage(0);
    setSortColumn(null);
    setSortDirection('asc');
  }, [activeTabId]);

  // Sort rows if needed
  const getSortedRows = useCallback(() => {
    if (!result || result.type !== 'rows') return [];
    if (sortColumn === null) return result.rows;

    const sorted = [...result.rows].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      const cmp = aStr.localeCompare(bStr);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [result, sortColumn, sortDirection]);

  const handleSort = useCallback(
    (colIndex: number) => {
      if (sortColumn === colIndex) {
        if (sortDirection === 'asc') {
          setSortDirection('desc');
        } else {
          setSortColumn(null);
          setSortDirection('asc');
        }
      } else {
        setSortColumn(colIndex);
        setSortDirection('asc');
      }
      setCurrentPage(0);
    },
    [sortColumn, sortDirection]
  );

  const sortedRows = getSortedRows();
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageRows = sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const renderCellValue = (value: unknown) => {
    if (value === null) {
      return <span className="null-value">NULL</span>;
    }
    if (value instanceof ArrayBuffer || value instanceof Uint8Array) {
      return <span className="blob-value">(BLOB)</span>;
    }
    return String(value);
  };

  return (
    <div className="query-view">
      <div className="query-tab-bar">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`query-tab${tab.id === activeTabId ? ' active' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span className="query-tab-label">{tab.label}</span>
            <span
              className="query-tab-close"
              onClick={(e) => closeTab(tab.id, e)}
              title="Close tab"
            >
              ×
            </span>
          </div>
        ))}
        <button className="query-tab-add" onClick={addTab} title="New query tab">
          +
        </button>
      </div>

      <div className="query-editor">
        <textarea
          ref={textareaRef}
          className="query-textarea"
          value={activeTab?.query ?? ''}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your SQL query here..."
          disabled={isExecuting}
          spellCheck={false}
        />
        <div className="query-actions">
          <button
            className="header-btn"
            onClick={executeQuery}
            disabled={isExecuting || !activeTab?.query.trim()}
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
          <span className="query-shortcut-hint">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter</span>
        </div>
      </div>

      <div className="query-results">
        {isExecuting && (
          <div className="loading">
            <div className="spinner" />
            Executing query...
          </div>
        )}

        {!isExecuting && result === null && (
          <div className="query-empty-state">
            Run a query to see results
          </div>
        )}

        {!isExecuting && result?.type === 'error' && (
          <div className="query-error">
            {result.error}
          </div>
        )}

        {!isExecuting && result?.type === 'affected' && (
          <div className="query-affected">
            {result.affectedRows} row(s) affected
          </div>
        )}

        {!isExecuting && result?.type === 'rows' && (
          <>
            <div className="data-toolbar" style={{ borderTop: 'none' }}>
              <span className="row-count">{totalRows} rows</span>
              <button
                className="header-btn"
                onClick={handleExportCsv}
                disabled={isExporting || totalRows === 0 && result.columns.length === 0}
              >
                {isExporting ? 'Exporting...' : 'Export to CSV'}
              </button>
            </div>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {result.columns.map((col, ci) => (
                      <th key={ci} onClick={() => handleSort(ci)}>
                        {col}
                        {sortColumn === ci && (
                          <span className="sort-arrow">
                            {sortDirection === 'asc' ? '\u25B4' : '\u25BE'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci}>{renderCellValue(cell)}</td>
                      ))}
                    </tr>
                  ))}
                  {totalRows === 0 && (
                    <tr>
                      <td
                        colSpan={result.columns.length}
                        style={{ textAlign: 'center', color: 'var(--vscode-descriptionForeground)', padding: '20px' }}
                      >
                        No results
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalRows > pageSize && (
              <div className="pagination">
                <button
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {currentPage + 1} of {totalPages} · {totalRows} rows
                </span>
                <button
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
