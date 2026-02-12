# Data Model: Custom Query Tabs

**Feature**: 005-custom-query-tabs
**Date**: 2026-02-12

## Entities

### QueryTab (transient, webview state)

Represents a single query workspace with its SQL text and execution results.

| Field        | Type                           | Description                                              |
|--------------|--------------------------------|----------------------------------------------------------|
| id           | string                         | Unique identifier (e.g., generated UUID or sequential)   |
| label        | string                         | Display label for the tab (e.g., "Query 1")              |
| query        | string                         | Current SQL text in the editor                           |
| result       | QueryResult \| null            | Result of the last execution, or null if not yet run     |
| isExecuting  | boolean                        | Whether a query is currently running                     |

**Lifecycle**: Created when user clicks "New Query" → populated as user types and executes → destroyed when tab is closed or viewer is closed.

### QueryResult (transient, webview state)

Represents the outcome of executing a SQL statement.

| Field        | Type                           | Description                                              |
|--------------|--------------------------------|----------------------------------------------------------|
| type         | 'rows' \| 'affected' \| 'error' | The kind of result                                      |
| columns      | string[]                       | Column names (only for type='rows')                      |
| rows         | unknown[][]                    | Row data as arrays (only for type='rows')                |
| affectedRows | number                         | Number of rows affected (only for type='affected')       |
| error        | string                         | Error message (only for type='error')                    |

**Lifecycle**: Created after each query execution → replaced on next execution → destroyed with parent QueryTab.

## Relationships

```
QueryTab --contains--> QueryResult (0..1, replaced on each execution)
QueryView --manages--> QueryTab[] (0..N, ordered by creation)
```

## State Transitions

### Query Tab
```
Empty → HasQuery (user types SQL)
HasQuery → Executing (user triggers execute)
Executing → HasResult (execution completes successfully)
Executing → HasError (execution fails)
HasResult → HasQuery (user modifies SQL text)
HasError → HasQuery (user modifies SQL text)
```

### Tab Collection
```
[] → [Tab1] (user opens first query tab)
[...tabs] → [...tabs, NewTab] (user opens another tab)
[...tabs] → tabs.filter(t => t.id !== closedId) (user closes a tab)
[...tabs] → [] (viewer closed — all tabs discarded)
```
