import { useState, useEffect, useCallback, useRef } from 'react';
import type { TableInfo, ExtensionToWebviewMessage } from '../types';
import { onMessage, sendMessage } from './vscodeApi';
import { SchemaTree } from './SchemaTree';
import { ErDiagram } from './ErDiagram';
import { DataPreview } from './DataPreview';

export type ViewMode = 'schema' | 'er-diagram';

interface AppState {
  fileName: string | null;
  filePath: string | null;
  tables: TableInfo[];
  loading: boolean;
  error: string | null;
  errorAction: string | null;
  databaseChanged: boolean;
  viewMode: ViewMode;
  previewTable: string | null;
}

const MIN_PANE_PX = 200;
const DEFAULT_SPLIT_RATIO = 0.4;

export function App() {
  const [state, setState] = useState<AppState>({
    fileName: null,
    filePath: null,
    tables: [],
    loading: true,
    error: null,
    errorAction: null,
    databaseChanged: false,
    viewMode: 'schema',
    previewTable: null,
  });
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onMessage((message: ExtensionToWebviewMessage) => {
      switch (message.type) {
        case 'schema-loaded': {
          const newTables = message.payload.tables;
          setState((prev) => {
            const tableStillExists = prev.previewTable != null &&
              newTables.some((t: TableInfo) => t.name === prev.previewTable);
            return {
              ...prev,
              fileName: message.payload.fileName,
              filePath: message.payload.filePath,
              tables: newTables,
              loading: false,
              error: null,
              errorAction: null,
              databaseChanged: false,
              previewTable: tableStillExists ? prev.previewTable : null,
            };
          });
          break;
        }

        case 'error':
          setState((prev) => ({
            ...prev,
            loading: false,
            error: message.payload.message,
            errorAction: message.payload.action || null,
          }));
          break;

        case 'database-unavailable':
          setState((prev) => ({
            ...prev,
            error: message.payload.message,
            errorAction: 'The database file is no longer available.',
          }));
          break;

        case 'database-changed':
          setState((prev) => ({
            ...prev,
            databaseChanged: true,
          }));
          break;
      }
    });
    return unsubscribe;
  }, []);

  const handleReload = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, databaseChanged: false }));
    sendMessage({ type: 'reload-database', payload: {} });
  }, []);

  const handleShowErDiagram = useCallback(() => {
    setState((prev) => ({ ...prev, viewMode: 'er-diagram' }));
  }, []);

  const handleShowSchema = useCallback(() => {
    setState((prev) => ({ ...prev, viewMode: 'schema' }));
  }, []);

  const handlePreviewData = useCallback((tableName: string) => {
    setState((prev) => ({
      ...prev,
      viewMode: 'schema',
      previewTable: tableName,
    }));
  }, []);

  const handleClosePreview = useCallback(() => {
    setState((prev) => ({ ...prev, previewTable: null }));
  }, []);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !container) return;
      const rect = container.getBoundingClientRect();
      const x = Math.max(MIN_PANE_PX, Math.min(ev.clientX - rect.left, rect.width - MIN_PANE_PX));
      const schemaPane = container.querySelector('.schema-pane') as HTMLElement;
      if (schemaPane) {
        schemaPane.style.width = `${(x / rect.width) * 100}%`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = Math.max(MIN_PANE_PX, Math.min(ev.clientX - rect.left, rect.width - MIN_PANE_PX));
        setSplitRatio(x / rect.width);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  if (state.loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading database...
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="error-container">
        <div className="error-icon">!</div>
        <div className="error-message">{state.error}</div>
        {state.errorAction && (
          <div className="error-action">{state.errorAction}</div>
        )}
      </div>
    );
  }

  const showSplit = state.viewMode === 'schema' && state.previewTable !== null;

  return (
    <div className="app">
      <div className="header">
        <span className="file-name">{state.fileName}</span>
        <div className="header-actions">
          {state.viewMode === 'er-diagram' && (
            <button className="header-btn" onClick={handleShowSchema}>
              Schema Tree
            </button>
          )}
          {state.viewMode === 'schema' && (
            <button className="header-btn" onClick={handleShowErDiagram}>
              ER Diagram
            </button>
          )}
        </div>
        {state.databaseChanged && (
          <button className="reload-btn" onClick={handleReload}>
            Database changed — Reload
          </button>
        )}
      </div>
      <div className="content">
        {state.viewMode === 'schema' && (
          <div className={`schema-view${showSplit ? ' split' : ''}`} ref={containerRef}>
            <div className="schema-pane" style={showSplit ? { width: `${splitRatio * 100}%` } : undefined}>
              <SchemaTree
                tables={state.tables}
                onPreviewData={handlePreviewData}
                selectedTable={state.previewTable}
              />
            </div>
            {showSplit && state.previewTable && (
              <>
                <div className="divider" onMouseDown={handleDividerMouseDown} />
                <div className="preview-pane">
                  <DataPreview
                    tableName={state.previewTable}
                    onClose={handleClosePreview}
                    databaseChanged={state.databaseChanged}
                  />
                </div>
              </>
            )}
          </div>
        )}
        {state.viewMode === 'er-diagram' && (
          <ErDiagram
            tables={state.tables}
            onPreviewData={handlePreviewData}
          />
        )}
      </div>
    </div>
  );
}
