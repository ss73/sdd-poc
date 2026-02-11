import initSqlJs, { type Database } from 'sql.js';
import * as path from 'path';
import type { TableInfo, Column, Index, ForeignKey, DataPage } from './types';

export class SqliteService {
  private db: Database | null = null;
  private sqlPromise: Promise<initSqlJs.SqlJsStatic> | null = null;

  constructor(private wasmDir: string) {}

  private async getSql(): Promise<initSqlJs.SqlJsStatic> {
    if (!this.sqlPromise) {
      this.sqlPromise = initSqlJs({
        locateFile: (file: string) => path.join(this.wasmDir, file),
      });
    }
    return this.sqlPromise;
  }

  async openDatabase(fileBuffer: Uint8Array): Promise<void> {
    this.close();
    const SQL = await this.getSql();
    this.db = new SQL.Database(fileBuffer);
  }

  getSchema(): TableInfo[] {
    if (!this.db) {
      throw new Error('No database is open');
    }

    const tables: TableInfo[] = [];
    const tableNames = this.db.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    if (tableNames.length === 0 || tableNames[0].values.length === 0) {
      return [];
    }

    for (const row of tableNames[0].values) {
      const tableName = row[0] as string;
      tables.push({
        name: tableName,
        columns: this.getColumns(tableName),
        indexes: this.getIndexes(tableName),
        foreignKeys: this.getForeignKeys(tableName),
      });
    }

    return tables;
  }

  private getColumns(tableName: string): Column[] {
    if (!this.db) { return []; }
    const result = this.db.exec(`PRAGMA table_info("${tableName}")`);
    if (result.length === 0) { return []; }

    return result[0].values.map((row) => ({
      name: row[1] as string,
      type: (row[2] as string) || '',
      notNull: (row[3] as number) === 1,
      defaultValue: row[4] as string | null,
      primaryKey: (row[5] as number) > 0,
    }));
  }

  private getIndexes(tableName: string): Index[] {
    if (!this.db) { return []; }
    const result = this.db.exec(`PRAGMA index_list("${tableName}")`);
    if (result.length === 0) { return []; }

    return result[0].values
      .filter((row) => {
        // Filter out auto-indexes created for UNIQUE constraints
        const name = row[1] as string;
        return !name.startsWith('sqlite_autoindex_');
      })
      .map((row) => {
        const indexName = row[1] as string;
        const unique = (row[2] as number) === 1;
        return {
          name: indexName,
          unique,
          columns: this.getIndexColumns(indexName),
        };
      });
  }

  private getIndexColumns(indexName: string): string[] {
    if (!this.db) { return []; }
    const result = this.db.exec(`PRAGMA index_info("${indexName}")`);
    if (result.length === 0) { return []; }
    return result[0].values.map((row) => row[2] as string);
  }

  private getForeignKeys(tableName: string): ForeignKey[] {
    if (!this.db) { return []; }
    const result = this.db.exec(`PRAGMA foreign_key_list("${tableName}")`);
    if (result.length === 0) { return []; }

    return result[0].values.map((row) => ({
      fromColumn: row[3] as string,
      toTable: row[2] as string,
      toColumn: row[4] as string,
    }));
  }

  getRows(
    tableName: string,
    page: number,
    sortColumn: string | null,
    sortDirection: 'asc' | 'desc' | null
  ): DataPage {
    if (!this.db) {
      throw new Error('No database is open');
    }

    const pageSize = 50;
    const offset = page * pageSize;

    // Get columns for header
    const columns = this.getColumns(tableName).map((c) => c.name);

    // Build query with optional sorting
    let query = `SELECT * FROM "${tableName}"`;
    if (sortColumn && sortDirection) {
      query += ` ORDER BY "${sortColumn}" ${sortDirection === 'asc' ? 'ASC' : 'DESC'}`;
    }
    query += ` LIMIT ${pageSize} OFFSET ${offset}`;

    const result = this.db.exec(query);
    const rows = result.length > 0 ? result[0].values : [];

    const totalRows = this.getRowCount(tableName);

    return {
      tableName,
      columns,
      rows: rows as unknown[][],
      page,
      totalRows,
      sortColumn,
      sortDirection,
    };
  }

  getRowCount(tableName: string): number {
    if (!this.db) {
      throw new Error('No database is open');
    }
    const result = this.db.exec(`SELECT COUNT(*) as count FROM "${tableName}"`);
    if (result.length === 0) { return 0; }
    return result[0].values[0][0] as number;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
