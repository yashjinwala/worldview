'use client'
// The map (React Flow). A view of the conversation and your thinking — append-only,
// four node states + stale glow, dagre tree with the root at left (TDD §9).

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'

export interface WvNode {
  id: string
  parentId: string | null
  depth: number
  title: string
  status: string
  hasOpenLoop: boolean
  openLoopId?: string | null
  stale?: boolean
  hasArtifact?: boolean
}

interface NodeData extends Record<string, unknown> {
  node: WvNode
  isNew: boolean
  overview: boolean
  onPull: (n: WvNode) => void
  onSoftClose: (loopId: string) => void
}

const NODE_W = 185
const NODE_H = 46

function classFor(status: string): string {
  if (status === 'current') return 'mn mn-current'
  if (status === 'settled') return 'mn mn-settled'
  if (status === 'visited') return 'mn mn-visited'
  if (status === 'frontier') return 'mn mn-frontier'
  return 'mn mn-root'
}

function WorldviewNode({ data }: NodeProps<Node<NodeData>>) {
  const { node, isNew, overview, onPull, onSoftClose } = data
  const [menu, setMenu] = useState(false)
  const isRoot = node.parentId === null
  let cls = isRoot ? 'mn mn-root' : classFor(node.status)
  if (node.status === 'current' && node.stale) cls += ' stale'
  if (node.status === 'frontier' && isNew) cls += ' entering'
  if (overview) cls += ' mn-overview'

  return (
    <div
      className={cls}
      onClick={(e) => {
        e.stopPropagation()
        setMenu((m) => !m)
      }}
      title={node.title}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <span className="mn-title">
        {node.status === 'settled' && <span className="settled-check">✓</span>}
        {node.title}
      </span>
      {node.hasArtifact && <div className="artifact-pin" title="Artifact unlocked">◆</div>}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      {menu && !overview && (
        <div className="mn-menu" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              onPull(node)
              setMenu(false)
            }}
          >
            Pull this thread →
          </button>
          {node.hasOpenLoop && node.openLoopId && (
            <button
              onClick={() => {
                onSoftClose(node.openLoopId!)
                setMenu(false)
              }}
            >
              I&rsquo;ve settled this elsewhere
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const nodeTypes = { worldview: WorldviewNode }

function layout(nodes: WvNode[]): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', ranksep: 70, nodesep: 18, marginx: 24, marginy: 24 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H })
  for (const n of nodes) if (n.parentId) g.setEdge(n.parentId, n.id)
  dagre.layout(g)
  const pos: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) {
    const p = g.node(n.id)
    if (p) pos[n.id] = { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 }
  }
  return pos
}

const EDGE_STYLE: Record<string, { stroke: string; w: number; dash?: string }> = {
  settled: { stroke: 'rgba(61,122,82,0.32)', w: 1.5 },
  visited: { stroke: 'rgba(88,120,158,0.38)', w: 1.5 },
  current: { stroke: 'rgba(224,112,64,0.55)', w: 2 },
  frontier: { stroke: 'rgba(80,76,64,0.28)', w: 1, dash: '5 4' },
}

function MapInner({
  nodes,
  onPull,
  onSoftClose,
  overview,
}: {
  nodes: WvNode[]
  onPull: (n: WvNode) => void
  onSoftClose: (loopId: string) => void
  overview: boolean
}) {
  const { fitView, setCenter } = useReactFlow()
  const seen = useRef<Set<string>>(new Set())
  const positions = useMemo(() => layout(nodes), [nodes])

  const rfNodes: Node<NodeData>[] = useMemo(
    () =>
      nodes.map((n) => {
        const isNew = !seen.current.has(n.id)
        return {
          id: n.id,
          type: 'worldview',
          position: positions[n.id] ?? { x: 0, y: 0 },
          data: { node: n, isNew, overview, onPull, onSoftClose },
          draggable: false,
          connectable: false,
          selectable: false,
        }
      }),
    [nodes, positions, overview, onPull, onSoftClose]
  )

  const rfEdges: Edge[] = useMemo(
    () =>
      nodes
        .filter((n) => n.parentId)
        .map((n) => {
          const style = EDGE_STYLE[n.status] ?? EDGE_STYLE.frontier
          return {
            id: `${n.parentId}-${n.id}`,
            source: n.parentId!,
            target: n.id,
            type: 'bezier',
            style: { stroke: style.stroke, strokeWidth: style.w, strokeDasharray: style.dash },
          }
        }),
    [nodes]
  )

  // Keep current node + children in frame; track newly-seen ids for the materialize anim.
  useEffect(() => {
    const current = nodes.find((n) => n.status === 'current')
    if (current && positions[current.id] && !overview) {
      setCenter(positions[current.id].x + NODE_W / 2 + 120, positions[current.id].y + NODE_H / 2, { zoom: 0.95, duration: 500 })
    }
    const t = setTimeout(() => {
      for (const n of nodes) seen.current.add(n.id)
    }, 1700)
    return () => clearTimeout(t)
  }, [nodes, positions, overview, setCenter])

  useEffect(() => {
    if (overview) fitView({ duration: 400, padding: 0.15 })
  }, [overview, fitView, nodes.length])

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      panOnScroll
      minZoom={0.2}
      maxZoom={1.5}
    >
      <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="rgba(255,255,255,0.025)" />
    </ReactFlow>
  )
}

export default function MapPane({
  nodes,
  onPull,
  onSoftClose,
}: {
  nodes: WvNode[]
  onPull: (n: WvNode) => void
  onSoftClose: (loopId: string) => void
}) {
  const [overview, setOverview] = useState(false)
  const handlePull = useCallback(onPull, [onPull])
  const handleSoftClose = useCallback(onSoftClose, [onSoftClose])

  return (
    <div className="wv-map-pane">
      <button className={`overview-toggle${overview ? ' active' : ''}`} onClick={() => setOverview((o) => !o)}>
        {overview ? 'exit overview' : 'overview'}
      </button>
      <ReactFlowProvider>
        <MapInner nodes={nodes} onPull={handlePull} onSoftClose={handleSoftClose} overview={overview} />
      </ReactFlowProvider>
      <div className="map-legend">
        <div className="legend-row"><div className="legend-swatch" style={{ background: 'var(--color-ember)', boxShadow: '0 0 6px var(--color-ember-glow)' }} /><span>current · open loop</span></div>
        <div className="legend-row"><div className="legend-swatch" style={{ background: 'var(--color-s3)', border: '1px solid var(--color-border)' }} /><span>visited</span></div>
        <div className="legend-row"><div className="legend-swatch" style={{ background: 'rgba(61,122,82,0.18)', border: '1px solid rgba(61,122,82,0.4)' }} /><span>settled ✓</span></div>
        <div className="legend-row"><div className="legend-swatch" style={{ background: 'transparent', border: '1.5px dashed var(--color-text-ghost)', opacity: 0.6 }} /><span>frontier</span></div>
      </div>
    </div>
  )
}
