import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Column, ForeignKey } from '../types';

export interface TableNodeData {
  label: string;
  columns: Column[];
  foreignKeys: ForeignKey[];
  /** Set of column names that are FK targets (other tables reference this column) */
  targetColumns: Set<string>;
}

type TableNodeProps = NodeProps & { data: TableNodeData };

export const TableNode = memo(function TableNode({ data, selected }: TableNodeProps) {
  return (
    <div className={`table-node ${selected ? 'table-node-selected' : ''}`}>
      <div className="table-node-header">
        {data.label}
      </div>
      <div className="table-node-columns">
        {data.columns.map((col, i) => {
          const isFK = data.foreignKeys.some(
            (fk) => fk.fromColumn === col.name
          );
          const isTarget = data.targetColumns.has(col.name);

          return (
            <div key={col.name} className="table-node-column">
              {/* Target handle — other FKs point here */}
              {isTarget && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`${data.label}.${col.name}`}
                  style={{ top: 'auto' }}
                  className="table-handle"
                />
              )}

              <span className="table-node-icons">
                {col.primaryKey && (
                  <span className="tn-icon pk">PK</span>
                )}
                {isFK && (
                  <span className="tn-icon fk">FK</span>
                )}
              </span>
              <span className="table-node-col-name">{col.name}</span>
              <span className="table-node-col-type">{col.type}</span>

              {/* Source handle — this FK points outward */}
              {isFK && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`${data.label}.${col.name}`}
                  style={{ top: 'auto' }}
                  className="table-handle"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
