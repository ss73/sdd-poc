import * as vscode from 'vscode';
import * as fs from 'fs';
import { SqliteService } from './sqliteService';
import type {
  WebviewToExtensionMessage,
  TableInfo,
} from './types';

export class SchemaProvider implements vscode.CustomEditorProvider {
  public static readonly viewType = 'sqlDbVisualizer.schemaView';

  private sqliteService: SqliteService;
  private currentWatcher: vscode.FileSystemWatcher | undefined;
  private currentUri: vscode.Uri | undefined;
  private currentWebview: vscode.WebviewPanel | undefined;
  private currentSchema: TableInfo[] | undefined;
  private readOnly = false;
  private isWritingBack = false;
  private lastRequestedTable: string | undefined;
  private lastRequestedPage = 0;
  private lastRequestedSortColumn: string | null = null;
  private lastRequestedSortDirection: 'asc' | 'desc' | null = null;

  // CustomEditorProvider event — not used since we save immediately
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<vscode.CustomDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.sqliteService = new SqliteService();
  }

  openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): vscode.CustomDocument {
    return { uri, dispose: () => {} };
  }

  async saveCustomDocument(): Promise<void> {
    // No-op: edits are persisted immediately on each cell commit
  }

  async revertCustomDocument(): Promise<void> {
    // No-op: no batch editing state to revert
  }

  async saveCustomDocumentAs(): Promise<void> {
    // Not supported — database files are edited in-place
  }

  async backupCustomDocument(): Promise<vscode.CustomDocumentBackup> {
    return { id: '', delete: () => {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Dispose previous watcher if any
    this.currentWatcher?.dispose();
    this.currentUri = document.uri;
    this.currentWebview = webviewPanel;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => this.handleMessage(message),
      undefined,
      []
    );

    // Load database
    await this.loadDatabase(document.uri, webviewPanel);

    // Set up file watcher
    this.setupFileWatcher(document.uri, webviewPanel);

    webviewPanel.onDidDispose(() => {
      this.currentWatcher?.dispose();
      this.currentWatcher = undefined;
      this.currentWebview = undefined;
      this.currentSchema = undefined;
    });
  }

  private async loadDatabase(
    uri: vscode.Uri,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      this.sqliteService.openDatabase(uri.fsPath);

      try {
        fs.accessSync(uri.fsPath, fs.constants.W_OK);
        this.readOnly = false;
      } catch {
        this.readOnly = true;
      }

      const tables = this.sqliteService.getSchema();
      this.currentSchema = tables;

      const fileName = uri.path.split('/').pop() || uri.path;

      webviewPanel.webview.postMessage({
        type: 'schema-loaded',
        payload: {
          fileName,
          filePath: uri.fsPath,
          tables,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error opening database';

      let action: string | undefined;
      if (message.includes('not a database') || message.includes('file is not a database')) {
        action = 'This file is not a valid SQLite database. Verify the file format.';
      } else if (message.includes('permission') || message.includes('EACCES')) {
        action = 'Permission denied. Check file permissions.';
      } else if (message.includes('EBUSY') || message.includes('locked')) {
        action = 'The file is locked by another process. Close other applications using this file.';
      } else {
        action = 'Check that the file exists and is a valid SQLite database.';
      }

      webviewPanel.webview.postMessage({
        type: 'error',
        payload: { message: `Failed to open database: ${message}`, action },
      });
    }
  }

  private setupFileWatcher(
    uri: vscode.Uri,
    webviewPanel: vscode.WebviewPanel
  ): void {
    const pattern = new vscode.RelativePattern(uri, '');
    // Watch the specific file
    this.currentWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.Uri.joinPath(uri, '..'),
        uri.path.split('/').pop()!
      )
    );

    this.currentWatcher.onDidChange(() => {
      if (this.isWritingBack) {
        this.isWritingBack = false;
        return;
      }
      webviewPanel.webview.postMessage({
        type: 'database-changed',
        payload: {},
      });
    });

    this.currentWatcher.onDidDelete(() => {
      webviewPanel.webview.postMessage({
        type: 'database-unavailable',
        payload: {
          reason: 'deleted' as const,
          message: 'The database file has been deleted or moved.',
        },
      });
    });
  }

  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case 'request-data': {
        try {
          const { tableName, page, sortColumn, sortDirection } = message.payload;
          this.lastRequestedTable = tableName;
          this.lastRequestedPage = page;
          this.lastRequestedSortColumn = sortColumn;
          this.lastRequestedSortDirection = sortDirection;
          const dataPage = this.sqliteService.getRows(
            tableName,
            page,
            sortColumn,
            sortDirection,
            this.readOnly
          );
          this.currentWebview?.webview.postMessage({
            type: 'data-page',
            requestId: message.requestId,
            payload: dataPage,
          });
        } catch (err) {
          const errMessage =
            err instanceof Error ? err.message : 'Failed to query data';
          this.currentWebview?.webview.postMessage({
            type: 'error',
            requestId: message.requestId,
            payload: { message: errMessage },
          });
        }
        break;
      }

      case 'update-cell': {
        try {
          const { tableName, columnName, newValue, rowIdentifier } = message.payload;
          this.isWritingBack = true;
          this.sqliteService.updateCell(tableName, columnName, newValue, rowIdentifier);

          const updatedData = this.sqliteService.getRows(
            this.lastRequestedTable ?? tableName,
            this.lastRequestedPage,
            this.lastRequestedSortColumn,
            this.lastRequestedSortDirection,
            this.readOnly
          );

          this.currentWebview?.webview.postMessage({
            type: 'update-result',
            requestId: message.requestId,
            payload: { success: true, error: null, updatedData },
          });
        } catch (err) {
          this.isWritingBack = false;
          const errMessage = err instanceof Error ? err.message : 'Failed to update cell';
          this.currentWebview?.webview.postMessage({
            type: 'update-result',
            requestId: message.requestId,
            payload: { success: false, error: this.parseConstraintError(errMessage), updatedData: null },
          });
        }
        break;
      }

      case 'delete-row': {
        try {
          const { tableName, rowIdentifier } = message.payload;
          this.isWritingBack = true;
          this.sqliteService.deleteRow(tableName, rowIdentifier);

          const updatedData = this.sqliteService.getRows(
            this.lastRequestedTable ?? tableName,
            this.lastRequestedPage,
            this.lastRequestedSortColumn,
            this.lastRequestedSortDirection,
            this.readOnly
          );

          this.currentWebview?.webview.postMessage({
            type: 'delete-result',
            requestId: message.requestId,
            payload: { success: true, error: null, updatedData },
          });
        } catch (err) {
          this.isWritingBack = false;
          const errMessage = err instanceof Error ? err.message : 'Failed to delete row';
          this.currentWebview?.webview.postMessage({
            type: 'delete-result',
            requestId: message.requestId,
            payload: { success: false, error: this.parseConstraintError(errMessage, 'delete'), updatedData: null },
          });
        }
        break;
      }

      case 'insert-row': {
        try {
          const { tableName, columnValues } = message.payload;
          this.isWritingBack = true;
          const lastRowid = this.sqliteService.insertRow(tableName, columnValues);

          // Determine which page the new row ended up on
          const resolvedTable = this.lastRequestedTable ?? tableName;
          const totalRows = this.sqliteService.getRowCount(resolvedTable);
          const pageSize = 50;
          const lastPage = Math.max(0, Math.ceil(totalRows / pageSize) - 1);

          // Build the new row's identifier
          const pkColumns = this.sqliteService.getPrimaryKeyColumns(resolvedTable);
          const newRowId: Record<string, unknown> = {};
          for (const pk of pkColumns) {
            newRowId[pk] = pk in columnValues ? columnValues[pk] : lastRowid;
          }

          // Fetch the last page (where new rows typically appear for unsorted/ascending)
          const targetPage = (this.lastRequestedSortColumn && this.lastRequestedSortDirection)
            ? lastPage  // With sort, the row could be anywhere — try last page
            : lastPage; // Without sort, new rows are at the end
          this.lastRequestedPage = targetPage;

          const updatedData = this.sqliteService.getRows(
            resolvedTable,
            targetPage,
            this.lastRequestedSortColumn,
            this.lastRequestedSortDirection,
            this.readOnly
          );

          // Find the inserted row's index on this page
          let insertedRowIndex: number | null = null;
          for (let i = 0; i < updatedData.rowIdentifiers.length; i++) {
            const rid = updatedData.rowIdentifiers[i];
            const matches = Object.entries(newRowId).every(([k, v]) => rid[k] === v);
            if (matches) {
              insertedRowIndex = i;
              break;
            }
          }

          this.currentWebview?.webview.postMessage({
            type: 'insert-result',
            requestId: message.requestId,
            payload: { success: true, error: null, updatedData, insertedRowIndex },
          });
        } catch (err) {
          this.isWritingBack = false;
          const errMessage = err instanceof Error ? err.message : 'Failed to insert row';
          this.currentWebview?.webview.postMessage({
            type: 'insert-result',
            requestId: message.requestId,
            payload: { success: false, error: this.parseConstraintError(errMessage, 'insert'), updatedData: null, insertedRowIndex: null },
          });
        }
        break;
      }

      case 'reload-database': {
        if (this.currentUri && this.currentWebview) {
          await this.loadDatabase(this.currentUri, this.currentWebview);
        }
        break;
      }

      case 'show-error': {
        vscode.window.showErrorMessage(message.payload.message);
        break;
      }
    }
  }

  private parseConstraintError(message: string, context: 'update' | 'delete' | 'insert' = 'update'): string {
    const lower = message.toLowerCase();
    if (lower.includes('not null') || lower.includes('notnull')) {
      return 'This column cannot be empty.';
    }
    if (lower.includes('unique')) {
      return 'This value already exists.';
    }
    if (lower.includes('foreign key') || lower.includes('foreignkey')) {
      if (context === 'delete') {
        return 'Cannot delete: other records depend on this row.';
      }
      return 'No matching record in referenced table.';
    }
    if (lower.includes('busy') || lower.includes('locked')) {
      return 'Database is locked by another process.';
    }
    return message;
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.js')
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <title>SQL Database Visualizer</title>
  <link rel="stylesheet" href="${cssUri}">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      overflow: hidden;
    }
    #root { width: 100%; height: 100vh; display: flex; flex-direction: column; }

    /* Loading & Error */
    .loading { display: flex; align-items: center; justify-content: center; height: 100vh; gap: 8px; color: var(--vscode-descriptionForeground); }
    .spinner { width: 16px; height: 16px; border: 2px solid var(--vscode-descriptionForeground); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 8px; padding: 20px; text-align: center; }
    .error-icon { width: 40px; height: 40px; line-height: 40px; border-radius: 50%; background: var(--vscode-errorForeground); color: var(--vscode-editor-background); font-size: 24px; font-weight: bold; }
    .error-message { color: var(--vscode-errorForeground); font-size: 14px; max-width: 400px; }
    .error-action { color: var(--vscode-descriptionForeground); font-size: 12px; max-width: 400px; }

    /* App layout */
    .app { display: flex; flex-direction: column; height: 100vh; }
    .header { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); flex-shrink: 0; }
    .file-name { font-weight: 600; }
    .header-actions { display: flex; gap: 4px; margin-left: auto; }
    .header-btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 3px 10px; border-radius: 2px; cursor: pointer; font-size: 12px; }
    .header-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .reload-btn { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-inputValidation-warningForeground); border: 1px solid var(--vscode-inputValidation-warningBorder); padding: 3px 10px; border-radius: 2px; cursor: pointer; font-size: 12px; }
    .content { flex: 1; overflow: hidden; }

    /* Split layout */
    .schema-view { display: flex; height: 100%; }
    .schema-view .schema-pane { flex: 1; overflow: hidden; }
    .schema-view.split .schema-pane { flex: none; min-width: 200px; overflow: hidden; }
    .schema-view .divider { width: 4px; cursor: col-resize; background: var(--vscode-panel-border); flex-shrink: 0; }
    .schema-view .divider:hover { background: var(--vscode-focusBorder); }
    .schema-view .preview-pane { flex: 1; min-width: 200px; overflow: hidden; }

    /* Schema Tree */
    .schema-tree { display: flex; flex-direction: column; height: 100%; }
    .search-box { display: flex; align-items: center; padding: 6px 12px; gap: 4px; border-bottom: 1px solid var(--vscode-panel-border); }
    .search-input { flex: 1; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 4px 8px; border-radius: 2px; outline: none; font-size: var(--vscode-font-size); font-family: var(--vscode-font-family); }
    .search-input:focus { border-color: var(--vscode-focusBorder); }
    .clear-btn { background: none; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; padding: 2px 6px; }
    .tree { flex: 1; overflow: auto; padding: 4px 0; }
    .empty-state { padding: 20px; text-align: center; color: var(--vscode-descriptionForeground); }

    /* Tree nodes */
    .tree-node { }
    .tree-row { display: flex; align-items: center; padding: 2px 8px; cursor: pointer; gap: 4px; user-select: none; min-height: 22px; }
    .tree-row:hover { background: var(--vscode-list-hoverBackground); }
    .table-row { font-weight: 500; }
    .section-row { padding-left: 24px; }
    .column-row { padding-left: 40px; }
    .index-row { padding-left: 40px; }
    .fk-row { padding-left: 40px; }
    .tree-children { }
    .chevron { width: 14px; text-align: center; flex-shrink: 0; font-size: 10px; }
    .chevron-placeholder { width: 14px; flex-shrink: 0; }

    /* Icons */
    .icon { font-size: 9px; font-weight: 700; padding: 1px 3px; border-radius: 2px; flex-shrink: 0; }
    .table-icon { background: var(--vscode-symbolIcon-classForeground, #ee9d28); color: var(--vscode-editor-background); }
    .pk-icon { background: var(--vscode-symbolIcon-keyForeground, #d4a017); color: var(--vscode-editor-background); }
    .fk-icon { background: var(--vscode-symbolIcon-referenceForeground, #a855f7); color: var(--vscode-editor-background); }
    .nn-icon { background: var(--vscode-symbolIcon-fieldForeground, #4ade80); color: var(--vscode-editor-background); }
    .idx-icon { background: var(--vscode-symbolIcon-enumForeground, #60a5fa); color: var(--vscode-editor-background); }
    .column-icons { display: flex; gap: 2px; }
    .label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .section-label { color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .column-type { margin-left: auto; color: var(--vscode-descriptionForeground); font-size: 11px; flex-shrink: 0; }
    .badge { margin-left: auto; color: var(--vscode-descriptionForeground); font-size: 11px; flex-shrink: 0; }
    .index-columns { color: var(--vscode-descriptionForeground); font-size: 11px; margin-left: 4px; }
    .highlighted { background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 179, 8, 0.3)); }
    .table-row.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
    .table-row.selected:hover { background: var(--vscode-list-activeSelectionBackground); }

    /* Context Menu */
    .context-menu { position: fixed; z-index: 1000; background: var(--vscode-menu-background); border: 1px solid var(--vscode-menu-border); border-radius: 4px; padding: 4px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.3); min-width: 140px; }
    .context-menu-item { padding: 4px 16px; cursor: pointer; font-size: 13px; color: var(--vscode-menu-foreground); }
    .context-menu-item:hover { background: var(--vscode-menu-selectionBackground); color: var(--vscode-menu-selectionForeground); }

    /* Placeholder */
    .placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--vscode-descriptionForeground); }

    /* Data Preview */
    .data-preview { display: flex; flex-direction: column; height: 100%; }
    .data-toolbar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid var(--vscode-panel-border); flex-shrink: 0; }
    .data-toolbar .table-title { font-weight: 600; }
    .data-toolbar .row-count { margin-left: auto; color: var(--vscode-descriptionForeground); font-size: 12px; }
    .data-toolbar .close-btn { background: none; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; padding: 2px 6px; font-size: 16px; line-height: 1; margin-left: 8px; border-radius: 2px; }
    .data-toolbar .close-btn:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-editor-foreground); }
    .data-table-container { flex: 1; overflow: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { position: sticky; top: 0; background: var(--vscode-editorGroupHeader-tabsBackground); border-bottom: 1px solid var(--vscode-panel-border); padding: 4px 12px; text-align: left; white-space: nowrap; cursor: pointer; user-select: none; }
    .data-table th:hover { background: var(--vscode-list-hoverBackground); }
    .data-table th .sort-arrow { margin-left: 4px; font-size: 14px; }
    .data-table td { padding: 3px 12px; border-bottom: 1px solid var(--vscode-panel-border); white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
    .data-table tr:hover td { background: var(--vscode-list-hoverBackground); }
    .null-value { color: var(--vscode-descriptionForeground); font-style: italic; opacity: 0.6; }
    .blob-value { color: var(--vscode-descriptionForeground); font-style: italic; opacity: 0.6; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px; border-top: 1px solid var(--vscode-panel-border); flex-shrink: 0; }
    .pagination button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 3px 10px; border-radius: 2px; cursor: pointer; font-size: 12px; }
    .pagination button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .pagination button:disabled { opacity: 0.4; cursor: default; }
    .pagination .page-info { color: var(--vscode-descriptionForeground); font-size: 12px; }

    /* Cell Editing */
    .cell-editable { cursor: pointer; }
    .cell-editable:hover { background: var(--vscode-list-hoverBackground); }
    .cell-editing { padding: 0 !important; background: var(--vscode-editor-background); outline: 2px solid var(--vscode-focusBorder); outline-offset: -2px; }
    .cell-edit-container { display: flex; flex-direction: column; }
    .cell-edit-row { display: flex; align-items: center; }
    .cell-edit-input { flex: 1; padding: 3px 12px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: none; outline: none; font-family: var(--vscode-font-family); font-size: 13px; box-sizing: border-box; min-width: 0; }
    .set-null-btn { flex-shrink: 0; padding: 3px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-left: 1px solid var(--vscode-panel-border); cursor: pointer; font-size: 10px; font-weight: 700; font-family: var(--vscode-font-family); letter-spacing: 0.5px; }
    .set-null-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .set-null-btn:disabled { opacity: 0.4; cursor: default; }
    .cell-edit-input:disabled { opacity: 0.6; }
    .cell-edit-error { padding: 2px 12px; font-size: 11px; color: var(--vscode-inputValidation-errorForeground, var(--vscode-errorForeground)); background: var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.1)); border-top: 1px solid var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); }

    /* Row Selection */
    .data-table tr.row-selected td { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
    .data-table tr.row-selected:hover td { background: var(--vscode-list-activeSelectionBackground); }
    .data-table tbody tr { cursor: pointer; }

    /* Delete Confirmation Bar */
    .delete-confirmation-bar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--vscode-inputValidation-warningBackground); border-bottom: 1px solid var(--vscode-inputValidation-warningBorder); flex-shrink: 0; font-size: 13px; }
    .delete-confirmation-bar.has-error { background: var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.1)); border-bottom-color: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); }
    .delete-error { color: var(--vscode-errorForeground); font-size: 12px; flex: 1; }

    /* New Row */
    .new-row td { background: var(--vscode-editor-background); border-bottom: none; }
    .new-row .cell-edit-input { width: 100%; }
    .new-row-actions td { padding: 4px 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .new-row-action-bar { display: flex; align-items: center; gap: 8px; }

    /* ER Diagram */
    .er-diagram-container { width: 100%; height: 100%; }
    .er-loading { display: flex; align-items: center; justify-content: center; height: 100%; gap: 8px; color: var(--vscode-descriptionForeground); }

    /* ReactFlow overrides */
    .react-flow__node { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
    .react-flow__background { background: var(--vscode-editor-background); }
    .react-flow__controls button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); }
    .react-flow__controls button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .react-flow__controls button svg { fill: currentColor; }

    /* Table Node (ER) */
    .table-node { background: var(--vscode-editorWidget-background, var(--vscode-editor-background)); border: 1px solid var(--vscode-panel-border); border-radius: 4px; min-width: 200px; overflow: hidden; }
    .table-node-selected { border-color: var(--vscode-focusBorder); box-shadow: 0 0 0 1px var(--vscode-focusBorder); }
    .table-node-header { background: var(--vscode-editorGroupHeader-tabsBackground); padding: 6px 10px; font-weight: 600; border-bottom: 1px solid var(--vscode-panel-border); }
    .table-node-columns { padding: 2px 0; }
    .table-node-column { display: flex; align-items: center; padding: 2px 10px; gap: 4px; position: relative; font-size: 12px; }
    .table-node-column:hover { background: var(--vscode-list-hoverBackground); }
    .table-node-icons { display: flex; gap: 2px; flex-shrink: 0; }
    .tn-icon { font-size: 8px; font-weight: 700; padding: 1px 3px; border-radius: 2px; }
    .tn-icon.pk { background: var(--vscode-symbolIcon-keyForeground, #d4a017); color: var(--vscode-editor-background); }
    .tn-icon.fk { background: var(--vscode-symbolIcon-referenceForeground, #a855f7); color: var(--vscode-editor-background); }
    .table-node-col-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .table-node-col-type { color: var(--vscode-descriptionForeground); font-size: 11px; flex-shrink: 0; }
    .table-handle { width: 6px !important; height: 6px !important; background: var(--vscode-editorLink-activeForeground, #4fc1ff) !important; border: none !important; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.currentWatcher?.dispose();
    this.sqliteService.close();
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
