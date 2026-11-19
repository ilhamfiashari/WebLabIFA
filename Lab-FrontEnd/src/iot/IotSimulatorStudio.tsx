import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  AlignLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Code2,
  Cpu,
  Download,
  Expand,
  FileCode2,
  FileJson,
  Focus,
  FolderOpen,
  LayoutGrid,
  Minimize2,
  PanelLeftClose,
  Pencil,
  Pin,
  Plus,
  Save,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Badge, PageHead } from '../portal/ui'
import { useI18n } from '../shared/i18n'
import { simApi } from '../simulator/api'
import { BOARDS, COMPONENT_CATALOG, WIRE_COLORS, getBoardInstances, getComponentSpec, isBreadboardKind } from './boards'
import { CircuitCanvas } from './CircuitCanvas'
import { BoardThumbnail, PartThumbnail } from './CircuitSvgComponents'
import {
  applyAutocompleteItem,
  formatSuggestionSignature,
  getArduinoAutocomplete,
  getArduinoSignatureHelp,
  type AcSuggestion,
  type SignatureHelpResult,
} from './cppAutocomplete'
import {
  formatArduinoCpp,
  getLineCol,
  handleSmartBackspace,
  handleSmartClosingBrace,
  handleSmartEnter,
  handleSmartIndent,
  handleSmartPairOrClose,
} from './cppEditorHelpers'
import { tokenizeArduinoCpp } from './cppHighlight'
import {
  compileArduinoSketch,
  createInitialSimulation,
  createVmContext,
  defaultMcuSketch,
  stepLoop,
  stepSetup,
  verifyCircuitAndCode,
  type SketchFile,
  type VmContext,
} from './firmwareVm'
import { IOT_MISSIONS, IOT_PRESETS } from './presets'
import { TelemetryDock } from './TelemetryDock'
import {
  WOKWI_LIBRARY_REGISTRY,
  lintWokwiDiagram,
  parseWokwiDiagramJson,
  toWokwiDiagramJson,
} from './wokwiFormat'
import type {
  BoardId,
  CircuitDiagnosticItem,
  ComponentCategory,
  ComponentKind,
  PlacedComponent,
  SavedIotProject,
  SimulationState,
  Wire,
  WireEndpoint,
} from './types'
import './iot.css'

let uidCounter = 1
function nextUid(prefix: string): string {
  uidCounter += 1
  return `${prefix}-${uidCounter}`
}

const AC_KIND_GLYPHS: Record<AcSuggestion['kind'], string> = {
  fn: 'ƒ',
  method: '𝑚',
  kw: 'k',
  type: '𝑡',
  const: '𝑐',
  var: '𝑥',
  hdr: '#',
  snip: '□',
}

interface CircuitSnapshot {
  boardId: BoardId
  components: PlacedComponent[]
  wires: Wire[]
}

function cloneCircuitSnapshot(snap: CircuitSnapshot): CircuitSnapshot {
  return {
    boardId: snap.boardId,
    components: snap.components.map((c) => ({ ...c, props: { ...c.props } })),
    wires: snap.wires.map((w) => ({
      ...w,
      from: { ...w.from },
      to: { ...w.to },
      waypoints: w.waypoints?.map((wp) => ({ ...wp })),
    })),
  }
}

function useResolvedDarkTheme(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark',
  )
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => {
      setDark(el.dataset.theme === 'dark')
    })
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

