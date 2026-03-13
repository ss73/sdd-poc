/**
 * Formats tabular data as an RFC 4180-compliant CSV string.
 *
 * - Delimiter: comma (,)
 * - Line endings: CRLF (\r\n)
 * - Quoting: fields containing comma, double-quote, or newline are enclosed in "..."
 * - Escaping: " inside a quoted field becomes ""
 * - NULL (null/undefined) → empty field
 * - BLOB (Uint8Array/ArrayBuffer) → literal text (BLOB)
 * - All other values → String(value)
 */
export function formatCsv(columns: string[], rows: unknown[][]): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
      return '(BLOB)';
    }
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const lines: string[] = [];
  lines.push(columns.map(escape).join(','));
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
