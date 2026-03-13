/**
 * contracts/csv-export-messages.ts
 *
 * Message protocol for the CSV export feature (006-export-csv).
 * These types extend the existing WebviewToExtensionMessage and
 * ExtensionToWebviewMessage union types in src/types.ts.
 */

// ── Webview → Extension ──────────────────────────────────────────────

/**
 * Sent when the user clicks "Export to CSV" in a query tab.
 * The webview already has all rows in memory (query results are not paginated
 * on the server — full result set was returned in query-result message).
 */
export interface ExportCsvQueryTabMessage {
  type: 'export-csv';
  requestId: string;
  payload: {
    source: 'query-tab';
    /** Column headers exactly as returned in QueryResultMessage.columns */
    columns: string[];
    /** All rows from the query result */
    rows: unknown[][];
    /** Suggested filename for the save dialog, e.g. "Query 1.csv" */
    suggestedFilename: string;
  };
}

/**
 * Sent when the user clicks "Export to CSV" in the data preview panel.
 * The extension fetches all rows directly from SQLite — the webview only
 * has the current page loaded.
 */
export interface ExportCsvTablePreviewMessage {
  type: 'export-csv';
  requestId: string;
  payload: {
    source: 'table-preview';
    /** The table to export */
    tableName: string;
    /** Suggested filename for the save dialog, e.g. "users.csv" */
    suggestedFilename: string;
  };
}

export type ExportCsvMessage =
  | ExportCsvQueryTabMessage
  | ExportCsvTablePreviewMessage;

// ── Extension → Webview ──────────────────────────────────────────────

/**
 * Sent after the export completes, fails, or is cancelled.
 * The webview uses this to re-enable the Export button.
 */
export interface ExportCsvResultMessage {
  type: 'export-csv-result';
  requestId: string;
  payload:
    | {
        status: 'success';
        /** Number of data rows written (excludes header row) */
        rowCount: number;
        /** Absolute path of the written file */
        filePath: string;
      }
    | {
        status: 'error';
        /** Human-readable error description */
        error: string;
      }
    | {
        status: 'cancelled';
      };
}
