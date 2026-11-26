import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { Activity, Maximize2, Pause, Play, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import type { TrustEdge, TrustNode } from './api'

interface TrustTopologyProps {
  nodes: TrustNode[]
  edges: TrustEdge[]
  exploitProved?: boolean
  pumpState?: string | null
  activeVersion?: string | null
  theme?: 'light' | 'dark' | 'system'
  compact?: boolean
}

interface TrustNodeData extends Record<string, unknown> {
  zone: string
  label: string
  role: string
  cls: 'is-danger' | 'is-brand' | 'is-safe'
  extraStatus: string | null
  isPulsing: boolean
  isSelected: boolean
  width: number
  fullscreen: boolean
  onSelect: () => void
}

interface AnimatedEdgeData extends Record<string, unknown> {
  label: string
  boundary: boolean
  exploitProved: boolean
  isActiveStep: boolean
  isPlaying: boolean
}

const PIN_STYLE = {
  width: 7,
  height: 7,
  background: 'var(--brand)',
  border: '1.5px solid var(--surface)',
  opacity: 0.7,
}

function CustomTrustNode({ data }: NodeProps<Node<TrustNodeData>>) {
  return (
    <div
      className={`sim-flow-node ${data.cls} ${data.isPulsing ? 'is-pulse' : ''} ${data.isSelected ? 'is-selected' : ''}`}
      style={{ width: data.width }}
      onClick={data.onSelect}
    >
      <Handle id="left-t" type="target" position={Position.Left} isConnectable={false} style={PIN_STYLE} />
      <Handle id="left-s" type="source" position={Position.Left} isConnectable={false} style={PIN_STYLE} />
      <Handle id="right-t" type="target" position={Position.Right} isConnectable={false} style={PIN_STYLE} />
      <Handle id="right-s" type="source" position={Position.Right} isConnectable={false} style={PIN_STYLE} />
      <Handle id="top-t" type="target" position={Position.Top} isConnectable={false} style={PIN_STYLE} />
      <Handle id="top-s" type="source" position={Position.Top} isConnectable={false} style={PIN_STYLE} />
      <Handle id="bottom-t" type="target" position={Position.Bottom} isConnectable={false} style={PIN_STYLE} />
      <Handle id="bottom-s" type="source" position={Position.Bottom} isConnectable={false} style={PIN_STYLE} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            color: 'var(--ink-3)',
          }}
        >
          {data.zone}
        </span>
        {data.extraStatus ? (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: data.cls === 'is-danger' ? 'var(--bad)' : 'var(--brand)' }}>
            {data.extraStatus}
          </span>
        ) : data.isPulsing ? (
          <span className="sim-node-live-dot" title="Paket aktif" />
        ) : null}
      </div>
      <div style={{ fontWeight: 700, fontSize: data.fullscreen ? 14 : 13, lineHeight: 1.25 }}>{data.label}</div>
      <div style={{ fontSize: data.fullscreen ? 12 : 11.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.35 }}>
        {data.role}
      </div>
    </div>
  )
}

function AnimatedBoundaryEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<Edge<AnimatedEdgeData>>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 14,
  })

  const boundary = Boolean(data?.boundary)
  const exploitProved = Boolean(data?.exploitProved)
  const isActiveStep = Boolean(data?.isActiveStep)
  const isPlaying = data?.isPlaying !== false
  const strokeColor =
    exploitProved && boundary ? '#dc2626' : boundary ? '#16a34a' : isActiveStep ? '#2563eb' : '#64748b'
  const packetDur = exploitProved && boundary ? '1.35s' : boundary ? '1.85s' : '2.3s'

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={isPlaying ? 'sim-edge-flow' : undefined}
        style={{
          stroke: strokeColor,
          strokeWidth: isActiveStep ? 3 : boundary ? 2.4 : 1.7,
          strokeDasharray: isPlaying || boundary ? '7 5' : undefined,
          transition: 'stroke 0.25s ease, stroke-width 0.25s ease',
        }}
      />
      {isPlaying ? (
        <g aria-hidden="true">
          <circle r={isActiveStep ? 7.5 : 6} fill={strokeColor} opacity={0.22}>
            <animateMotion dur={packetDur} repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r={isActiveStep ? 4.2 : 3.5} fill={strokeColor}>
            <animateMotion dur={packetDur} repeatCount="indefinite" path={edgePath} />
          </circle>
        </g>
      ) : null}
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className={`sim-edge-pill ${boundary ? 'is-boundary' : ''} ${exploitProved && boundary ? 'is-danger' : ''} ${isActiveStep ? 'is-active' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {boundary ? <span className="sim-edge-tag">{exploitProved ? 'BYPASS' : 'BOUNDARY'}</span> : null}
            <span>{data.label}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

const NODE_TYPES = {
  trustNode: CustomTrustNode,
}

const EDGE_TYPES = {
  animatedFlow: AnimatedBoundaryEdge,
}

interface LayoutSlot {
  x: number
  y: number
}

function computeGraphLayout(
  nodes: TrustNode[],
  edges: TrustEdge[],
  fullscreen: boolean,
): { slots: Map<string, LayoutSlot>; isSerpentineChain: boolean } {
  const slots = new Map<string, LayoutSlot>()
  if (nodes.length === 0) return { slots, isSerpentineChain: false }

  const isSequentialChain =
    edges.length === nodes.length - 1 &&
    edges.every((e, i) => e.from === nodes[i]?.id && e.to === nodes[i + 1]?.id)

  const nodeW = fullscreen ? 232 : 202
  const horizGap = fullscreen ? 250 : 225
  const colPitch = nodeW + horizGap

  // Untuk rantai 3–4 simpul pada mode default (dan 4 simpul pada layar penuh), tata letak ular 2x2 membuat teks besar dan bebas terpotong.
  if (isSequentialChain && (nodes.length === 4 || (!fullscreen && nodes.length === 3))) {
    const rowPitch = fullscreen ? 240 : 210
    nodes.forEach((n, idx) => {
      const row = Math.floor(idx / 2)
      const colRaw = idx % 2
      const col = row % 2 === 1 ? 1 - colRaw : colRaw
      slots.set(n.id, { x: col * colPitch, y: row * rowPitch })
    })
    return { slots, isSerpentineChain: true }
  }

  // Untuk rantai 3 simpul di layar penuh: satu baris horizontal lega
  if (isSequentialChain && fullscreen && nodes.length <= 3) {
    nodes.forEach((n, idx) => {
      slots.set(n.id, { x: idx * colPitch, y: 0 })
    })
    return { slots, isSerpentineChain: false }
  }

  // Grafik DAG bercabang (mis. fan-in MQTT/Kupon atau fan-out XSS): kelompokkan per kedalaman topologis
  const depthMap = new Map<string, number>()
  nodes.forEach((n) => depthMap.set(n.id, 0))
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false
    for (const e of edges) {
      const dFrom = depthMap.get(e.from) ?? 0
      const dTo = depthMap.get(e.to) ?? 0
      if (dFrom + 1 > dTo) {
        depthMap.set(e.to, dFrom + 1)
        changed = true
      }
    }
    if (!changed) break
  }

  const columns = new Map<number, TrustNode[]>()
  for (const n of nodes) {
    const d = depthMap.get(n.id) ?? 0
    const bucket = columns.get(d) ?? []
    bucket.push(n)
    columns.set(d, bucket)
  }

  const rowPitch = fullscreen ? 195 : 175
  const maxRows = Math.max(...Array.from(columns.values()).map((c) => c.length), 1)
  const totalHeight = (maxRows - 1) * rowPitch

  for (const [colIdx, colNodes] of columns.entries()) {
    const colHeight = (colNodes.length - 1) * rowPitch
    const startY = (totalHeight - colHeight) / 2
    colNodes.forEach((n, rowIdx) => {
      slots.set(n.id, {
        x: colIdx * colPitch,
        y: startY + rowIdx * rowPitch,
      })
    })
  }

  return { slots, isSerpentineChain: false }
}

function chooseHandles(
  fromSlot: LayoutSlot | undefined,
  toSlot: LayoutSlot | undefined,
): { sourceHandle: string; targetHandle: string } {
  if (!fromSlot || !toSlot) {
    return { sourceHandle: 'right-s', targetHandle: 'left-t' }
  }
  const dx = toSlot.x - fromSlot.x
  const dy = toSlot.y - fromSlot.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right-s', targetHandle: 'left-t' }
      : { sourceHandle: 'left-s', targetHandle: 'right-t' }
  }
  return dy >= 0
    ? { sourceHandle: 'bottom-s', targetHandle: 'top-t' }
    : { sourceHandle: 'top-s', targetHandle: 'bottom-t' }
}

function AutoFitController({
  wrapRef,
  fullscreen,
  topologyKey,
}: {
  wrapRef: React.RefObject<HTMLDivElement | null>
  fullscreen: boolean
  topologyKey: string
}) {
  const { fitView } = useReactFlow()
  const initialized = useNodesInitialized()

  useEffect(() => {
    if (!initialized) return
    const id = window.requestAnimationFrame(() => {
      void fitView({
        padding: fullscreen ? 0.14 : 0.16,
        maxZoom: fullscreen ? 1.25 : 1.0,
        duration: 180,
      })
    })
    return () => window.cancelAnimationFrame(id)
  }, [initialized, fullscreen, topologyKey, fitView])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      void fitView({
        padding: fullscreen ? 0.14 : 0.16,
        maxZoom: fullscreen ? 1.25 : 1.0,
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [wrapRef, fullscreen, fitView])

  return null
}

function TopologyCanvas({
  nodes,
  edges,
  exploitProved,
  pumpState,
  activeVersion,
  theme,
  fullscreen,
  isPlaying,
  activeStepIdx,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: TrustNode[]
  edges: TrustEdge[]
  exploitProved: boolean
  pumpState: string | null
  activeVersion: string | null
  theme: 'light' | 'dark' | 'system'
  fullscreen: boolean
  isPlaying: boolean
  activeStepIdx: number
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const nodeW = fullscreen ? 232 : 202
  const layout = useMemo(() => computeGraphLayout(nodes, edges, fullscreen), [nodes, edges, fullscreen])
  const topologyKey = `${nodes.map((n) => n.id).join(',')}-${fullscreen ? 'full' : 'compact'}`

  const flowNodes = useMemo<Node<TrustNodeData>[]>(() => {
    return nodes.map((n, i) => {
      const lower = n.id.toLowerCase()
      const isDangerNode =
        exploitProved && (lower.includes('rogue') || lower.includes('db') || lower.includes('pump') || lower.includes('dom'))
      const isSafeBoundary =
        n.role.toLowerCase().includes('verif') ||
        n.role.toLowerCase().includes('acl') ||
        n.role.toLowerCase().includes('gate') ||
        n.zone.toLowerCase().includes('authorization') ||
        n.zone.toLowerCase().includes('policy')

      const extraStatus =
        lower.includes('pump') || lower.includes('aktuator')
          ? pumpState
            ? `Status: ${pumpState}`
            : null
          : lower.includes('esp') || lower.includes('boot')
            ? activeVersion
              ? `FW: ${activeVersion}`
              : null
            : null

      const cls = isDangerNode ? 'is-danger' : isSafeBoundary ? 'is-brand' : 'is-safe'
      const pos = layout.slots.get(n.id) ?? { x: i * 420, y: 0 }

      return {
        id: n.id,
        type: 'trustNode',
        position: pos,
        width: nodeW,
        draggable: true,
        data: {
          zone: n.zone,
          label: n.label,
          role: n.role,
          cls,
          extraStatus,
          isPulsing: isPlaying && activeStepIdx === i,
          isSelected: selectedNodeId === n.id,
          width: nodeW,
          fullscreen,
          onSelect: () => onSelectNode(n.id),
        },
      }
    })
  }, [
    nodes,
    layout.slots,
    nodeW,
    exploitProved,
    pumpState,
    activeVersion,
    isPlaying,
    activeStepIdx,
    selectedNodeId,
    fullscreen,
    onSelectNode,
  ])

  const flowEdges = useMemo<Edge<AnimatedEdgeData>[]>(() => {
    const activeNodeId = nodes[activeStepIdx]?.id
    return edges.map((e, idx) => {
      const boundary = Boolean(e.crosses_boundary ?? e.boundary)
      const isActiveStep = isPlaying && e.from === activeNodeId
      const strokeColor =
        exploitProved && boundary ? '#dc2626' : boundary ? '#16a34a' : isActiveStep ? '#2563eb' : '#64748b'
      const { sourceHandle, targetHandle } = chooseHandles(layout.slots.get(e.from), layout.slots.get(e.to))
      return {
        id: `edge-${idx}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        sourceHandle,
        targetHandle,
        type: 'animatedFlow',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
        data: {
          label: e.label,
          boundary,
          exploitProved,
          isActiveStep,
          isPlaying,
        },
      }
    })
  }, [edges, nodes, layout.slots, activeStepIdx, exploitProved, isPlaying])

  return (
    <div ref={wrapRef} className="sim-flow-canvas">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        forceColorMode={theme === 'system' ? undefined : theme}
        fitView
        fitViewOptions={{ padding: fullscreen ? 0.14 : 0.16, maxZoom: fullscreen ? 1.25 : 1.0 }}
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        elementsSelectable
      >
        <AutoFitController wrapRef={wrapRef} fullscreen={fullscreen} topologyKey={topologyKey} />
        <Background gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

export function TrustTopology({
  nodes,
  edges,
  exploitProved = false,
  pumpState = null,
  activeVersion = null,
  theme = 'light',
  compact = false,
}: TrustTopologyProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [activeStepIdx, setActiveStepIdx] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id ?? null)

  useEffect(() => {
    if (!isPlaying || nodes.length === 0) return
    const timer = window.setInterval(() => {
      setActiveStepIdx((prev) => (prev + 1) % nodes.length)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [isPlaying, nodes.length])

  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])

  const inspectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[activeStepIdx] ?? nodes[0] ?? null

  return (
    <>
      <div
        className="sim-flow-wrap"
        style={{ height: compact ? 390 : 420 }}
        aria-label="Diagram Topologi & Batas Kepercayaan"
      >
        <div className="sim-flow-toolbar">
          <span className="sim-flow-status">
            <Activity size={13} aria-hidden="true" />
            {isPlaying ? 'Aliran Paket Aktif' : 'Animasi Dijeda'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="sim-flow-toolbtn"
              onClick={() => setIsPlaying((v) => !v)}
              aria-pressed={isPlaying}
              title={isPlaying ? 'Jeda animasi aliran' : 'Putar animasi aliran'}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              {isPlaying ? 'Jeda' : 'Putar'}
            </button>
            <button
              type="button"
              className="sim-flow-toolbtn is-primary"
              onClick={() => setIsFullscreen(true)}
              aria-label="Buka peta tampilan penuh"
            >
              <Maximize2 size={13} /> Tampilan Penuh
            </button>
          </div>
        </div>

        <ReactFlowProvider>
          <TopologyCanvas
            nodes={nodes}
            edges={edges}
            exploitProved={exploitProved}
            pumpState={pumpState}
            activeVersion={activeVersion}
            theme={theme}
            fullscreen={false}
            isPlaying={isPlaying}
            activeStepIdx={activeStepIdx}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </ReactFlowProvider>
      </div>

      {isFullscreen ? (
        <div
          className="sim-topo-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="topo-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFullscreen(false)
          }}
        >
          <div className="sim-topo-modal">
            <header className="sim-topo-modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {exploitProved ? (
                  <ShieldAlert size={20} color="var(--bad)" aria-hidden="true" />
                ) : (
                  <ShieldCheck size={20} color="var(--good)" aria-hidden="true" />
                )}
                <div>
                  <h2 id="topo-modal-title" style={{ margin: 0, fontSize: 17 }}>
                    Peta Interaktif Trust Boundary &amp; Aliran Paket
                  </h2>
                  <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                    Klik simpul untuk inspeksi komponen, seret node untuk mengatur tata letak, atau gulir untuk zoom.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`sim-flow-badge ${exploitProved ? 'is-danger' : 'is-safe'}`}>
                  {exploitProved ? 'Celah Terbukti di Trust Boundary' : 'Batas Verifikasi Keamanan'}
                </span>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ minHeight: 34, fontSize: 13 }}
                  onClick={() => setIsPlaying((v) => !v)}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {isPlaying ? 'Jeda Animasi' : 'Putar Animasi'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ minHeight: 34, fontSize: 13 }}
                  onClick={() => setIsFullscreen(false)}
                  aria-label="Tutup peta tampilan penuh"
                >
                  <X size={15} /> Tutup
                </button>
              </div>
            </header>

            <div className="sim-topo-modal-canvas">
              <ReactFlowProvider>
                <TopologyCanvas
                  nodes={nodes}
                  edges={edges}
                  exploitProved={exploitProved}
                  pumpState={pumpState}
                  activeVersion={activeVersion}
                  theme={theme}
                  fullscreen
                  isPlaying={isPlaying}
                  activeStepIdx={activeStepIdx}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </ReactFlowProvider>
            </div>

            <footer className="sim-topo-modal-foot">
              <div className="sim-topo-legend">
                <span className="sim-legend-item">
                  <i className="sim-legend-dot is-safe" /> Klien / Aset
                </span>
                <span className="sim-legend-item">
                  <i className="sim-legend-dot is-brand" /> Gerbang Otorisasi
                </span>
                <span className="sim-legend-item">
                  <i className="sim-legend-dot is-boundary" /> Garis Trust Boundary
                </span>
                <span className="sim-legend-item">
                  <i className="sim-legend-dot is-danger" /> Titik Rawan Eksploit
                </span>
              </div>

              {inspectedNode ? (
                <div className="sim-topo-inspector">
                  <strong>{inspectedNode.label}</strong>
                  <span className="muted">
                    [{inspectedNode.zone}] — {inspectedNode.role}
                  </span>
                </div>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}
