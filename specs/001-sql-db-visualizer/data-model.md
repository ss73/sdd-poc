# Data Model: SQL Database Visualizer

**Branch**: `001-sql-db-visualizer` | **Date**: 2026-02-11

## Entities

### TableInfo

Represents a table in the SQLite database.

| Field       | Type     | Source                    | Notes                     |
|-------------|----------|---------------------------|---------------------------|
| name        | string   | `sqlite_master.name`      | Unique within the database |
| columns     | Column[] | `PRAGMA table_info(name)` | Ordered by column index   |
| indexes     | Index[]  | `PRAGMA index_list(name)` | All indexes on this table |
| foreignKeys | ForeignKey[] | `PRAGMA foreign_key_list(name)` | Outgoing FK references |

### Column

Represents a column within a table.

| Field      | Type    | Source                          | Notes                    |
|------------|---------|--------------------------------|--------------------------|
| name       | string  | `table_info.name`              |                          |
| type       | string  | `table_info.type`              | SQLite type affinity     |
| notNull    | boolean | `table_info.notnull`           |                          |
| defaultValue | string \| null | `table_info.dflt_value` |                          |
| primaryKey | boolean | `table_info.pk > 0`            | Part of PK if > 0       |

### Index

Represents an index on a table.

| Field    | Type     | Source                           | Notes                   |
|----------|----------|----------------------------------|-------------------------|
| name     | string   | `index_list.name`                |                         |
| unique   | boolean  | `index_list.unique`              |                         |
| columns  | string[] | `PRAGMA index_info(index_name)`  | Ordered column names    |

### ForeignKey

Represents a foreign key relationship from one table to another.

| Field        | Type   | Source                       | Notes                    |
|--------------|--------|------------------------------|--------------------------|
| fromColumn   | string | `foreign_key_list.from`      | Column in source table   |
| toTable      | string | `foreign_key_list.table`     | Referenced table name    |
| toColumn     | string | `foreign_key_list.to`        | Referenced column name   |

### DatabaseSchema

Top-level container for a loaded database's metadata.

| Field  | Type        | Source            | Notes                          |
|--------|-------------|-------------------|--------------------------------|
| filePath | string    | User selection    | Absolute path to .db file      |
| fileName | string    | Derived           | Display name (basename)        |
| tables | TableInfo[] | `sqlite_master`   | All tables (excludes internals)|

### DataPage

Result of a paginated data query.

| Field       | Type       | Source         | Notes                         |
|-------------|------------|----------------|-------------------------------|
| tableName   | string     | Query target   |                               |
| columns     | string[]   | Column headers | Ordered as in table           |
| rows        | any[][]    | Query result   | Row-major, 50 rows per page   |
| page        | number     | Request param  | 0-indexed                     |
| totalRows   | number     | `SELECT COUNT` | For pagination controls       |
| sortColumn  | string \| null | Request param | Currently sorted column    |
| sortDirection | 'asc' \| 'desc' \| null | Request param | Sort order     |

## SQLite Introspection Queries

### Load all tables
```sql
SELECT name FROM sqlite_master
WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name;
```

### Load columns for a table
```sql
PRAGMA table_info("table_name");
```

### Load indexes for a table
```sql
PRAGMA index_list("table_name");
```

### Load index columns
```sql
PRAGMA index_info("index_name");
```

### Load foreign keys for a table
```sql
PRAGMA foreign_key_list("table_name");
```

### Data preview query
```sql
SELECT * FROM "table_name"
ORDER BY "sort_column" ASC|DESC
LIMIT 50 OFFSET ?;
```

### Row count
```sql
SELECT COUNT(*) as count FROM "table_name";
```

## Relationships

```
DatabaseSchema 1──* TableInfo
TableInfo 1──* Column
TableInfo 1──* Index
TableInfo 1──* ForeignKey
ForeignKey *──1 TableInfo (toTable)
```

## State Transitions

The extension has a simple linear state model:

```
Idle → Loading → Loaded → Error
                   ↓
              FileChanged → Reloading → Loaded
                   ↓
              FileDeleted → Error (with guidance)
```

- **Idle**: No database open. Extension activated but waiting for file.
- **Loading**: File selected, sql.js reading and parsing.
- **Loaded**: Schema extracted, webview populated.
- **Error**: File could not be read. User sees actionable message.
- **FileChanged**: Watcher detected file modification. Auto-reload.
- **FileDeleted**: Watcher detected file removal. Show guidance.
