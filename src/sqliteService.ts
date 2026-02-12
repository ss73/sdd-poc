import { Database } from 'node-sqlite3-wasm';
import type { TableInfo, Column, Index, ForeignKey, DataPage } from './types';

export class SqliteService {
  private db: Database | null = null;

  private escapeId(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  openDatabase(filePath: string): void {
    this.close();
    this.db = new Database(filePath, { fileMustExist: true });
  }

  getSchema(): TableInfo[] {
    if (!this.db) {
      throw new Error('No database is open');
    }

    const tables: TableInfo[] = [];
    const tableRows = this.db.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ) as { name: string }[];

    for (const row of tableRows) {
      tables.push({
        name: row.name,
        columns: this.getColumns(row.name),
        indexes: this.getIndexes(row.name),
        foreignKeys: this.getForeignKeys(row.name),
      });
    }

    return tables;
  }

  private getColumns(tableName: string): Column[] {
    if (!this.db) { return []; }
    const rows = this.db.all(`PRAGMA table_info("${tableName}")`) as {
      name: string; type: string; notnull: number; dflt_value: string | null; pk: number;
    }[];

    return rows.map((row) => ({
      name: row.name,
      type: row.type || '',
      notNull: row.notnull === 1,
      defaultValue: row.dflt_value,
      primaryKey: row.pk > 0,
    }));
  }

  private getIndexes(tableName: string): Index[] {
    if (!this.db) { return []; }
    const rows = this.db.all(`PRAGMA index_list("${tableName}")`) as {
      name: string; unique: number;
    }[];

    return rows
      .filter((row) => !row.name.startsWith('sqlite_autoindex_'))
      .map((row) => ({
        name: row.name,
        unique: row.unique === 1,
        columns: this.getIndexColumns(row.name),
      }));
  }

  private getIndexColumns(indexName: string): string[] {
    if (!this.db) { return []; }
    const rows = this.db.all(`PRAGMA index_info("${indexName}")`) as { name: string }[];
    return rows.map((row) => row.name);
  }

  private getForeignKeys(tableName: string): ForeignKey[] {
    if (!this.db) { return []; }
    const rows = this.db.all(`PRAGMA foreign_key_list("${tableName}")`) as {
      from: string; table: string; to: string;
    }[];

    return rows.map((row) => ({
      fromColumn: row.from,
      toTable: row.table,
      toColumn: row.to,
    }));
  }

  getRows(
    tableName: string,
    page: number,
    sortColumn: string | null,
    sortDirection: 'asc' | 'desc' | null,
    readOnly = false
  ): DataPage {
    if (!this.db) {
      throw new Error('No database is open');
    }

    const pageSize = 50;
    const offset = page * pageSize;

    const allColumns = this.getColumns(tableName);
    const columns = allColumns.map((c) => c.name);
    let pkColumns = this.getPrimaryKeyColumns(tableName);
    let usesRowid = pkColumns.length === 1 && pkColumns[0] === 'rowid';
    let canEdit = true;

    // WITHOUT ROWID tables without explicit PK can't be edited
    if (usesRowid) {
      try {
        this.db.get(`SELECT rowid FROM ${this.escapeId(tableName)} LIMIT 0`);
      } catch {
        usesRowid = false;
        pkColumns = [];
        canEdit = false;
      }
    }

    const selectClause = usesRowid ? 'rowid, *' : '*';
    let query = `SELECT ${selectClause} FROM ${this.escapeId(tableName)}`;
    if (sortColumn && sortDirection) {
      query += ` ORDER BY ${this.escapeId(sortColumn)} ${sortDirection === 'asc' ? 'ASC' : 'DESC'}`;
    }
    query += ` LIMIT ${pageSize} OFFSET ${offset}`;

    const rowObjects = this.db.all(query) as Record<string, unknown>[];
    const rows = rowObjects.map((row) => columns.map((col) => row[col]));

    const rowIdentifiers = rowObjects.map((row) => {
      const id: Record<string, unknown> = {};
      for (const pk of pkColumns) {
        id[pk] = row[pk];
      }
      return id;
    });

    const totalRows = this.getRowCount(tableName);
    const editableColumns = canEdit
      ? allColumns
          .filter((c) => !c.primaryKey && c.type.toUpperCase() !== 'BLOB')
          .map((c) => c.name)
      : [];
    const notNullColumns = allColumns
      .filter((c) => c.notNull)
      .map((c) => c.name);
    const blobColumns = allColumns
      .filter((c) => c.type.toUpperCase() === 'BLOB')
      .map((c) => c.name);

    return {
      tableName,
      columns,
      rows,
      page,
      totalRows,
      sortColumn,
      sortDirection,
      primaryKeyColumns: pkColumns,
      rowIdentifiers,
      readOnly,
      editableColumns,
      notNullColumns,
      blobColumns,
    };
  }

  getRowCount(tableName: string): number {
    if (!this.db) {
      throw new Error('No database is open');
    }
    const row = this.db.get(`SELECT COUNT(*) as count FROM "${tableName}"`) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  getPrimaryKeyColumns(tableName: string): string[] {
    const columns = this.getColumns(tableName);
    const pkColumns = columns.filter((c) => c.primaryKey).map((c) => c.name);
    return pkColumns.length > 0 ? pkColumns : ['rowid'];
  }

  getEditableColumns(tableName: string): string[] {
    const columns = this.getColumns(tableName);
    return columns
      .filter((c) => !c.primaryKey && c.type.toUpperCase() !== 'BLOB')
      .map((c) => c.name);
  }

  updateCell(
    tableName: string,
    columnName: string,
    newValue: unknown,
    rowIdentifier: Record<string, unknown>
  ): void {
    if (!this.db) {
      throw new Error('No database is open');
    }

    const pkEntries = Object.entries(rowIdentifier);
    const whereClauses = pkEntries.map(([col]) => `${this.escapeId(col)} = ?`);
    const sql = `UPDATE ${this.escapeId(tableName)} SET ${this.escapeId(columnName)} = ? WHERE ${whereClauses.join(' AND ')}`;
    const params = [newValue, ...pkEntries.map(([, val]) => val)] as (string | number | null | Uint8Array | bigint)[];
    this.db.run(sql, params);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
