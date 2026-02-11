import { useState, useMemo, useCallback } from 'react';
import type { TableInfo, Column, Index, ForeignKey } from '../types';

interface SchemaTreeProps {
  tables: TableInfo[];
  onPreviewData: (tableName: string) => void;
  selectedTable: string | null;
}

interface ExpandedState {
  [key: string]: boolean;
}

export function SchemaTree({ tables, onPreviewData, selectedTable }: SchemaTreeProps) {
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tableName: string;
  } | null>(null);

  const filteredTables = useMemo(() => {
    if (!filter.trim()) {
      return tables;
    }
    const lower = filter.toLowerCase();
    return tables.filter((table) => {
      if (table.name.toLowerCase().includes(lower)) {
        return true;
      }
      return table.columns.some((col) =>
        col.name.toLowerCase().includes(lower)
      );
    });
  }, [tables, filter]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tableName: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, tableName });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyName = useCallback((name: string) => {
    navigator.clipboard.writeText(name);
    setContextMenu(null);
  }, []);

  if (tables.length === 0) {
    return <div className="empty-state">No tables found in this database.</div>;
  }

  return (
    <div className="schema-tree" onClick={closeContextMenu}>
      <div className="search-box">
        <input
          type="text"
          placeholder="Filter tables and columns..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="search-input"
        />
        {filter && (
          <button className="clear-btn" onClick={() => setFilter('')}>
            x
          </button>
        )}
      </div>

      <div className="tree">
        {filteredTables.map((table) => (
          <TableNode
            key={table.name}
            table={table}
            expanded={expanded}
            filter={filter}
            onToggle={toggle}
            onContextMenu={handleContextMenu}
            onPreviewData={onPreviewData}
            isSelected={table.name === selectedTable}
          />
        ))}
        {filteredTables.length === 0 && filter && (
          <div className="empty-state">No matches for "{filter}"</div>
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className="context-menu-item"
            onClick={() => handleCopyName(contextMenu.tableName)}
          >
            Copy Table Name
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table Node ───────────────────────────────────────────────────────

interface TableNodeProps {
  table: TableInfo;
  expanded: ExpandedState;
  filter: string;
  onToggle: (key: string) => void;
  onContextMenu: (e: React.MouseEvent, tableName: string) => void;
  onPreviewData: (tableName: string) => void;
  isSelected: boolean;
}

function TableNode({
  table,
  expanded,
  filter,
  onToggle,
  onContextMenu,
  onPreviewData,
  isSelected,
}: TableNodeProps) {
  const tableKey = `table:${table.name}`;
  const isExpanded = expanded[tableKey] ?? false;
  const columnsKey = `cols:${table.name}`;
  const columnsExpanded = expanded[columnsKey] ?? true;
  const indexesKey = `idx:${table.name}`;
  const indexesExpanded = expanded[indexesKey] ?? false;

  // Determine which columns to highlight when filtering
  const lower = filter.toLowerCase();

  return (
    <div className="tree-node">
      <div
        className={`tree-row table-row${isSelected ? ' selected' : ''}`}
        onClick={() => { onToggle(tableKey); onPreviewData(table.name); }}
        onContextMenu={(e) => onContextMenu(e, table.name)}
      >
        <span className="chevron">{isExpanded ? '\u25BE' : '\u25B8'}</span>
        <span className="icon table-icon">T</span>
        <span className="label">{table.name}</span>
        <span className="badge">{table.columns.length} cols</span>
      </div>

      {isExpanded && (
        <div className="tree-children">
          {/* Columns section */}
          <div className="tree-node">
            <div
              className="tree-row section-row"
              onClick={() => onToggle(columnsKey)}
            >
              <span className="chevron">
                {columnsExpanded ? '\u25BE' : '\u25B8'}
              </span>
              <span className="label section-label">Columns</span>
            </div>
            {columnsExpanded && (
              <div className="tree-children">
                {table.columns.map((col) => (
                  <ColumnNode
                    key={col.name}
                    column={col}
                    foreignKeys={table.foreignKeys}
                    highlighted={
                      !!filter &&
                      col.name.toLowerCase().includes(lower)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Indexes section */}
          {table.indexes.length > 0 && (
            <div className="tree-node">
              <div
                className="tree-row section-row"
                onClick={() => onToggle(indexesKey)}
              >
                <span className="chevron">
                  {indexesExpanded ? '\u25BE' : '\u25B8'}
                </span>
                <span className="label section-label">
                  Indexes ({table.indexes.length})
                </span>
              </div>
              {indexesExpanded && (
                <div className="tree-children">
                  {table.indexes.map((idx) => (
                    <IndexNode key={idx.name} index={idx} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Foreign Keys section */}
          {table.foreignKeys.length > 0 && (
            <div className="tree-node">
              <div className="tree-row section-row">
                <span className="chevron-placeholder" />
                <span className="label section-label">
                  Foreign Keys ({table.foreignKeys.length})
                </span>
              </div>
              <div className="tree-children">
                {table.foreignKeys.map((fk, i) => (
                  <ForeignKeyNode key={i} fk={fk} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Column Node ──────────────────────────────────────────────────────

interface ColumnNodeProps {
  column: Column;
  foreignKeys: ForeignKey[];
  highlighted: boolean;
}

function ColumnNode({ column, foreignKeys, highlighted }: ColumnNodeProps) {
  const isFK = foreignKeys.some((fk) => fk.fromColumn === column.name);

  return (
    <div className={`tree-row column-row ${highlighted ? 'highlighted' : ''}`}>
      <span className="chevron-placeholder" />
      <span className="column-icons">
        {column.primaryKey && <span className="icon pk-icon" title="Primary Key">PK</span>}
        {isFK && <span className="icon fk-icon" title="Foreign Key">FK</span>}
        {column.notNull && !column.primaryKey && (
          <span className="icon nn-icon" title="NOT NULL">NN</span>
        )}
      </span>
      <span className="label">{column.name}</span>
      <span className="column-type">{column.type}</span>
    </div>
  );
}

// ── Index Node ───────────────────────────────────────────────────────

interface IndexNodeProps {
  index: Index;
}

function IndexNode({ index }: IndexNodeProps) {
  return (
    <div className="tree-row index-row">
      <span className="chevron-placeholder" />
      <span className="icon idx-icon">{index.unique ? 'UQ' : 'IX'}</span>
      <span className="label">{index.name}</span>
      <span className="index-columns">({index.columns.join(', ')})</span>
    </div>
  );
}

// ── Foreign Key Node ─────────────────────────────────────────────────

interface ForeignKeyNodeProps {
  fk: ForeignKey;
}

function ForeignKeyNode({ fk }: ForeignKeyNodeProps) {
  return (
    <div className="tree-row fk-row">
      <span className="chevron-placeholder" />
      <span className="icon fk-icon">FK</span>
      <span className="label">
        {fk.fromColumn} → {fk.toTable}.{fk.toColumn}
      </span>
    </div>
  );
}
