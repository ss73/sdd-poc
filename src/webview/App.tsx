import { useState, useEffect, useCallback } from 'react';
import type { TableInfo, ExtensionToWebviewMessage } from '../types';
import { onMessage, sendMessage } from './vscodeApi';
import { SchemaTree } from './SchemaTree';
import { ErDiagram } from './ErDiagram';
import { DataPreview } from './DataPreview';

export type ViewMode = 'schema' | 'er-diagram' | 'data-preview';

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

  useEffect(() => {
    const unsubscribe = onMessage((message: ExtensionToWebviewMessage) => {
      switch (message.type) {
        case 'schema-loaded':
          setState((prev) => ({
            ...prev,
            fileName: message.payload.fileName,
            filePath: message.payload.filePath,
            tables: message.payload.tables,
            loading: false,
            error: null,
            errorAction: null,
            databaseChanged: false,
          }));
          break;

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
      viewMode: 'data-preview',
      previewTable: tableName,
    }));
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

  return (
    <div className="app">
      <div className="header">
        <span className="file-name">{state.fileName}</span>
        <div className="header-actions">
          {state.viewMode !== 'schema' && (
            <button className="header-btn" onClick={handleShowSchema}>
              Schema Tree
            </button>
          )}
          {state.viewMode !== 'er-diagram' && (
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
          <SchemaTree
            tables={state.tables}
            onPreviewData={handlePreviewData}
          />
        )}
        {state.viewMode === 'er-diagram' && (
          <ErDiagram
            tables={state.tables}
            onPreviewData={handlePreviewData}
          />
        )}
        {state.viewMode === 'data-preview' && state.previewTable && (
          <DataPreview
            tableName={state.previewTable}
            onBack={handleShowSchema}
          />
        )}
      </div>
    </div>
  );
}
