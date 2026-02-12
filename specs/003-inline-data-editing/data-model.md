# Data Model: Inline Data Editing

**Feature**: 003-inline-data-editing
**Date**: 2026-02-12

## Entities

### CellEdit (transient, webview state)

Represents a cell currently being edited in the data grid. Only one cell can be in edit mode at a time.

| Field         | Type                  | Description                                    |
|---------------|-----------------------|------------------------------------------------|
| rowIndex      | number                | Row position within the current page (0-based) |
| colIndex      | number                | Column position (0-based)                      |
| columnName    | string                | Database column name                           |
| originalValue | unknown               | Value before editing began                     |
| currentValue  | string                | Current text input value                       |
| isSaving      | boolean               | Whether a save is in progress                  |
| error         | string \| null        | Inline error message from failed save          |

**Lifecycle**: Created on double-click → updated on keystrokes → destroyed on save/cancel.

### RowIdentifier (derived, computed per row)

The set of column-value pairs that uniquely identify a row for the UPDATE WHERE clause.

| Field          | Type                      | Description                                          |
|----------------|---------------------------|------------------------------------------------------|
| primaryKeys    | Record<string, unknown>   | Primary key column names mapped to their values      |
| usesRowid      | boolean                   | True if falling back to SQLite implicit rowid        |

**Source**: Derived from `TableInfo.columns` (pk flag) and the row's data. When no explicit PK exists, `rowid` is fetched alongside row data.

### UpdateRequest (message payload, webview → extension)

| Field           | Type                      | Description                                    |
|-----------------|---------------------------|------------------------------------------------|
| tableName       | string                    | Target table                                   |
| columnName      | string                    | Column being edited                            |
| newValue        | unknown                   | New value (or null for NULL)                   |
| rowIdentifier   | Record<string, unknown>   | PK or rowid values for WHERE clause            |

### UpdateResult (message payload, extension → webview)

| Field           | Type                      | Description                                    |
|-----------------|---------------------------|------------------------------------------------|
| success         | boolean                   | Whether the update succeeded                   |
| error           | string \| null            | Constraint violation message if failed         |
| updatedData     | DataPage \| null          | Refreshed page data if succeeded               |

## Relationships

```
CellEdit --uses--> RowIdentifier (to build UpdateRequest)
UpdateRequest --sent-to--> SchemaProvider (handles persistence)
SchemaProvider --returns--> UpdateResult (success or error)
UpdateResult --refreshes--> DataPage (current page re-fetched)
```

## Validation Rules

- **Non-editable cells**: BLOB columns and primary key columns cannot enter edit mode (FR-008)
- **NOT NULL constraint**: Empty value on a NOT NULL column → rejected by database, error surfaced
- **UNIQUE constraint**: Duplicate value on a UNIQUE column → rejected by database, error surfaced
- **Foreign key constraint**: Value not in referenced table → rejected by database, error surfaced
- **Referential integrity**: Changing a referenced value → rejected by database, error surfaced
- **Read-only file**: If database file is read-only or locked, edit mode is disabled entirely (FR-009)

## State Transitions

```
ReadOnly → EditMode (double-click on editable cell)
EditMode → Saving (Enter pressed or blur)
EditMode → ReadOnly (Escape pressed)
Saving → ReadOnly (save succeeded, data refreshed)
Saving → EditMode (save failed, error displayed)
```
