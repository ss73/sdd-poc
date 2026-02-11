import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { TableInfo } from '../types';
import { TableNode, type TableNodeData } from './TableNode';

interface ErDiagramProps {
  tables: TableInfo[];
  onPreviewData: (tableName: string) => void;
}

const nodeTypes = { tableNode: TableNode };

const elk = new ELK();

const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.nodeNode': '40',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.edgeRouting': 'ORTHOGONAL',
};

// Estimate node dimensions based on column count
const NODE_WIDTH = 240;
const NODE_HEADER_HEIGHT = 32;
const NODE_COLUMN_HEIGHT = 24;

function estimateNodeHeight(table: TableInfo): number {
  return NODE_HEADER_HEIGHT + table.columns.length * NODE_COLUMN_HEIGHT + 8;
}

export function ErDiagram({ tables, onPreviewData }: ErDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layoutDone, setLayoutDone] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tableName: string;
  } | null>(null);

  // Build a set of columns that are FK targets across all tables
  const targetColumnsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        if (!map.has(fk.toTable)) {
          map.set(fk.toTable, new Set());
        }
        map.get(fk.toTable)!.add(fk.toColumn);
      }
    }
    return map;
  }, [tables]);

  // Compute layout with ELK and set nodes/edges
  useEffect(() => {
    if (tables.length === 0) {
      setLayoutDone(true);
      return;
    }

    const elkNodes: ElkNode[] = tables.map((table) => ({
      id: table.name,
      width: NODE_WIDTH,
      height: estimateNodeHeight(table),
    }));

    const elkEdges = tables.flatMap((table) =>
      table.foreignKeys.map((fk, i) => ({
        id: `${table.name}-${fk.fromColumn}-${fk.toTable}-${fk.toColumn}`,
        sources: [table.name],
        targets: [fk.toTable],
      }))
    );

    const graph: ElkNode = {
      id: 'root',
      layoutOptions: ELK_OPTIONS,
      children: elkNodes,
      edges: elkEdges,
    };

    elk
      .layout(graph)
      .then((layouted) => {
        const flowNodes: Node[] = (layouted.children || []).map((elkNode) => {
          const table = tables.find((t) => t.name === elkNode.id)!;
          const data: TableNodeData = {
            label: table.name,
            columns: table.columns,
            foreignKeys: table.foreignKeys,
            targetColumns: targetColumnsMap.get(table.name) || new Set(),
          };
          return {
            id: elkNode.id,
            type: 'tableNode',
            position: { x: elkNode.x || 0, y: elkNode.y || 0 },
            data,
          };
        });

        const flowEdges: Edge[] = tables.flatMap((table) =>
          table.foreignKeys.map((fk) => ({
            id: `edge-${table.name}.${fk.fromColumn}-${fk.toTable}.${fk.toColumn}`,
            source: table.name,
            sourceHandle: `${table.name}.${fk.fromColumn}`,
            target: fk.toTable,
            targetHandle: `${fk.toTable}.${fk.toColumn}`,
            type: 'smoothstep',
            animated: false,
            style: { stroke: 'var(--vscode-editorLink-activeForeground, #4fc1ff)', strokeWidth: 1.5 },
          }))
        );

        setNodes(flowNodes);
        setEdges(flowEdges);
        setLayoutDone(true);
      })
      .catch((err) => {
        console.error('ELK layout failed:', err);
        // Fallback: grid layout
        const flowNodes: Node[] = tables.map((table, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const data: TableNodeData = {
            label: table.name,
            columns: table.columns,
            foreignKeys: table.foreignKeys,
            targetColumns: targetColumnsMap.get(table.name) || new Set(),
          };
          return {
            id: table.name,
            type: 'tableNode',
            position: { x: col * 280, y: row * 300 },
            data,
          };
        });

        const flowEdges: Edge[] = tables.flatMap((table) =>
          table.foreignKeys.map((fk) => ({
            id: `edge-${table.name}.${fk.fromColumn}-${fk.toTable}.${fk.toColumn}`,
            source: table.name,
            sourceHandle: `${table.name}.${fk.fromColumn}`,
            target: fk.toTable,
            targetHandle: `${fk.toTable}.${fk.toColumn}`,
            type: 'smoothstep',
            animated: false,
          }))
        );

        setNodes(flowNodes);
        setEdges(flowEdges);
        setLayoutDone(true);
      });
  }, [tables, targetColumnsMap, setNodes, setEdges]);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, tableName: node.id });
    },
    []
  );

  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyName = useCallback((name: string) => {
    navigator.clipboard.writeText(name);
    setContextMenu(null);
  }, []);

  if (!layoutDone) {
    return (
      <div className="er-loading">
        <div className="spinner" />
        Computing layout...
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="placeholder">No tables found in this database.</div>
    );
  }

  return (
    <div className="er-diagram-container" onClick={() => setContextMenu(null)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls />
      </ReactFlow>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            position: 'fixed',
          }}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              setContextMenu(null);
              onPreviewData(contextMenu.tableName);
            }}
          >
            Preview Data
          </div>
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
