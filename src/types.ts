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

// ── Union Types ──────────────────────────────────────────────────────

export type ExtensionToWebviewMessage =
  | SchemaLoadedMessage
  | DataPageMessage
  | ErrorMessage
  | DatabaseUnavailableMessage
  | DatabaseChangedMessage;

export type WebviewToExtensionMessage =
  | RequestDataMessage
  | ReloadDatabaseMessage
  | ShowErrorMessage;

export type Message = ExtensionToWebviewMessage | WebviewToExtensionMessage;