export function IotSimulatorStudio({
  csrf,
  initialLabId,
  mode = 'mahasiswa',
}: {
  csrf: string
  initialLabId?: string | null
  mode?: 'mahasiswa' | 'dosen'
}) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const isDark = useResolvedDarkTheme()
  const qc = useQueryClient()

  const initialPreset = useMemo(() => {
    if (initialLabId) {
      const m = IOT_PRESETS.find((p) => p.missionId === initialLabId || p.id === initialLabId)
      if (m) return m
    }
    return IOT_PRESETS[0]
  }, [initialLabId])

  const [leftTab, setLeftTab] = useState<'code' | 'diagram' | 'libraries' | 'components' | 'terminal'>('code')
  const [boardId, setBoardId] = useState<BoardId>(initialPreset.board)
  const [activePresetId, setActivePresetId] = useState<string>(initialPreset.id)
  const [activeMissionId, setActiveMissionId] = useState<string | null>(initialPreset.missionId ?? null)
  const [projectTitle, setProjectTitle] = useState(en ? initialPreset.titleEn : initialPreset.titleId)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [code, setCode] = useState(initialPreset.code)
  const [components, setComponents] = useState<PlacedComponent[]>(initialPreset.components)
  const [wires, setWires] = useState<Wire[]>(initialPreset.wires)
  const [diagramText, setDiagramText] = useState('')
  const [diagramError, setDiagramError] = useState<string | null>(null)
  const [libSearch, setLibSearch] = useState('')
  const [wireColor, setWireColor] = useState(WIRE_COLORS[0].id)
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1)
  const [audioOn, setAudioOn] = useState(true)
  const [partSearch, setPartSearch] = useState('')
  const [partCategory, setPartCategory] = useState<'all' | ComponentCategory>('all')
  const [pinnedKinds, setPinnedKinds] = useState<ComponentKind[]>(['led', 'pushbutton'])
  const [showSavedDrawer, setShowSavedDrawer] = useState(false)
  const [focusMode, setFocusMode] = useState<'normal' | 'focus' | 'canvas'>('normal')
  const [splitWidth, setSplitWidth] = useState<number>(420)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<CircuitDiagnosticItem[] | null>(null)
  const [quickSerialInput, setQuickSerialInput] = useState('')

  const [simState, setSimState] = useState<SimulationState>(() =>
    createInitialSimulation(initialPreset.board, initialPreset.components, initialPreset.wires),
  )
  const [loopIterations, setLoopIterations] = useState(0)

  const studioRef = useRef<HTMLDivElement | null>(null)
  const workbenchRef = useRef<HTMLDivElement | null>(null)
  const vmRef = useRef<VmContext | null>(null)
  const liveCircuitRef = useRef<CircuitSnapshot>({
    boardId: initialPreset.board,
    components: initialPreset.components,
    wires: initialPreset.wires,
  })
  const circuitHistoryRef = useRef<{ past: CircuitSnapshot[]; future: CircuitSnapshot[] }>({ past: [], future: [] })
  const [historyCounts, setHistoryCounts] = useState<{ past: number; future: number }>({ past: 0, future: 0 })
  const gestureActiveRef = useRef(false)
  const gestureSnapshotRef = useRef<CircuitSnapshot | null>(null)
  const lastPropUndoRef = useRef<{ nodeId: string; at: number } | null>(null)
  const codeHistoryRef = useRef<
    Record<
      string,
      {
        past: Array<{ code: string; cursor: number }>
        future: Array<{ code: string; cursor: number }>
        lastTypedAt: number
      }
    >
  >({})

  useEffect(() => {
    liveCircuitRef.current = { boardId, components, wires }
  }, [boardId, components, wires])

  const syncHistoryCounts = () => {
    setHistoryCounts({
      past: circuitHistoryRef.current.past.length,
      future: circuitHistoryRef.current.future.length,
    })
  }

  const clearCircuitHistory = (nextSnap?: CircuitSnapshot) => {
    circuitHistoryRef.current = { past: [], future: [] }
    gestureActiveRef.current = false
    gestureSnapshotRef.current = null
    if (nextSnap) liveCircuitRef.current = nextSnap
    syncHistoryCounts()
  }

  const pushCircuitUndo = () => {
    if (gestureActiveRef.current) return
    const snap = cloneCircuitSnapshot(liveCircuitRef.current)
    circuitHistoryRef.current.past = [...circuitHistoryRef.current.past.slice(-79), snap]
    circuitHistoryRef.current.future = []
    syncHistoryCounts()
  }

  const beginCircuitGesture = () => {
    if (gestureActiveRef.current) return
    gestureActiveRef.current = true
    gestureSnapshotRef.current = cloneCircuitSnapshot(liveCircuitRef.current)
  }

  const endCircuitGesture = () => {
    if (!gestureActiveRef.current) return
    const before = gestureSnapshotRef.current
    gestureActiveRef.current = false
    gestureSnapshotRef.current = null
    if (!before) return
    if (JSON.stringify(before) !== JSON.stringify(liveCircuitRef.current)) {
      circuitHistoryRef.current.past = [...circuitHistoryRef.current.past.slice(-79), before]
      circuitHistoryRef.current.future = []
      syncHistoryCounts()
    }
  }

  const applyCircuitSnapshot = (target: CircuitSnapshot) => {
    const snap = cloneCircuitSnapshot(target)
    vmRef.current = null
    liveCircuitRef.current = snap
    setBoardId(snap.boardId)
    setComponents(snap.components)
    setWires(snap.wires)
    setDiagnostics(null)
    setSimState(createInitialSimulation(snap.boardId, snap.components, snap.wires))
  }

  const undoCircuit = () => {
    const h = circuitHistoryRef.current
    if (h.past.length === 0) return
    const prev = h.past[h.past.length - 1]
    h.past = h.past.slice(0, -1)
    h.future = [...h.future.slice(-79), cloneCircuitSnapshot(liveCircuitRef.current)]
    applyCircuitSnapshot(prev)
    syncHistoryCounts()
    setStatusNotice(en ? 'Undid circuit change (Ctrl+Z).' : 'Perubahan rangkaian dibatalkan (Undo).')
  }

  const redoCircuit = () => {
    const h = circuitHistoryRef.current
    if (h.future.length === 0) return
    const next = h.future[h.future.length - 1]
    h.future = h.future.slice(0, -1)
    h.past = [...h.past.slice(-79), cloneCircuitSnapshot(liveCircuitRef.current)]
    applyCircuitSnapshot(next)
    syncHistoryCounts()
    setStatusNotice(en ? 'Restored circuit change (Redo).' : 'Perubahan rangkaian dikembalikan (Redo).')
  }

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isFullscreen])

  const toggleFullscreen = () => {
    if (isFullscreen) {
      setIsFullscreen(false)
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {})
      }
      return
    }
    setIsFullscreen(true)
    if (focusMode === 'normal') {
      setFocusMode('focus')
    }
    void studioRef.current?.requestFullscreen?.().catch(() => {})
  }
  const componentsRef = useRef(components)
  const wiresRef = useRef(wires)
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileMenuRef = useRef<HTMLDivElement | null>(null)
  const uploadFilesInputRef = useRef<HTMLInputElement | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string>('board')
  const [extraFiles, setExtraFiles] = useState<SketchFile[]>([])
  const [activeCustomFile, setActiveCustomFile] = useState<string | null>(null)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [fileActionMode, setFileActionMode] = useState<'new' | 'rename' | null>(null)
  const [fileNameDraft, setFileNameDraft] = useState('')
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 })
  const [acState, setAcState] = useState<{
    replaceStart: number
    replaceEnd: number
    items: AcSuggestion[]
    activeIndex: number
    topPx: number
    leftPx: number
  } | null>(null)
  const [sigHelp, setSigHelp] = useState<(SignatureHelpResult & { topPx: number; leftPx: number }) | null>(null)

  useEffect(() => {
    if (!showFileMenu) return
    const onPointerDown = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setShowFileMenu(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [showFileMenu])

  const boardInstances = useMemo(() => getBoardInstances(boardId, components), [boardId, components])
  const activeEditingNodeId = boardInstances.some((b) => b.nodeId === editingNodeId) ? editingNodeId : 'board'
  const editingBoardSpec = boardInstances.find((b) => b.nodeId === activeEditingNodeId) ?? boardInstances[0]
  const activeCode =
    activeEditingNodeId === 'board'
      ? code
      : (components.find((c) => c.id === activeEditingNodeId)?.props.sketchCode ??
        defaultMcuSketch(editingBoardSpec.boardId, editingBoardSpec.label))

  const setActiveCode = (next: string) => {
    if (activeEditingNodeId === 'board') {
      setCode(next)
      return
    }
    setComponents((prev) =>
      prev.map((c) =>
        c.id === activeEditingNodeId ? { ...c, props: { ...c.props, sketchCode: next } } : c,
      ),
    )
  }

  const activeExtraFileObj = activeCustomFile
    ? (extraFiles.find((f) => f.name === activeCustomFile) ?? null)
    : null
  const displayedCode = activeExtraFileObj ? activeExtraFileObj.content : activeCode
  const setDisplayedCode = (next: string) => {
    if (activeExtraFileObj) {
      setExtraFiles((prev) =>
        prev.map((f) => (f.name === activeExtraFileObj.name ? { ...f, content: next } : f)),
      )
      return
    }
    setActiveCode(next)
  }

  const refreshSignatureHint = (nextCode: string, cursor: number | null) => {
    if (cursor === null || cursor < 0) {
      setSigHelp(null)
      return
    }
    const sig = getArduinoSignatureHelp(nextCode, cursor)
    if (!sig) {
      setSigHelp(null)
      return
    }
    const beforeLines = nextCode.slice(0, cursor).split('\n')
    const lineIdx = beforeLines.length - 1
    const colIdx = beforeLines[lineIdx]?.length ?? 0
    const topPx = lineIdx >= 4 ? Math.max(6, lineIdx * 19.375 - 78) : lineIdx * 19.375 + 34
    setSigHelp({
      ...sig,
      topPx,
      leftPx: Math.min(Math.max(8, colIdx * 7.5 + 10), 96),
    })
  }

  const refreshAutocomplete = (nextCode: string, cursor: number | null, force = false) => {
    refreshSignatureHint(nextCode, cursor)
    if (cursor === null || cursor < 0) {
      setAcState(null)
      return
    }
    const res = getArduinoAutocomplete(nextCode, cursor, force)
    if (!res) {
      setAcState(null)
      return
    }
    const beforeLines = nextCode.slice(0, cursor).split('\n')
    const lineIdx = beforeLines.length - 1
    const colIdx = beforeLines[lineIdx]?.length ?? 0
    setAcState({
      ...res,
      activeIndex: 0,
      topPx: lineIdx * 19.375 + 34,
      leftPx: Math.min(Math.max(8, colIdx * 7.5 + 10), 110),
    })
  }

  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null)
  const codeHistoryKey = activeExtraFileObj ? `file:${activeExtraFileObj.name}` : `mcu:${activeEditingNodeId}`

  const recordCodeHistory = (prevCode: string, prevCursor: number, coalesceTyping = false) => {
    const bucket = (codeHistoryRef.current[codeHistoryKey] ??= { past: [], future: [], lastTypedAt: 0 })
    const now = Date.now()
    if (coalesceTyping && bucket.past.length > 0 && now - bucket.lastTypedAt < 550) {
      bucket.lastTypedAt = now
      bucket.future = []
      return
    }
    bucket.past = [...bucket.past.slice(-99), { code: prevCode, cursor: prevCursor }]
    bucket.future = []
    bucket.lastTypedAt = coalesceTyping ? now : 0
  }

  const undoActiveCode = () => {
    const bucket = codeHistoryRef.current[codeHistoryKey]
    if (!bucket || bucket.past.length === 0) return
    const prev = bucket.past[bucket.past.length - 1]
    bucket.past = bucket.past.slice(0, -1)
    const curCursor = codeTextareaRef.current?.selectionStart ?? displayedCode.length
    bucket.future = [...bucket.future.slice(-99), { code: displayedCode, cursor: curCursor }]
    bucket.lastTypedAt = 0
    pendingSelectionRef.current = { start: prev.cursor, end: prev.cursor }
    setCursorPos(getLineCol(prev.code, prev.cursor))
    setAcState(null)
    if (codeTextareaRef.current) {
      codeTextareaRef.current.value = prev.code
      codeTextareaRef.current.setSelectionRange(prev.cursor, prev.cursor)
    }
    setDisplayedCode(prev.code)
  }

  const redoActiveCode = () => {
    const bucket = codeHistoryRef.current[codeHistoryKey]
    if (!bucket || bucket.future.length === 0) return
    const next = bucket.future[bucket.future.length - 1]
    bucket.future = bucket.future.slice(0, -1)
    const curCursor = codeTextareaRef.current?.selectionStart ?? displayedCode.length
    bucket.past = [...bucket.past.slice(-99), { code: displayedCode, cursor: curCursor }]
    bucket.lastTypedAt = 0
    pendingSelectionRef.current = { start: next.cursor, end: next.cursor }
    setCursorPos(getLineCol(next.code, next.cursor))
    setAcState(null)
    if (codeTextareaRef.current) {
      codeTextareaRef.current.value = next.code
      codeTextareaRef.current.setSelectionRange(next.cursor, next.cursor)
    }
    setDisplayedCode(next.code)
  }

  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current
    const ta = codeTextareaRef.current
    if (pending && ta) {
      ta.setSelectionRange(pending.start, pending.end)
      pendingSelectionRef.current = null
    }
  }, [displayedCode])

  const applyEditorMutation = (nextCode: string, selStart: number, selEnd = selStart, runAc = false) => {
    setCursorPos(getLineCol(nextCode, selStart))
    if (runAc) refreshAutocomplete(nextCode, selStart, false)
    else {
      setAcState(null)
      refreshSignatureHint(nextCode, selStart)
    }
    const ta = codeTextareaRef.current
    if (nextCode === displayedCode) {
      if (ta) {
        ta.focus()
        ta.setSelectionRange(selStart, selEnd)
      }
      return
    }
    recordCodeHistory(displayedCode, ta?.selectionStart ?? selStart, false)
    pendingSelectionRef.current = { start: selStart, end: selEnd }
    if (ta) {
      ta.value = nextCode
      ta.setSelectionRange(selStart, selEnd)
    }
    setDisplayedCode(nextCode)
  }

  const formatSketchCode = () => {
    const formatted = formatArduinoCpp(displayedCode)
    applyEditorMutation(formatted, Math.min(formatted.length, codeTextareaRef.current?.selectionStart ?? 0))
    setStatusNotice(en ? 'Code auto-indented cleanly.' : 'Kode dirapikan dengan auto-indent.')
  }

  const acceptAutocomplete = (item: AcSuggestion) => {
    if (!acState) return
    const { nextCode, nextCursor } = applyAutocompleteItem(displayedCode, acState.replaceStart, acState.replaceEnd, item)
    applyEditorMutation(nextCode, nextCursor)
  }

  const normalizeSketchFileName = (raw: string): string => {
    const clean = raw.trim().replace(/[/\\]/g, '')
    if (!clean) return ''
    if (!clean.includes('.')) return `${clean}.h`
    return clean
  }

  const starterContentForFile = (fileName: string): string => {
    const lower = fileName.toLowerCase()
    if (lower.endsWith('.h') || lower.endsWith('.hpp')) {
      return `// ${fileName}\n// Definisi pin, konstanta, atau helper untuk di-#include di Main.ino\n`
    }
    if (lower.endsWith('.cpp') || lower.endsWith('.c')) {
      return `#include <Arduino.h>\n\n`
    }
    return `// ${fileName}\n`
  }

  const commitFileAction = () => {
    const normalized = normalizeSketchFileName(fileNameDraft)
    if (!normalized || normalized.toLowerCase() === 'main.ino') {
      setStatusNotice(en ? 'Provide a valid filename other than Main.ino.' : 'Masukkan nama file yang valid selain Main.ino.')
      return
    }
    if (fileActionMode === 'new') {
      const existing = extraFiles.find((f) => f.name.toLowerCase() === normalized.toLowerCase())
      if (existing) {
        setLeftTab('code')
        setActiveCustomFile(existing.name)
        setFileActionMode(null)
        setFileNameDraft('')
        setStatusNotice(en ? `Opened existing file ${existing.name}.` : `Membuka file ${existing.name}.`)
        return
      }
      setExtraFiles((prev) => [...prev, { name: normalized, content: starterContentForFile(normalized) }])
      setLeftTab('code')
      setActiveCustomFile(normalized)
      setFileActionMode(null)
      setFileNameDraft('')
      setAcState(null)
      setStatusNotice(
        en
          ? `Created ${normalized}. Include it via #include "${normalized}".`
          : `File ${normalized} dibuat. Panggil di sketch dengan #include "${normalized}".`,
      )
      return
    }
    if (fileActionMode === 'rename' && activeExtraFileObj) {
      const conflict = extraFiles.some(
        (f) => f.name.toLowerCase() === normalized.toLowerCase() && f.name !== activeExtraFileObj.name,
      )
      if (conflict) {
        setStatusNotice(en ? `File "${normalized}" already exists.` : `File "${normalized}" sudah ada.`)
        return
      }
      const oldName = activeExtraFileObj.name
      setExtraFiles((prev) => prev.map((f) => (f.name === oldName ? { ...f, name: normalized } : f)))
      setActiveCustomFile(normalized)
      setFileActionMode(null)
      setFileNameDraft('')
      setStatusNotice(en ? `Renamed ${oldName} to ${normalized}.` : `Nama file ${oldName} diubah menjadi ${normalized}.`)
    }
  }

  const deleteActiveCustomFile = () => {
    if (!activeExtraFileObj) return
    const target = activeExtraFileObj.name
    setExtraFiles((prev) => prev.filter((f) => f.name !== target))
    setActiveCustomFile(null)
    setShowFileMenu(false)
    setFileActionMode(null)
    setStatusNotice(en ? `Deleted ${target}.` : `File ${target} dihapus.`)
  }

  const handleUploadExtraFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const loaded: SketchFile[] = []
    for (const file of Array.from(files)) {
      const cleanName = normalizeSketchFileName(file.name)
      if (!cleanName || cleanName.toLowerCase() === 'main.ino') continue
      const content = await file.text()
      loaded.push({ name: cleanName, content })
    }
    if (loaded.length === 0) return
    setExtraFiles((prev) => {
      const next = [...prev]
      for (const item of loaded) {
        const idx = next.findIndex((f) => f.name.toLowerCase() === item.name.toLowerCase())
        if (idx >= 0) next[idx] = item
        else next.push(item)
      }
      return next
    })
    setLeftTab('code')
    setActiveCustomFile(loaded[0].name)
    setStatusNotice(
      en
        ? `Uploaded ${loaded.length} file(s): ${loaded.map((f) => f.name).join(', ')}.`
        : `${loaded.length} file berhasil diunggah: ${loaded.map((f) => f.name).join(', ')}.`,
    )
  }
  useEffect(() => {
    componentsRef.current = components
  }, [components])
  useEffect(() => {
    wiresRef.current = wires
  }, [wires])

  const projectsQ = useQuery({
    queryKey: ['iot-projects'],
    queryFn: () => simApi.listIotProjects(),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () =>
      simApi.saveIotProject(csrf, {
        id: activeProjectId ?? undefined,
        title: projectTitle.trim() || 'ESP32 Project',
        board: boardId,
        mission_id: activeMissionId,
        code,
        components,
        wires,
      }),
    onSuccess: async (res) => {
      setActiveProjectId(res.id)
      setStatusNotice(en ? `Project "${res.title}" saved to database.` : `Proyek "${res.title}" berhasil disimpan ke database.`)
      await qc.invalidateQueries({ queryKey: ['iot-projects'] })
    },
    onError: () => {
      setStatusNotice(en ? 'Could not save project. Check session or payload size.' : 'Gagal menyimpan proyek. Periksa sesi Anda.')
    },
  })

  const deleteProjMut = useMutation({
    mutationFn: (id: string) => simApi.deleteIotProject(csrf, id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['iot-projects'] })
    },
  })

  const activeMission = useMemo(
    () => IOT_MISSIONS.find((m) => m.id === activeMissionId) ?? null,
    [activeMissionId],
  )

  const missionChecks = useMemo(() => {
    if (!activeMission) return []
    return activeMission.evaluate({ board: boardId, code, components, wires, sim: simState, loopIterations })
  }, [activeMission, boardId, code, components, wires, simState, loopIterations])

  const allMissionPassed = missionChecks.length > 0 && missionChecks.every((c) => c.passed)

  const submitMissionMut = useMutation({
    mutationFn: () => {
      if (!activeMission) throw new Error('No mission selected')
      const hasOledOutput = Object.values(simState.oledLines).some((lines) => lines.length > 0)
      const mqttTlsVerified =
        simState.mqttMessages.length > 0 && simState.mqttMessages.every((m) => m.tls)
      return simApi.submitIotMission(csrf, {
        mission_id: activeMission.id,
        board: boardId,
        code,
        components: components.map((c) => ({ id: c.id, kind: c.kind })),
        wires: wires.map((w) => ({ from: w.from, to: w.to })),
        component_count: components.length,
        wire_count: wires.length,
        checks_passed: missionChecks.filter((c) => c.passed).length,
        checks_total: missionChecks.length,
        has_hardware_alerts: simState.alerts.length > 0,
        loop_iterations: loopIterations,
        has_serial_output: simState.serialLog.length > 0,
        has_oled_output: hasOledOutput,
        mqtt_tls_verified: mqttTlsVerified,
      })
    },
    onSuccess: async (res) => {
      const unlockedText =
        res.newly_unlocked && res.newly_unlocked.length > 0
          ? en
            ? ` · Achievement unlocked: ${res.newly_unlocked.join(', ')}`
            : ` · Lencana terbuka: ${res.newly_unlocked.join(', ')}`
          : ''
      setStatusNotice(
        en
          ? `Mission verified! Score ${res.score}/100 recorded (+${res.xp_awarded} XP)${unlockedText}.`
          : `Misi berhasil diverifikasi! Skor ${res.score}/100 tercatat (+${res.xp_awarded} XP)${unlockedText}.`,
      )
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['iot-projects'] }),
        qc.invalidateQueries({ queryKey: ['student-dashboard'] }),
        qc.invalidateQueries({ queryKey: ['student-leaderboard'] }),
        qc.invalidateQueries({ queryKey: ['instructor-dashboard'] }),
      ])
    },
  })

  const audioCtxRef = useRef<AudioContext | null>(null)
  const buzzerSoundRef = useRef<{ osc: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null>(null)
  const audioOnRef = useRef(audioOn)
  const immediateStepQueuedRef = useRef(false)

  useEffect(() => {
    audioOnRef.current = audioOn
  }, [audioOn])

  const stopBuzzerSound = useCallback(() => {
    const node = buzzerSoundRef.current
    if (!node) return
    try {
      node.gain.gain.setTargetAtTime(0, node.gain.context.currentTime, 0.008)
      node.osc.stop(node.gain.context.currentTime + 0.025)
    } catch {
      // ignore already-stopped oscillator
    }
    buzzerSoundRef.current = null
  }, [])

  const syncBuzzerAudio = useCallback((
    buzzerMap: Record<string, { freq: number; active: boolean }>,
    isRunning: boolean,
    isAudioOn: boolean,
  ) => {
    const entry = Object.entries(buzzerMap).find(([, b]) => b.active)
    if (!isAudioOn || !isRunning || !entry) {
      stopBuzzerSound()
      return
    }
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state === 'closed') return
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {})
    }
    const [buzzId, active] = entry
    const comp = componentsRef.current.find((c) => c.id === buzzId)
    const freq = Math.max(80, Math.min(4000, active.freq || 1000))
    const vol = Math.max(0.01, Math.min(1, comp?.props.buzzerVolume ?? 1))
    const isAccurate = comp?.props.buzzerMode === 'accurate'
    const filterFreq = isAccurate ? 12000 : 2600

    try {
      if (!buzzerSoundRef.current) {
        const osc = ctx.createOscillator()
        const filter = ctx.createBiquadFilter()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(filterFreq, ctx.currentTime)
        gain.gain.setValueAtTime(0.22 * vol, ctx.currentTime)
        osc.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        buzzerSoundRef.current = { osc, filter, gain }
      } else {
        const { osc, filter, gain } = buzzerSoundRef.current
        osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.006)
        filter.frequency.setTargetAtTime(filterFreq, ctx.currentTime, 0.006)
        gain.gain.setTargetAtTime(0.22 * vol, ctx.currentTime, 0.006)
      }
    } catch {
      stopBuzzerSound()
    }
  }, [stopBuzzerSound])

  const unlockAudio = (): AudioContext | null => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        void ctx
          .resume()
          .then(() => {
            const vm = vmRef.current
            if (vm?.sim.running) syncBuzzerAudio(vm.sim.buzzerActive, true, audioOnRef.current)
          })
          .catch(() => {})
      }
      return ctx
    } catch {
      return null
    }
  }

  const triggerImmediateVmStep = () => {
    if (immediateStepQueuedRef.current || !vmRef.current) return
    immediateStepQueuedRef.current = true
    queueMicrotask(() => {
      immediateStepQueuedRef.current = false
      const vm = vmRef.current
      if (!vm || !vm.sim.running) return
      const cur = liveCircuitRef.current
      stepLoop(vm, cur.components, cur.wires)
      syncBuzzerAudio(vm.sim.buzzerActive, true, audioOnRef.current)
      setLoopIterations(vm.loopIterations)
      setSimState({ ...vm.sim, running: true })
    })
  }

  useEffect(() => {
    syncBuzzerAudio(simState.buzzerActive, simState.running, audioOn)
  }, [audioOn, simState.running, simState.buzzerActive, syncBuzzerAudio])

  useEffect(() => {
    return () => {
      stopBuzzerSound()
      try {
        void audioCtxRef.current?.close()
      } catch {
        // ignore close error
      }
    }
  }, [stopBuzzerSound])

  useEffect(() => {
    if (!simState.running) return
    let cancelled = false
    let timerId = 0

    const tick = () => {
      if (cancelled || !vmRef.current) return
      const nextDelay = stepLoop(vmRef.current, componentsRef.current, wiresRef.current)
      syncBuzzerAudio(vmRef.current.sim.buzzerActive, true, audioOnRef.current)
      setLoopIterations(vmRef.current.loopIterations)
      setSimState({ ...vmRef.current.sim, running: true })
      timerId = window.setTimeout(tick, Math.max(70, Math.round(nextDelay / speed)))
    }

    timerId = window.setTimeout(tick, Math.round(160 / speed))
    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [simState.running, speed, syncBuzzerAudio])

  const availablePresets = useMemo(
    () => IOT_PRESETS.filter((p) => !p.dosenOnly || mode === 'dosen'),
    [mode],
  )
  const corePresets = useMemo(() => availablePresets.filter((p) => !p.dosenOnly), [availablePresets])
  const dosenShowcasePresets = useMemo(() => availablePresets.filter((p) => Boolean(p.dosenOnly)), [availablePresets])

  const loadPreset = (presetId: string) => {
    const preset = availablePresets.find((p) => p.id === presetId)
    if (!preset) return
    vmRef.current = null
    clearCircuitHistory({ boardId: preset.board, components: preset.components, wires: preset.wires })
    codeHistoryRef.current = {}
    setBoardId(preset.board)
    setEditingNodeId('board')
    setExtraFiles([])
    setActiveCustomFile(null)
    setFileActionMode(null)
    setAcState(null)
    setActivePresetId(preset.id)
    setActiveMissionId(preset.missionId ?? null)
    setActiveProjectId(null)
    setProjectTitle(en ? preset.titleEn : preset.titleId)
    setCode(preset.code)
    setComponents(preset.components)
    setWires(preset.wires)
    setLoopIterations(0)
    setDiagnostics(null)
    setSimState(createInitialSimulation(preset.board, preset.components, preset.wires))
    setStatusNotice(null)
  }

  const switchBoard = (nextBoard: BoardId) => {
    pushCircuitUndo()
    const nextComps = liveCircuitRef.current.components.map((c) =>
      c.kind === 'mcu' && c.id === 'board'
        ? { ...c, boardId: nextBoard, label: BOARDS[nextBoard].shortName }
        : c,
    )
    liveCircuitRef.current = { ...liveCircuitRef.current, boardId: nextBoard, components: nextComps }
    setBoardId(nextBoard)
    setComponents(nextComps)
    vmRef.current = null
    setDiagnostics(null)
    setSimState(createInitialSimulation(nextBoard, nextComps, liveCircuitRef.current.wires))
  }

  const addExtraBoard = (extraBoard: BoardId) => {
    pushCircuitUndo()
    const cur = liveCircuitRef.current
    const existingExtras = cur.components.filter((c) => c.kind === 'mcu' && c.id !== 'board')
    const idx = existingExtras.length + 2
    const slot = existingExtras.length
    const spec = BOARDS[extraBoard]
    const label = `${spec.shortName} #${idx}`
    const newMcu: PlacedComponent = {
      id: nextUid('mcu'),
      kind: 'mcu',
      boardId: extraBoard,
      x: 310 + (slot % 2) * 280,
      y: 76 + Math.floor(slot / 2) * 200,
      label,
      props: {
        sketchCode: defaultMcuSketch(extraBoard, label),
      },
    }
    const nextComps = [...cur.components, newMcu]
    liveCircuitRef.current = { ...cur, components: nextComps }
    setComponents(nextComps)
    setEditingNodeId(newMcu.id)
    setSimState((prev) => ({ ...prev, ...createInitialSimulation(cur.boardId, nextComps, cur.wires), running: prev.running }))
    setStatusNotice(
      en
        ? `${label} added (${1 + existingExtras.length + 1} MCUs on canvas).`
        : `${label} ditambahkan (${1 + existingExtras.length + 1} mikrokontroler di kanvas).`,
    )
  }

  const moveBoardOrComponent = (nodeId: string, x: number, y: number) => {
    const cur = liveCircuitRef.current
    let nextComps: PlacedComponent[]
    if (nodeId === 'board') {
      const hasPrimary = cur.components.some((c) => c.kind === 'mcu' && c.id === 'board')
      nextComps = hasPrimary
        ? cur.components.map((c) => (c.kind === 'mcu' && c.id === 'board' ? { ...c, x, y } : c))
        : [
            ...cur.components,
            { id: 'board', kind: 'mcu', boardId: cur.boardId, x, y, label: BOARDS[cur.boardId].shortName, props: {} },
          ]
    } else {
      nextComps = cur.components.map((c) => (c.id === nodeId ? { ...c, x, y } : c))
    }
    liveCircuitRef.current = { ...cur, components: nextComps }
    setComponents(nextComps)
  }

  const loadSavedProject = (p: SavedIotProject) => {
    vmRef.current = null
    clearCircuitHistory({ boardId: p.board, components: p.components, wires: p.wires })
    codeHistoryRef.current = {}
    setBoardId(p.board)
    setActivePresetId('custom')
    setActiveMissionId(p.mission_id ?? null)
    setActiveProjectId(p.id)
    setProjectTitle(p.title)
    setCode(p.code)
    setComponents(p.components)
    setWires(p.wires)
    setLoopIterations(0)
    setDiagnostics(null)
    setSimState(createInitialSimulation(p.board, p.components, p.wires))
    setShowSavedDrawer(false)
    setStatusNotice(en ? `Loaded "${p.title}".` : `Proyek "${p.title}" dimuat.`)
  }

  const runCheckCircuit = () => {
    const report = verifyCircuitAndCode(boardId, code, components, wires, extraFiles)
    setDiagnostics(report)
  }

  const startSimulation = () => {
    if (audioOn) unlockAudio()
    const report = verifyCircuitAndCode(boardId, code, components, wires, extraFiles)
    setDiagnostics(report)
    const compiled = compileArduinoSketch(code, extraFiles)
    if (compiled.compileError) {
      setSimState((prev) => ({ ...prev, running: false, compileError: compiled.compileError }))
      return
    }
    const ctx = createVmContext(boardId, compiled, components, wires, extraFiles)
    stepSetup(ctx, components, wires)
    stepLoop(ctx, components, wires)
    ctx.sim.running = true
    vmRef.current = ctx
    syncBuzzerAudio(ctx.sim.buzzerActive, true, audioOnRef.current)
    setLoopIterations(ctx.loopIterations)
    setSimState({ ...ctx.sim })
  }

  const toggleStartStop = () => {
    if (simState.running) setSimState((prev) => ({ ...prev, running: false }))
    else startSimulation()
  }

  const resetSimulation = () => {
    vmRef.current = null
    setLoopIterations(0)
    setDiagnostics(null)
    setSimState(createInitialSimulation(boardId, components, wires))
  }

  const addComponent = (kind: ComponentKind) => {
    const spec = getComponentSpec(kind)
    const offset = (components.length % 5) * 28
    const newComp: PlacedComponent = {
      id: nextUid(kind),
      kind,
      x: isBreadboardKind(kind) ? 260 : 330 + offset,
      y: isBreadboardKind(kind) ? 265 : 80 + (components.length % 4) * 58,
      label: en ? spec.nameEn : spec.nameId,
      color:
        kind === 'led' || kind === 'pushbutton' || kind === 'seven-seg' || kind === 'seven-seg-4' || kind === 'max7219-matrix'
          ? 'red'
          : kind === 'led-bar-graph'
            ? 'GYR'
            : undefined,
      ohms: kind === 'resistor' ? 220 : undefined,
      props: {
        distanceCm: kind === 'hc-sr04' ? 40 : undefined,
        tempC: kind === 'dht22' ? 28 : kind === 'ds18b20' || kind === 'ntc' ? 25 : undefined,
        humidity: kind === 'dht22' ? 60 : undefined,
        potPct: kind === 'potentiometer' || kind === 'slide-pot' ? 50 : undefined,
        lux: kind === 'ldr' ? 420 : undefined,
        gasPpm: kind === 'mq2' ? 280 : undefined,
        pressureHpa: kind === 'bmp180' ? 1013 : undefined,
        tiltDeg: kind === 'mpu6050' ? 0 : undefined,
        weightKg: kind === 'hx711' ? 1.2 : undefined,
        joyX: kind === 'joystick' ? 512 : undefined,
        joyY: kind === 'joystick' ? 512 : undefined,
        dipBits: kind === 'dip-switch' ? [0, 0, 0, 0, 0, 0, 0, 0] : undefined,
        pressed: kind === 'pushbutton' || kind === 'slide-switch' ? false : undefined,
        motion: kind === 'pir' ? false : undefined,
        bounce: kind === 'pushbutton' || kind === 'slide-switch' ? true : undefined,
        common: kind === 'rgb-led' ? 'cathode' : kind === 'seven-seg' ? 'anode' : undefined,
        tmType: kind === 'seven-seg-4' ? 'colon' : undefined,
        lcdPins: kind === 'lcd-1602' || kind === 'lcd-20x4' ? 'i2c' : undefined,
        i2cAddress: kind === 'lcd-1602' || kind === 'lcd-20x4' ? '0x27' : undefined,
        lcdBackground: kind === 'lcd-1602' || kind === 'lcd-20x4' ? 'green' : undefined,
        lcdTextColor: kind === 'lcd-1602' || kind === 'lcd-20x4' ? 'black' : undefined,
        ringPixels: kind === 'neopixel-ring' ? 12 : undefined,
        servoHorn: kind === 'servo' ? 'single' : undefined,
        servoHornColor: kind === 'servo' ? '#ffffff' : undefined,
        buzzerMode: kind === 'buzzer' ? 'smooth' : undefined,
        buzzerVolume: kind === 'buzzer' ? 1 : undefined,
        relayTransistor: kind === 'relay' ? 'npn' : undefined,
        hxType: kind === 'hx711' ? '50kg' : undefined,
        matrixLayout: kind === 'max7219-matrix' ? 'parola' : undefined,
      },
    }
    const cur = liveCircuitRef.current
    pushCircuitUndo()
    const nextComps = [...cur.components, newComp]
    liveCircuitRef.current = { ...cur, components: nextComps }
    setComponents(nextComps)
    setSimState((prev) => ({ ...prev, ...createInitialSimulation(cur.boardId, nextComps, cur.wires), running: prev.running }))
  }

  const duplicateNode = (nodeId: string) => {
    const cur = liveCircuitRef.current
    const src = cur.components.find((c) => c.id === nodeId)
    if (!src) return
    pushCircuitUndo()
    const copy: PlacedComponent = {
      ...src,
      id: nextUid(src.kind === 'mcu' ? 'mcu' : src.kind),
      x: Math.min(2200, src.x + 32),
      y: Math.min(1600, src.y + 28),
      props: { ...src.props },
    }
    const nextComps = [...cur.components, copy]
    liveCircuitRef.current = { ...cur, components: nextComps }
    setComponents(nextComps)
    setSimState((prev) => ({ ...prev, ...createInitialSimulation(cur.boardId, nextComps, cur.wires), running: prev.running }))
  }

  const openDiagramTab = () => {
    const json = JSON.stringify(toWokwiDiagramJson(boardId, components, wires, projectTitle), null, 2)
    setDiagramText(json)
    setDiagramError(null)
    setLeftTab('diagram')
  }

  const applyDiagramJson = () => {
    const parsed = parseWokwiDiagramJson(diagramText)
    if (!parsed.ok) {
      setDiagramError(parsed.error)
      return
    }
    pushCircuitUndo()
    liveCircuitRef.current = { boardId: parsed.boardId, components: parsed.components, wires: parsed.wires }
    setDiagramError(null)
    setBoardId(parsed.boardId)
    setComponents(parsed.components)
    setWires(parsed.wires)
    setSimState(createInitialSimulation(parsed.boardId, parsed.components, parsed.wires))
    setStatusNotice(en ? 'Applied diagram.json to circuit canvas.' : 'diagram.json berhasil diterapkan ke kanvas.')
  }

  const togglePin = (kind: ComponentKind) => {
    setPinnedKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]))
  }

  const categories: Array<{ id: 'all' | ComponentCategory; labelId: string; labelEn: string }> = [
    { id: 'all', labelId: 'All', labelEn: 'All' },
    { id: 'microcontrollers', labelId: 'Microcontrollers', labelEn: 'Microcontrollers' },
    { id: 'sensors', labelId: 'Sensors', labelEn: 'Sensors' },
    { id: 'inputs', labelId: 'Input Devices', labelEn: 'Input Devices' },
    { id: 'displays', labelId: 'Displays', labelEn: 'Displays' },
    { id: 'actuators', labelId: 'Actuators', labelEn: 'Actuators' },
    { id: 'passives', labelId: 'Passive', labelEn: 'Passive' },
  ]

  const q = partSearch.trim().toLowerCase()
  const showBoards = (partCategory === 'all' || partCategory === 'microcontrollers')
  const matchingBoards = showBoards
    ? Object.values(BOARDS).filter((b) => !q || b.name.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q))
    : []
  const matchingParts = COMPONENT_CATALOG.filter((c) => {
    if (partCategory === 'microcontrollers') return false
    if (partCategory !== 'all' && c.category !== partCategory) return false
    if (!q) return true
    return c.nameId.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.kind.includes(q)
  })

  const acActiveItem = acState ? (acState.items[acState.activeIndex] ?? acState.items[0] ?? null) : null
  const acActiveSig = acActiveItem ? formatSuggestionSignature(acActiveItem) : null

  const completedSet = new Set((projectsQ.data?.completed_missions ?? []).map((m) => m.mission_id))
  const iotAchievements = projectsQ.data?.achievements ?? []
  const earnedAchCount = iotAchievements.filter((a) => a.earned).length
  const lineCount = Math.max(18, displayedCode.split('\n').length)
  const highlightedTokens = useMemo(() => tokenizeArduinoCpp(displayedCode), [displayedCode])
  const activeMcuCompileError = useMemo(() => {
    if (activeEditingNodeId === 'board') {
      if (extraFiles.length > 0) return compileArduinoSketch(activeCode, extraFiles).compileError
      return simState.compileError
    }
    return compileArduinoSketch(activeCode, extraFiles).compileError
  }, [activeEditingNodeId, activeCode, extraFiles, simState.compileError])

  const focusBarControls = (
    <div className="iot-focus-controls">
      <div className="iot-focus-segmented" role="group" aria-label={en ? 'Focus mode options' : 'Pilihan mode fokus'}>
        <button
          type="button"
          className={`iot-focus-seg-btn ${focusMode === 'normal' ? 'is-active' : ''}`}
          onClick={() => setFocusMode('normal')}
        >
          <LayoutGrid size={13} />
          <span>{en ? 'Normal' : 'Normal'}</span>
        </button>
        <button
          type="button"
          className={`iot-focus-seg-btn ${focusMode === 'focus' ? 'is-active' : ''}`}
          onClick={() => setFocusMode('focus')}
        >
          <Focus size={13} />
          <span>{en ? 'Studio Focus' : 'Fokus Studio'}</span>
        </button>
        <button
          type="button"
          className={`iot-focus-seg-btn ${focusMode === 'canvas' ? 'is-active' : ''}`}
          onClick={() => setFocusMode('canvas')}
        >
          <PanelLeftClose size={13} />
          <span>{en ? 'Canvas Focus' : 'Fokus Kanvas'}</span>
        </button>
      </div>
      <button
        type="button"
        className={`btn-outline iot-fs-btn ${isFullscreen ? 'is-active' : ''}`}
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? (en ? 'Exit Fullscreen' : 'Keluar Layar Penuh') : en ? 'Fullscreen' : 'Layar Penuh'}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Expand size={14} />}
        <span>{isFullscreen ? (en ? 'Exit Fullscreen (Esc)' : 'Keluar Layar Penuh') : en ? 'Fullscreen' : 'Layar Penuh'}</span>
      </button>
    </div>
  )

  return (
    <div
      ref={studioRef}
      className={`iot-studio ${isFullscreen ? 'is-fullscreen' : ''} ${focusMode !== 'normal' ? `is-focus-${focusMode}` : ''}`}
      onPointerDownCapture={() => {
        if (audioOnRef.current) unlockAudio()
      }}
      onKeyDownCapture={() => {
        if (audioOnRef.current) unlockAudio()
      }}
    >
      {focusMode === 'normal' && !isFullscreen ? (
        <PageHead
          title={en ? 'IoT Hardware & ESP32 Simulator' : 'Simulator Hardware IoT & ESP32'}
          description={
            en
              ? 'Design virtual ESP32-C3, Arduino, and Pico W circuits, inspect components, write Arduino C++ sketches, verify wiring, and monitor Serial output.'
              : 'Rangkai sirkuit virtual ESP32-C3, Arduino, dan Pico W, pilih komponen lengkap, tulis kode Arduino C++, cek rangkaian, dan pantau Serial Monitor.'
          }
          actions={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge tone="info">
                <Cpu size={13} /> {BOARDS[boardId].shortName} · {BOARDS[boardId].logicVoltage}V
                {boardInstances.length > 1 ? ` · ${boardInstances.length} MCU` : ''}
              </Badge>
              {focusBarControls}
              <button type="button" className="btn-outline" onClick={() => setShowSavedDrawer((v) => !v)}>
                <FolderOpen size={15} /> {en ? 'Saved' : 'Tersimpan'} ({projectsQ.data?.projects.length ?? 0})
              </button>
              <button type="button" className="btn-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                <Save size={15} /> {saveMut.isPending ? (en ? 'Saving...' : 'Menyimpan...') : en ? 'Save Project' : 'Simpan Proyek'}
              </button>
            </div>
          }
        />
      ) : (
        <header className="card iot-focus-bar" aria-label={en ? 'Focus toolbar' : 'Bar Mode Fokus'}>
          <div className="iot-focus-brand">
            <Badge tone="info">
              <Cpu size={13} /> {BOARDS[boardId].shortName}
            </Badge>
            <strong>{projectTitle}</strong>
            <Badge tone={simState.running ? 'good' : 'muted'}>
              {simState.running ? 'LIVE' : 'IDLE'}
            </Badge>
          </div>
          {focusBarControls}
        </header>
      )}

      {statusNotice ? (
        <div className="iot-notice-banner">
          <CheckCircle2 size={16} />
          <span>{statusNotice}</span>
        </div>
      ) : null}

      {showSavedDrawer ? (
        <section className="card iot-saved-shelf">
          <div className="card-head">
            <div>
              <h2>{en ? 'Saved Projects' : 'Proyek Tersimpan'}</h2>
              <p>{en ? 'Load a saved circuit + sketch from database.' : 'Muat kembali rangkaian dan sketsa yang tersimpan.'}</p>
            </div>
          </div>
          {projectsQ.data?.projects.length ? (
            <div className="iot-saved-grid">
              {projectsQ.data.projects.map((p) => (
                <div key={p.id} className="iot-saved-item">
                  <div>
                    <strong>{p.title}</strong>
                    <small className="muted" style={{ display: 'block' }}>
                      {BOARDS[p.board]?.shortName ?? p.board} · {p.components.length} parts · {p.wires.length} wires
                    </small>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn-outline iot-mini-btn" onClick={() => loadSavedProject(p)}>
                      {en ? 'Load' : 'Buka'}
                    </button>
                    <button type="button" className="btn-outline iot-mini-btn" onClick={() => deleteProjMut.mutate(p.id)} aria-label="Hapus proyek">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {en ? 'No saved projects yet.' : 'Belum ada proyek tersimpan.'}
            </p>
          )}
        </section>
      ) : null}

      {/* Top Project / Preset / Speed Controls */}
      {focusMode === 'normal' && !isFullscreen ? (
        <section className="card iot-controls-bar" aria-label={en ? 'Workspace Header' : 'Pengaturan Proyek'}>
        <div className="iot-ctrl-group">
          <label className="iot-inline-label">
            <span>{en ? 'Board' : 'Mikrokontroler'}</span>
            <select
              aria-label={en ? 'Select board' : 'Pilih board'}
              className="sim-select-full"
              value={boardId}
              onChange={(e) => switchBoard(e.target.value as BoardId)}
            >
              {Object.values(BOARDS).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <label className="iot-inline-label">
            <span>{en ? 'Template / Mission' : 'Template & Misi'}</span>
            <select
              aria-label={en ? 'Select preset or mission' : 'Pilih template atau misi'}
              className="sim-select-full"
              value={activePresetId}
              onChange={(e) => loadPreset(e.target.value)}
            >
              {corePresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {en ? p.titleEn : p.titleId}
                </option>
              ))}
              {mode === 'dosen' && dosenShowcasePresets.length > 0 ? (
                <optgroup label={en ? 'Instructor · Wokwi Interactive Projects' : 'Dosen · Contoh Proyek Belajar Wokwi'}>
                  {dosenShowcasePresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {en ? p.titleEn : p.titleId}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>

          <label className="iot-inline-label">
            <span>{en ? 'Project Title' : 'Nama Proyek'}</span>
            <input className="input" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} style={{ minWidth: 185 }} />
          </label>
        </div>

        <div className="iot-ctrl-actions">
          <div className="iot-wire-picker" title={en ? 'New wire color' : 'Warna kabel baru'}>
            {WIRE_COLORS.map((wc) => (
              <button
                key={wc.id}
                type="button"
                className={`iot-color-dot ${wireColor === wc.id ? 'is-selected' : ''}`}
                style={{ background: wc.id }}
                aria-label={en ? wc.nameEn : wc.nameId}
                onClick={() => setWireColor(wc.id)}
              />
            ))}
          </div>
          <select
            aria-label={en ? 'Simulation speed' : 'Kecepatan simulasi'}
            className="sim-select-full"
            style={{ width: 'auto', minWidth: 74 }}
            value={String(speed)}
            onChange={(e) => setSpeed(Number(e.target.value) as 0.5 | 1 | 2)}
          >
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
          </select>
          <button
            type="button"
            className="btn-outline iot-mini-btn"
            onClick={() => {
              const next = !audioOn
              setAudioOn(next)
              if (next) unlockAudio()
            }}
            aria-label={audioOn ? (en ? 'Mute buzzer sound' : 'Bisukan suara buzzer') : (en ? 'Unmute buzzer sound' : 'Aktifkan suara buzzer')}
            title={en ? 'Toggle buzzer sound' : 'Aktifkan/bisukan suara buzzer'}
          >
            {audioOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
      </section>
      ) : null}

      {/* Guided Practicum Missions Strip */}
      {focusMode === 'normal' && !isFullscreen ? (
      <section className="card iot-missions-strip" aria-label={en ? 'IoT Missions & Achievements' : 'Misi & Pencapaian IoT'}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13 }}>
              {en
                ? `IoT Missions (${completedSet.size}/${IOT_MISSIONS.length} Completed)`
                : `Misi Praktikum IoT (${completedSet.size}/${IOT_MISSIONS.length} Tuntas)`}
            </strong>
            {iotAchievements.length > 0 && (
              <Badge tone={earnedAchCount > 0 ? 'good' : 'muted'}>
                <Award size={12} /> {earnedAchCount}/{iotAchievements.length} Achievement IoT
              </Badge>
            )}
          </div>
          {iotAchievements.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Achievement IoT">
              {iotAchievements.map((ach) => (
                <span key={ach.id} title={`${ach.detail} (+${ach.xp} XP)`}>
                  <Badge tone={ach.earned ? 'good' : 'muted'}>
                    {ach.earned ? '★ ' : '○ '}
                    {ach.title}
                  </Badge>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="iot-mission-tabs">
          {IOT_MISSIONS.map((m) => {
            const isSelected = activeMissionId === m.id
            const isDone = completedSet.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
                className={`iot-mission-pill ${isSelected ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                onClick={() => loadPreset(m.presetId)}
              >
                {isDone ? <CheckCircle2 size={13} /> : <Sparkles size={13} />}
                <span>{en ? m.titleEn : m.titleId}</span>
              </button>
            )
          })}
        </div>
        {submitMissionMut.isError && (
          <p className="feedback wrong" role="alert" style={{ marginTop: 8 }}>
            {submitMissionMut.error instanceof Error
              ? submitMissionMut.error.message
              : en
                ? 'Server rejected mission verification. Check circuit, wiring, and simulation output.'
                : 'Verifikasi misi ditolak server. Periksa rangkaian, kabel, dan jalankan simulasi terlebih dahulu.'}
          </p>
        )}
        {activeMission ? (
          <div className="iot-mission-status">
            <div>
              <strong>{en ? 'Mission Checklist:' : 'Kriteria Misi:'}</strong>{' '}
              <span className="muted">{en ? activeMission.objectiveEn : activeMission.objectiveId}</span>
              <div className="iot-checks-row">
                {missionChecks.map((ck) => (
                  <Badge key={ck.id} tone={ck.passed ? 'good' : 'muted'}>
                    {ck.passed ? '✓ ' : '○ '}
                    {en ? ck.labelEn : ck.labelId}
                  </Badge>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={!allMissionPassed || submitMissionMut.isPending}
              onClick={() => submitMissionMut.mutate()}
            >
              <Award size={15} />
              {mode === 'dosen'
                ? en ? 'Verify Demo Run' : 'Verifikasi Demo'
                : submitMissionMut.isPending
                  ? en ? 'Submitting...' : 'Mengirim...'
                  : en
                    ? `Submit Mission (+${activeMission.xp} XP)`
                    : `Kumpulkan Misi (+${activeMission.xp} XP)`}
            </button>
          </div>
        ) : null}
      </section>
      ) : null}

      {/* Split Workbench matching iotsimulator.net: Left Tabbed Panel | Draggable Resizer | Right Circuit Canvas */}
      <div
        ref={workbenchRef}
        className="iot-workbench-grid"
        style={focusMode !== 'canvas' ? ({ '--iot-left-width': `${splitWidth}px` } as CSSProperties) : undefined}
      >
        {/* LEFT PANE: Main.ino | Components | Terminal */}
        {focusMode !== 'canvas' ? (
        <section className="card iot-left-panel">
          <header className="iot-left-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'code' && !activeCustomFile}
              className={`iot-left-tab ${leftTab === 'code' && !activeCustomFile ? 'is-active' : ''}`}
              onClick={() => {
                setLeftTab('code')
                setActiveCustomFile(null)
                setAcState(null)
              }}
            >
              Main.ino
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'diagram'}
              className={`iot-left-tab ${leftTab === 'diagram' ? 'is-active' : ''}`}
              onClick={openDiagramTab}
            >
              diagram.json
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'libraries'}
              className={`iot-left-tab ${leftTab === 'libraries' ? 'is-active' : ''}`}
              onClick={() => setLeftTab('libraries')}
            >
              Libraries
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'components'}
              className={`iot-left-tab ${leftTab === 'components' ? 'is-active' : ''}`}
              onClick={() => setLeftTab('components')}
            >
              Components
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'terminal'}
              className={`iot-left-tab ${leftTab === 'terminal' ? 'is-active' : ''}`}
              onClick={() => setLeftTab('terminal')}
            >
              Terminal
            </button>
            {extraFiles.map((f) => (
              <button
                key={f.name}
                type="button"
                role="tab"
                aria-selected={leftTab === 'code' && activeExtraFileObj?.name === f.name}
                className={`iot-left-tab iot-custom-file-tab ${leftTab === 'code' && activeExtraFileObj?.name === f.name ? 'is-active' : ''}`}
                onClick={() => {
                  setLeftTab('code')
                  setActiveCustomFile(f.name)
                  setAcState(null)
                }}
              >
                {f.name}
              </button>
            ))}
            <div className="iot-file-menu-wrap" ref={fileMenuRef}>
              <button
                type="button"
                className="iot-file-menu-btn"
                aria-label={en ? 'Sketch file actions' : 'Menu file sketch'}
                aria-expanded={showFileMenu}
                title={en ? 'New file, rename, format, or upload' : 'Tambah file, rename, rapikan, atau unggah'}
                onClick={() => setShowFileMenu((v) => !v)}
              >
                <ChevronDown size={14} />
              </button>
              <input
                ref={uploadFilesInputRef}
                type="file"
                multiple
                accept=".h,.hpp,.c,.cpp,.ino,.txt,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  void handleUploadExtraFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              {showFileMenu ? (
                <div className="iot-file-dropdown" role="menu" aria-label={en ? 'File menu' : 'Menu file'}>
                  <button
                    type="button"
                    role="menuitem"
                    className="iot-file-dropdown-item"
                    onClick={() => {
                      setLeftTab('code')
                      setShowFileMenu(false)
                      formatSketchCode()
                    }}
                  >
                    <Code2 size={14} />
                    <span>Format code</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="iot-file-dropdown-item"
                    disabled={!activeExtraFileObj}
                    title={!activeExtraFileObj ? (en ? 'Select a custom file tab to rename' : 'Pilih tab file tambahan untuk rename') : undefined}
                    onClick={() => {
                      if (!activeExtraFileObj) return
                      setShowFileMenu(false)
                      setLeftTab('code')
                      setFileActionMode('rename')
                      setFileNameDraft(activeExtraFileObj.name)
                    }}
                  >
                    <Pencil size={14} />
                    <span>Rename</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="iot-file-dropdown-item"
                    disabled={!activeExtraFileObj}
                    title={!activeExtraFileObj ? (en ? 'Main.ino cannot be deleted' : 'Main.ino tidak dapat dihapus') : undefined}
                    onClick={deleteActiveCustomFile}
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="iot-file-dropdown-item"
                    onClick={() => {
                      setShowFileMenu(false)
                      setLeftTab('code')
                      setFileActionMode('new')
                      setFileNameDraft('')
                    }}
                  >
                    <Plus size={14} />
                    <span>New file...</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="iot-file-dropdown-item"
                    onClick={() => {
                      setShowFileMenu(false)
                      uploadFilesInputRef.current?.click()
                    }}
                  >
                    <Upload size={14} />
                    <span>Upload file(s)...</span>
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          {leftTab === 'code' ? (
            <div className={`iot-editor-shell ${isDark ? 'theme-dark' : 'theme-light'}`}>
              <div className="iot-panel-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12.5 }}>
                  {activeExtraFileObj ? <FileCode2 size={14} /> : <Code2 size={14} />}
                  &lt;/&gt;{' '}
                  {activeExtraFileObj
                    ? activeExtraFileObj.name
                    : boardInstances.length > 1
                      ? `${editingBoardSpec.label}.ino`
                      : 'Main.ino'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-outline iot-mini-btn"
                    onClick={() => {
                      setFileActionMode('new')
                      setFileNameDraft('')
                    }}
                    title={en ? 'Add header/module file (.h/.cpp/.ino)' : 'Tambah file header/modul baru (.h/.cpp/.ino)'}
                  >
                    <Plus size={12} /> {en ? 'New file' : 'Tambah File'}
                  </button>
                  <button
                    type="button"
                    className="btn-outline iot-mini-btn"
                    onClick={formatSketchCode}
                    title={en ? 'Auto-indent & format code (Shift+Alt+F)' : 'Rapikan indentasi kode (Shift+Alt+F)'}
                  >
                    <AlignLeft size={12} /> {en ? 'Format' : 'Rapikan'}
                  </button>
                  <Badge tone={activeMcuCompileError ? 'bad' : 'good'}>
                    {activeMcuCompileError ? (en ? 'Compile Error' : 'Error Kompilasi') : `${BOARDS[editingBoardSpec.boardId].shortName} C++`}
                  </Badge>
                </div>
              </div>
              {fileActionMode ? (
                <div className="iot-file-prompt" role="region" aria-label={fileActionMode === 'new' ? 'Create new sketch file' : 'Rename sketch file'}>
                  <label htmlFor="iot-file-name-input" className="iot-file-prompt-label">
                    {fileActionMode === 'new'
                      ? en ? 'New filename (.h / .cpp / .ino):' : 'Nama file baru (.h / .cpp / .ino):'
                      : en ? 'Rename file:' : 'Ubah nama file:'}
                  </label>
                  <input
                    id="iot-file-name-input"
                    type="text"
                    autoFocus
                    className="iot-file-prompt-input"
                    value={fileNameDraft}
                    onChange={(e) => setFileNameDraft(e.target.value)}
                    placeholder="pins.h"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitFileAction()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setFileActionMode(null)
                        setFileNameDraft('')
                      }
                    }}
                  />
                  <button type="button" className="btn-primary iot-mini-btn" onClick={commitFileAction}>
                    {fileActionMode === 'new' ? (en ? 'Create' : 'Buat') : (en ? 'Save' : 'Simpan')}
                  </button>
                  <button
                    type="button"
                    className="btn-outline iot-mini-btn"
                    onClick={() => {
                      setFileActionMode(null)
                      setFileNameDraft('')
                    }}
                  >
                    {en ? 'Cancel' : 'Batal'}
                  </button>
                </div>
              ) : null}
              {boardInstances.length > 1 ? (
                <div className="iot-mcu-switcher" role="group" aria-label={en ? 'Select MCU firmware' : 'Pilih firmware MCU'}>
                  {boardInstances.map((b, idx) => (
                    <button
                      key={b.nodeId}
                      type="button"
                      className={`iot-mcu-tab ${activeEditingNodeId === b.nodeId ? 'is-active' : ''}`}
                      onClick={() => {
                        setEditingNodeId(b.nodeId)
                        setAcState(null)
                      }}
                    >
                      MCU {idx + 1}: {b.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {activeMcuCompileError ? (
                <div className="iot-compile-error">{activeMcuCompileError}</div>
              ) : null}
              <div className="iot-code-wrap">
                <div className="iot-line-gutter" aria-hidden="true">
                  {Array.from({ length: lineCount }, (_, idx) => (
                    <div key={idx} className={cursorPos.line === idx + 1 ? 'is-active-line' : undefined}>
                      {idx + 1}
                    </div>
                  ))}
                </div>
                <div className="iot-code-stage">
                  <div
                    className="iot-active-line-bg"
                    style={{ top: (cursorPos.line - 1) * 19.375 + 12 }}
                    aria-hidden="true"
                  />
                  <pre className="iot-code-highlight" aria-hidden="true">
                    <code>
                      {highlightedTokens.map((tok, i) => (
                        <span key={i} className={`tok-${tok.type}`}>
                          {tok.text}
                        </span>
                      ))}
                      {'\n '}
                    </code>
                  </pre>
                  <textarea
                    ref={codeTextareaRef}
                    aria-label={en ? 'Sketch source code' : 'Kode program mikrokontroler'}
                    className="iot-code-textarea"
                    spellCheck={false}
                    wrap="off"
                    value={displayedCode}
                    aria-autocomplete="list"
                    aria-expanded={Boolean(acState)}
                    onChange={(e) => {
                      const val = e.target.value
                      const cursor = e.target.selectionStart
                      const prevCursor = Math.min(displayedCode.length, cursor ?? displayedCode.length)
                      const singleChar = Math.abs(val.length - displayedCode.length) === 1 && !/\s/.test(val[(cursor ?? 1) - 1] ?? '')
                      recordCodeHistory(displayedCode, prevCursor, singleChar)
                      setDisplayedCode(val)
                      setCursorPos(getLineCol(val, cursor ?? 0))
                      refreshAutocomplete(val, cursor, false)
                    }}
                    onClick={(e) => {
                      const cursor = e.currentTarget.selectionStart ?? 0
                      setCursorPos(getLineCol(e.currentTarget.value, cursor))
                      refreshSignatureHint(e.currentTarget.value, cursor)
                    }}
                    onSelect={(e) => {
                      const cursor = e.currentTarget.selectionStart ?? 0
                      setCursorPos(getLineCol(e.currentTarget.value, cursor))
                      refreshSignatureHint(e.currentTarget.value, cursor)
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                        const k = e.key.toLowerCase()
                        if (k === 'z') {
                          e.preventDefault()
                          if (e.shiftKey) redoActiveCode()
                          else undoActiveCode()
                          return
                        }
                        if (k === 'y' && !e.shiftKey) {
                          e.preventDefault()
                          redoActiveCode()
                          return
                        }
                      }
                      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
                        e.preventDefault()
                        refreshAutocomplete(e.currentTarget.value, e.currentTarget.selectionStart, true)
                        return
                      }
                      if ((e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f')) {
                        e.preventDefault()
                        formatSketchCode()
                        return
                      }
                      if (acState) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setAcState((prev) =>
                            prev ? { ...prev, activeIndex: (prev.activeIndex + 1) % prev.items.length } : null,
                          )
                          return
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setAcState((prev) =>
                            prev
                              ? { ...prev, activeIndex: (prev.activeIndex - 1 + prev.items.length) % prev.items.length }
                              : null,
                          )
                          return
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault()
                          const item = acState.items[acState.activeIndex]
                          if (item) acceptAutocomplete(item)
                          return
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          e.stopPropagation()
                          setAcState(null)
                          return
                        }
                      } else if (sigHelp && e.key === 'Escape') {
                        e.preventDefault()
                        e.stopPropagation()
                        setSigHelp(null)
                        return
                      }

                      const ta = e.currentTarget
                      const start = ta.selectionStart ?? 0
                      const end = ta.selectionEnd ?? start

                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const res = handleSmartEnter(ta.value, start, end)
                        applyEditorMutation(res.nextCode, res.nextCursor)
                        return
                      }
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        const res = handleSmartIndent(ta.value, start, end, e.shiftKey)
                        applyEditorMutation(res.nextCode, res.nextSelStart, res.nextSelEnd)
                        return
                      }
                      if (e.key === '}' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        const out = handleSmartClosingBrace(ta.value, start, end)
                        if (out) {
                          e.preventDefault()
                          applyEditorMutation(out.nextCode, out.nextCursor)
                          return
                        }
                      }
                      if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        const bs = handleSmartBackspace(ta.value, start, end)
                        if (bs) {
                          e.preventDefault()
                          applyEditorMutation(bs.nextCode, bs.nextCursor)
                          return
                        }
                      }
                      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        const pair = handleSmartPairOrClose(ta.value, start, end, e.key)
                        if (pair) {
                          e.preventDefault()
                          applyEditorMutation(pair.nextCode, pair.nextCursor)
                        }
                      }
                    }}
                    onBlur={() => {
                      setAcState(null)
                      setSigHelp(null)
                    }}
                  />
                  {acState ? (
                    <div
                      className="iot-ac-popup"
                      role="listbox"
                      aria-label={en ? 'Code suggestions' : 'Saran kode C++'}
                      style={{ top: acState.topPx, left: acState.leftPx }}
                    >
                      <div className="iot-ac-list">
                        {acState.items.map((item, idx) => (
                          <button
                            key={`${item.kind}-${item.label}`}
                            type="button"
                            role="option"
                            aria-selected={idx === acState.activeIndex}
                            className={`iot-ac-item ${idx === acState.activeIndex ? 'is-active' : ''}`}
                            onMouseEnter={() =>
                              setAcState((prev) => (prev ? { ...prev, activeIndex: idx } : null))
                            }
                            onMouseDown={(e) => {
                              e.preventDefault()
                              acceptAutocomplete(item)
                            }}
                          >
                            <span className={`iot-ac-kind is-${item.kind}`} aria-hidden="true">
                              {AC_KIND_GLYPHS[item.kind]}
                            </span>
                            <span className="iot-ac-label">{item.label}</span>
                            <span className="iot-ac-param-count">
                              {item.params ? `${item.params.length} param` : item.kind}
                            </span>
                          </button>
                        ))}
                      </div>
                      {acActiveItem ? (
                        <div className="iot-ac-doc" aria-live="polite">
                          {acActiveSig ? (
                            <div className="iot-ac-doc-sig">
                              <code>{acActiveSig}</code>
                              <span className="iot-ac-param-badge">
                                {acActiveItem.params?.length ?? 0} {en ? 'params' : 'parameter'}
                              </span>
                            </div>
                          ) : null}
                          <div className="iot-ac-doc-summary">
                            {en ? acActiveItem.detailEn : acActiveItem.detailId}
                          </div>
                          {acActiveItem.params && acActiveItem.params.length > 0 ? (
                            <ul className="iot-ac-param-list">
                              {acActiveItem.params.map((p) => (
                                <li key={p.name}>
                                  <code>{p.type} {p.name}</code>
                                  <span>{en ? p.descEn : p.descId}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="iot-ac-hint">
                        ↑↓ {en ? 'select' : 'pilih'} · Enter/Tab {en ? 'insert' : 'sisipkan'} · Esc {en ? 'close' : 'tutup'}
                      </div>
                    </div>
                  ) : null}
                  {!acState && sigHelp ? (
                    <div
                      className="iot-sig-popup"
                      role="status"
                      aria-label={en ? 'Function parameter hints' : 'Info parameter fungsi'}
                      style={{ top: sigHelp.topPx, left: sigHelp.leftPx }}
                    >
                      <div className="iot-sig-head">
                        <code className="iot-sig-code">
                          <span className="iot-sig-ret">{sigHelp.returnType}</span>{' '}
                          <strong>{sigHelp.fnName}</strong>(
                          {sigHelp.params.length === 0 ? (
                            <span className="muted">void</span>
                          ) : (
                            sigHelp.params.map((p, idx) => (
                              <span key={p.name}>
                                {idx > 0 ? ', ' : ''}
                                <span className={idx === sigHelp.activeParam ? 'iot-sig-active-param' : undefined}>
                                  {p.type} {p.name}
                                </span>
                              </span>
                            ))
                          )}
                          )
                        </code>
                        <span className="iot-ac-param-badge">
                          {sigHelp.params.length === 0
                            ? en ? '0 params' : '0 parameter'
                            : en
                              ? `Param ${sigHelp.activeParam + 1} of ${sigHelp.params.length}`
                              : `Parameter ${sigHelp.activeParam + 1} dari ${sigHelp.params.length}`}
                        </span>
                      </div>
                      {sigHelp.params.length > 0 ? (
                        <div className="iot-sig-param-desc">
                          <strong>
                            {sigHelp.params[sigHelp.activeParam]?.type} {sigHelp.params[sigHelp.activeParam]?.name}:
                          </strong>{' '}
                          <span>
                            {en
                              ? sigHelp.params[sigHelp.activeParam]?.descEn
                              : sigHelp.params[sigHelp.activeParam]?.descId}
                          </span>
                        </div>
                      ) : null}
                      <div className="iot-sig-summary">
                        {en ? sigHelp.summaryEn : sigHelp.summaryId}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="iot-editor-statusbar">
                <span>Ln {cursorPos.line}, Kol {cursorPos.col}</span>
                <span>Spaces: 2 · Tab indent · Ctrl+Space saran · Shift+Alt+F rapikan</span>
              </div>
            </div>
          ) : leftTab === 'diagram' ? (
            (() => {
              const lint = lintWokwiDiagram(diagramText || JSON.stringify(toWokwiDiagramJson(boardId, components, wires, projectTitle)))
              return (
                <div className="iot-diagram-pane">
                  <div className="iot-panel-head">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12.5 }}>
                      <FileJson size={14} /> diagram.json (Wokwi v1)
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn-outline iot-mini-btn" onClick={openDiagramTab}>
                        Reset Sync
                      </button>
                      <button
                        type="button"
                        className="btn-outline iot-mini-btn"
                        onClick={() => {
                          const blob = new Blob([diagramText], { type: 'application/json;charset=utf-8' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = 'diagram.json'
                          a.click()
                          URL.revokeObjectURL(url)
                        }}
                      >
                        <Download size={12} /> JSON
                      </button>
                      <button type="button" className="btn-primary iot-mini-btn" onClick={applyDiagramJson}>
                        {en ? 'Apply diagram.json' : 'Terapkan ke Kanvas'}
                      </button>
                    </div>
                  </div>
                  <div className="iot-diagram-lint-bar">
                    <Badge tone={lint.valid ? 'good' : 'bad'}>
                      {lint.valid ? 'wokwi-cli lint: OK (0 errors)' : `Lint Errors: ${lint.errors.length}`}
                    </Badge>
                    {!lint.valid || diagramError ? (
                      <span className="iot-lint-err">{diagramError ?? lint.errors[0]}</span>
                    ) : null}
                  </div>
                  <textarea
                    aria-label="Wokwi diagram.json editor"
                    className="iot-diagram-textarea"
                    spellCheck={false}
                    value={diagramText}
                    onChange={(e) => setDiagramText(e.target.value)}
                  />
                </div>
              )
            })()
          ) : leftTab === 'libraries' ? (
            <div className="iot-libs-pane">
              <div className="iot-panel-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12.5 }}>
                  <BookOpen size={14} /> Library Manager (libraries.txt)
                </span>
              </div>
              <div className="search" style={{ width: '100%' }}>
                <Search size={14} />
                <input
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder={en ? 'Search Arduino / ESP32 libraries...' : 'Cari library Arduino / ESP32...'}
                />
              </div>
              <div className="iot-lib-list">
                {WOKWI_LIBRARY_REGISTRY.filter(
                  (l) =>
                    !libSearch.trim() ||
                    l.name.toLowerCase().includes(libSearch.toLowerCase()) ||
                    l.include.toLowerCase().includes(libSearch.toLowerCase()),
                ).map((lib) => {
                  const installed = code.includes(lib.include)
                  return (
                    <div key={lib.id} className="iot-lib-item">
                      <div>
                        <strong>{lib.name}</strong> <span className="muted">v{lib.version}</span>
                        <small style={{ display: 'block', color: 'var(--ink-2)' }}>{en ? lib.descriptionEn : lib.descriptionId}</small>
                        <code style={{ fontSize: 11 }}>{lib.include}</code>
                      </div>
                      <button
                        type="button"
                        className={installed ? 'btn-outline iot-mini-btn' : 'btn-primary iot-mini-btn'}
                        disabled={installed}
                        onClick={() => {
                          setCode((prev) => `${lib.include}\n${prev}`)
                          setStatusNotice(`${lib.name} (${lib.include}) ditambahkan ke Main.ino.`)
                        }}
                      >
                        {installed ? (en ? 'Added ✓' : 'Terpasang ✓') : en ? '+ Include' : '+ Pasang'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : leftTab === 'components' ? (
            <div className="iot-components-browser">
              <div className="search" style={{ width: '100%' }}>
                <Search size={14} />
                <input
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  placeholder={en ? 'Search Components (e.g. Servo, DHT22, LED)...' : 'Cari Komponen (mis. Servo, DHT22, LED)...'}
                />
              </div>

              <div className="iot-cat-pills" role="group" aria-label="Component categories">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`iot-cat-pill ${partCategory === cat.id ? 'is-active' : ''}`}
                    onClick={() => setPartCategory(cat.id)}
                  >
                    {en ? cat.labelEn : cat.labelId}
                  </button>
                ))}
              </div>

              {/* Pinned Components */}
              {pinnedKinds.length > 0 ? (
                <div className="iot-comp-section">
                  <div className="iot-sec-title">
                    <span><Pin size={13} style={{ color: '#eab308', verticalAlign: '-2px' }} /> {en ? 'Pinned Components' : 'Komponen Disematkan'}</span>
                    <span className="muted">({pinnedKinds.length})</span>
                  </div>
                  <div className="iot-comp-grid">
                    {pinnedKinds.map((pk) => {
                      const spec = getComponentSpec(pk)
                      return (
                        <div key={`pin-${pk}`} className="iot-part-card is-pinned">
                          <button
                            type="button"
                            className="iot-pin-toggle"
                            title={en ? 'Unpin' : 'Lepas pin'}
                            onClick={() => togglePin(pk)}
                          >
                            <Pin size={11} />
                          </button>
                          <button
                            type="button"
                            className="iot-card-add-btn"
                            title={en ? 'Add to circuit' : 'Tambah ke rangkaian'}
                            onClick={() => addComponent(pk)}
                          >
                            <Plus size={12} />
                          </button>
                          <div className="iot-card-thumb" onClick={() => addComponent(pk)}>
                            <PartThumbnail kind={pk} />
                          </div>
                          <strong>{en ? spec.nameEn : spec.nameId}</strong>
                          <small>{en ? spec.subtitleEn : spec.subtitleId}</small>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Microcontrollers Grid */}
              {matchingBoards.length > 0 ? (
                <div className="iot-comp-section">
                  <div className="iot-sec-title">
                    <span>Microcontrollers</span>
                    <span className="muted">({matchingBoards.length})</span>
                  </div>
                  <div className="iot-comp-grid">
                    {matchingBoards.map((b) => (
                      <div
                        key={b.id}
                        className={`iot-part-card ${boardId === b.id ? 'is-selected-board' : ''}`}
                      >
                        <button
                          type="button"
                          className="iot-card-add-btn"
                          title={en ? `Add extra ${b.shortName} to design` : `Tambah ${b.shortName} ke desain`}
                          aria-label={en ? `Add ${b.shortName} to canvas` : `Tambah ${b.shortName} ke kanvas`}
                          onClick={(e) => {
                            e.stopPropagation()
                            addExtraBoard(b.id)
                          }}
                        >
                          <Plus size={12} />
                        </button>
                        <div className="iot-card-thumb" onClick={() => switchBoard(b.id)}>
                          <BoardThumbnail boardId={b.id} />
                        </div>
                        <strong onClick={() => switchBoard(b.id)}>{b.shortName}</strong>
                        <small>{boardId === b.id ? (en ? 'Active on canvas' : 'Aktif di kanvas') : 'Microcontrollers'}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Sensors, Input Devices, Displays, Actuators, Passive */}
              {matchingParts.length > 0 ? (
                <div className="iot-comp-section">
                  <div className="iot-sec-title">
                    <span>{categories.find((c) => c.id === partCategory)?.labelEn ?? 'Components'}</span>
                    <span className="muted">({matchingParts.length})</span>
                  </div>
                  <div className="iot-comp-grid">
                    {matchingParts.map((c) => {
                      const isPinned = pinnedKinds.includes(c.kind)
                      return (
                        <div key={c.kind} className="iot-part-card">
                          <button
                            type="button"
                            className={`iot-pin-toggle ${isPinned ? 'is-on' : ''}`}
                            title={isPinned ? 'Unpin' : 'Pin'}
                            onClick={() => togglePin(c.kind)}
                          >
                            <Pin size={11} />
                          </button>
                          <button
                            type="button"
                            className="iot-card-add-btn"
                            title={en ? 'Add to circuit' : 'Tambah ke kanvas'}
                            aria-label={en ? `Add ${c.nameEn} to canvas` : `Tambah ${c.nameId} ke kanvas`}
                            onClick={() => addComponent(c.kind)}
                          >
                            <Plus size={12} />
                          </button>
                          <div className="iot-card-thumb" onClick={() => addComponent(c.kind)}>
                            <PartThumbnail kind={c.kind} />
                          </div>
                          <strong>{en ? c.nameEn : c.nameId}</strong>
                          <small>{en ? c.subtitleEn : c.subtitleId}</small>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="iot-terminal-tab-pane">
              <TelemetryDock
                sim={simState}
                hasWifi={BOARDS[boardId].hasWifi}
                lang={lang}
                onClearSerial={() => setSimState((prev) => ({ ...prev, serialLog: [], plotHistory: [] }))}
                onSendSerial={(text) => {
                  if (vmRef.current) vmRef.current.serialRxQueue.push(text)
                  setSimState((prev) => ({
                    ...prev,
                    serialLog: [...prev.serialLog.slice(-79), { id: nextUid('tx'), timeMs: prev.elapsedMs, text, kind: 'tx' }],
                  }))
                }}
              />
            </div>
          )}
        </section>
        ) : null}

        {focusMode !== 'canvas' ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={en ? 'Resize code editor and canvas panes' : 'Geser untuk memperlebar panel kode atau kanvas'}
            aria-valuemin={280}
            aria-valuemax={780}
            aria-valuenow={splitWidth}
            tabIndex={0}
            title={en ? 'Drag left/right to resize panes (double-click resets)' : 'Geser kiri/kanan untuk memperlebar panel (klik 2× reset)'}
            className="iot-split-resizer"
            onDoubleClick={() => setSplitWidth(420)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setSplitWidth((w) => Math.max(280, w - 24))
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                setSplitWidth((w) => Math.min(780, w + 24))
              }
            }}
            onPointerDown={(e) => {
              e.preventDefault()
              const startX = e.clientX
              const startWidth = splitWidth
              const maxW = Math.max(460, Math.round((workbenchRef.current?.clientWidth ?? 1200) * 0.65))
              document.body.style.cursor = 'col-resize'
              const onMove = (ev: PointerEvent) => {
                const next = Math.max(280, Math.min(maxW, Math.round(startWidth + (ev.clientX - startX))))
                setSplitWidth(next)
              }
              const onUp = () => {
                document.body.style.cursor = ''
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
              }
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
            }}
          >
            <span className="iot-split-grip" aria-hidden="true" />
          </div>
        ) : null}

        {/* RIGHT PANE: Floating Pill Toolbar + Circuit Canvas + Live Check/Serial Strip */}
        <div className="iot-canvas-column">
          <CircuitCanvas
            boardId={boardId}
            components={components}
            wires={wires}
            sim={simState}
            wireColor={wireColor}
            isDark={isDark}
            lang={lang}
            onStartStop={toggleStartStop}
            onReset={resetSimulation}
            onCheckCircuit={runCheckCircuit}
            canUndo={historyCounts.past > 0}
            canRedo={historyCounts.future > 0}
            onUndo={undoCircuit}
            onRedo={redoCircuit}
            onGestureStart={beginCircuitGesture}
            onGestureEnd={endCircuitGesture}
            onMoveBoardOrComponent={moveBoardOrComponent}
            onUpdateComponent={(id, patch) => {
              if (!gestureActiveRef.current) pushCircuitUndo()
              const cur = liveCircuitRef.current
              const nextComps = cur.components.map((c) => (c.id === id ? { ...c, ...patch } : c))
              liveCircuitRef.current = { ...cur, components: nextComps }
              setComponents(nextComps)
            }}
            onUpdateProps={(id, patch) => {
              const isTransientRuntimeInput = simState.running && (patch.pressed !== undefined || patch.motion !== undefined)
              if (!gestureActiveRef.current && !isTransientRuntimeInput) {
                const now = Date.now()
                const last = lastPropUndoRef.current
                if (!last || last.nodeId !== id || now - last.at > 400) {
                  pushCircuitUndo()
                }
                lastPropUndoRef.current = { nodeId: id, at: now }
              }
              const cur = liveCircuitRef.current
              const nextComps = cur.components.map((c) => (c.id === id ? { ...c, props: { ...c.props, ...patch } } : c))
              liveCircuitRef.current = { ...cur, components: nextComps }
              setComponents(nextComps)
              if (simState.running && vmRef.current) {
                triggerImmediateVmStep()
              }
            }}
            onAddWire={(from: WireEndpoint, to: WireEndpoint) => {
              pushCircuitUndo()
              const cur = liveCircuitRef.current
              const nw: Wire = { id: nextUid('wire'), from, to, color: wireColor }
              const nextWires = [...cur.wires, nw]
              liveCircuitRef.current = { ...cur, wires: nextWires }
              setWires(nextWires)
              setSimState((prev) => ({ ...prev, ...createInitialSimulation(cur.boardId, cur.components, nextWires), running: prev.running }))
            }}
            onUpdateWire={(wireId, patch) => {
              if (!gestureActiveRef.current) pushCircuitUndo()
              const cur = liveCircuitRef.current
              const nextWires = cur.wires.map((w) => (w.id === wireId ? { ...w, ...patch } : w))
              liveCircuitRef.current = { ...cur, wires: nextWires }
              setWires(nextWires)
            }}
            onDeleteWire={(wireId) => {
              pushCircuitUndo()
              const cur = liveCircuitRef.current
              const nextWires = cur.wires.filter((w) => w.id !== wireId)
              liveCircuitRef.current = { ...cur, wires: nextWires }
              setWires(nextWires)
              setSimState((prev) => ({ ...prev, ...createInitialSimulation(cur.boardId, cur.components, nextWires), running: prev.running }))
            }}
            onDeleteNode={(nodeId) => {
              if (nodeId === 'board') return
              pushCircuitUndo()
              const cur = liveCircuitRef.current
              const nextComps = cur.components.filter((c) => c.id !== nodeId)
              const nextWires = cur.wires.filter((w) => w.from.nodeId !== nodeId && w.to.nodeId !== nodeId)
              liveCircuitRef.current = { ...cur, components: nextComps, wires: nextWires }
              setComponents(nextComps)
              setWires(nextWires)
              setSimState((prev) => ({ ...prev, ...createInitialSimulation(cur.boardId, nextComps, nextWires), running: prev.running }))
            }}
            onDuplicateNode={duplicateNode}
            onSelectPrimaryBoard={switchBoard}
            onSelectMcuCode={(nodeId) => {
              setEditingNodeId(nodeId)
              setLeftTab('code')
              setAcState(null)
            }}
            focusMode={focusMode}
            onChangeFocusMode={setFocusMode}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />

          {/* Compact Diagnostics & Live Serial Bar beneath Canvas */}
          {diagnostics ? (
            <section className="card iot-diag-panel" aria-label={en ? 'Circuit & Code Diagnostics' : 'Hasil Cek Rangkaian & Koding'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ fontSize: 13 }}>
                  {en ? 'Circuit & Code Verification' : 'Hasil Pemeriksaan Rangkaian & Koding'}
                </strong>
                <button type="button" className="btn-outline iot-mini-btn" onClick={() => setDiagnostics(null)}>
                  {en ? 'Close' : 'Tutup'}
                </button>
              </div>
              <div className="iot-diag-list">
                {diagnostics.map((d) => (
                  <div key={d.id} className={`iot-diag-item is-${d.status}`}>
                    {d.status === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    <span>{en ? d.textEn : d.textId}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card iot-terminal-console" aria-label={en ? 'Serial Monitor Console' : 'Konsol Serial Monitor'}>
            <div className="iot-terminal-con-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge tone={simState.running ? 'good' : 'muted'}>
                  <Terminal size={12} /> {simState.running ? '115200 baud · LIVE' : 'IDLE'}
                </Badge>
                <span className="muted" style={{ fontSize: 12 }}>
                  {BOARDS[boardId].shortName} Serial Console
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn-outline iot-mini-btn"
                  onClick={() => setSimState((prev) => ({ ...prev, serialLog: [], plotHistory: [] }))}
                  aria-label={en ? 'Clear console' : 'Bersihkan konsol'}
                >
                  <Trash2 size={12} /> {en ? 'Clear' : 'Bersihkan'}
                </button>
                <button type="button" className="btn-outline iot-mini-btn" onClick={() => setLeftTab('terminal')}>
                  {en ? 'Open Terminal & Plotter' : 'Buka Terminal & Plotter'}
                </button>
              </div>
            </div>
            <div className="iot-terminal-con-screen">
              {simState.serialLog.length === 0 ? (
                <div className="iot-terminal-placeholder">
                  {en
                    ? 'Click Run (▶) to boot ROM and stream Serial UART output here...'
                    : 'Klik Jalankan (▶) untuk melihat boot ROM mikrokontroler & output Serial UART di sini...'}
                </div>
              ) : (
                simState.serialLog.slice(-14).map((entry) => (
                  <div
                    key={`con-${entry.id}`}
                    className={`iot-con-line ${entry.kind === 'sys' ? 'is-sys' : entry.kind === 'tx' ? 'is-tx' : ''}`}
                  >
                    {entry.kind === 'tx' ? `> ${entry.text}` : entry.text}
                  </div>
                ))
              )}
            </div>
            <form
              className="iot-terminal-con-input"
              onSubmit={(e) => {
                e.preventDefault()
                if (!quickSerialInput.trim()) return
                const txt = quickSerialInput.trim()
                if (vmRef.current) vmRef.current.serialRxQueue.push(txt)
                setSimState((prev) => ({
                  ...prev,
                  serialLog: [...prev.serialLog.slice(-79), { id: nextUid('tx'), timeMs: prev.elapsedMs, text: txt, kind: 'tx' }],
                }))
                setQuickSerialInput('')
              }}
            >
              <input
                className="input"
                value={quickSerialInput}
                onChange={(e) => setQuickSerialInput(e.target.value)}
                placeholder={en ? 'Send serial input (Enter)...' : 'Ketik input ke Serial Monitor (Enter)...'}
              />
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
