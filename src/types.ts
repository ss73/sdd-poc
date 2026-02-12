// ── Data Model Entities ──────────────────────────────────────────────

export interface Column {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

export interface Index {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface ForeignKey {
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface TableInfo {
  name: string;
  columns: Column[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
}

export interface DatabaseSchema {
  filePath: string;
  fileName: string;
  tables: TableInfo[];
}

export interface DataPage {
  tableName: string;
  columns: string[];
  rows: unknown[][];
  page: number;
  totalRows: number;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  primaryKeyColumns: string[];
  rowIdentifiers: Record<string, unknown>[];
  readOnly: boolean;
  editableColumns: string[];
  notNullColumns: string[];
  blobColumns: string[];
}

// ── Extension → Webview Messages ─────────────────────────────────────

export interface SchemaLoadedMessage {
  type: 'schema-loaded';
  payload: {
    fileName: string;
    filePath: string;
    tables: TableInfo[];
  };
}

export interface DataPageMessage {
  type: 'data-page';
  requestId: string;
  payload: DataPage;
}

export interface ErrorMessage {
  type: 'error';
  requestId?: string;
  payload: {
    message: string;
    action?: string;
  };
}

export interface DatabaseUnavailableMessage {
  type: 'database-unavailable';
  payload: {
    reason: 'deleted' | 'moved' | 'locked';
    message: string;
  };
}

export interface DatabaseChangedMessage {
  type: 'database-changed';
  payload: Record<string, never>;
}

export interface UpdateResultMessage {
  type: 'update-result';
  requestId: string;
  payload: {
    success: boolean;
    error: string | null;
    updatedData: DataPage | null;
  };
}

export interface DeleteResultMessage {
  type: 'delete-result';
  requestId: string;
  payload: {
    success: boolean;
    error: string | null;
    updatedData: DataPage | null;
  };
}

export interface InsertResultMessage {
  type: 'insert-result';
  requestId: string;
  payload: {
    success: boolean;
    error: string | null;
    updatedData: DataPage | null;
    insertedRowIndex: number | null;
  };
}

export interface QueryResultMessage {
  type: 'query-result';
  requestId: string;
  payload: {
    type: 'rows' | 'affected' | 'error';
    columns: string[];
    rows: unknown[][];
    affectedRows: number;
    error: string | null;
  };
}

// ── Webview → Extension Messages ─────────────────────────────────────

export interface RequestDataMessage {
  type: 'request-data';
  requestId: string;
  payload: {
    tableName: string;
    page: number;
    sortColumn: string | null;
    sortDirection: 'asc' | 'desc' | null;
  };
}

export interface ReloadDatabaseMessage {
  type: 'reload-database';
  payload: Record<string, never>;
}

export interface ShowErrorMessage {
  type: 'show-error';
  payload: {
    message: string;
  };
}

export interface UpdateCellMessage {
  type: 'update-cell';
  requestId: string;
  payload: {
    tableName: string;
    columnName: string;
    newValue: unknown;
    rowIdentifier: Record<string, unknown>;
  };
}

export interface DeleteRowMessage {
  type: 'delete-row';
  requestId: string;
  payload: {
    tableName: string;
    rowIdentifier: Record<string, unknown>;
  };
}

export interface InsertRowMessage {
  type: 'insert-row';
  requestId: string;
  payload: {
    tableName: string;
    columnValues: Record<string, unknown>;
  };
}

export interface ExecuteQueryMessage {
  type: 'execute-query';
  requestId: string;
  payload: {
    sql: string;
  };
}

// ── Union Types ──────────────────────────────────────────────────────

export type ExtensionToWebviewMessage =
  | SchemaLoadedMessage
  | DataPageMessage
  | ErrorMessage
  | DatabaseUnavailableMessage
  | DatabaseChangedMessage
  | UpdateResultMessage
  | DeleteResultMessage
  | InsertResultMessage
  | QueryResultMessage;

export type WebviewToExtensionMessage =
  | RequestDataMessage
  | ReloadDatabaseMessage
  | ShowErrorMessage
  | UpdateCellMessage
  | DeleteRowMessage
  | InsertRowMessage
  | ExecuteQueryMessage;

export type Message = ExtensionToWebviewMessage | WebviewToExtensionMessage;
