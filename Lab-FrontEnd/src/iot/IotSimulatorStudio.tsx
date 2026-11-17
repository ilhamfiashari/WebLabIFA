import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  FileJson,
  FolderOpen,
  Pin,
  Plus,
  Save,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Badge, PageHead } from '../portal/ui'
import { useI18n } from '../shared/i18n'
import { simApi } from '../simulator/api'
import { BOARDS, COMPONENT_CATALOG, WIRE_COLORS, getComponentSpec } from './boards'
import { CircuitCanvas } from './CircuitCanvas'
import { BoardThumbnail, PartThumbnail } from './CircuitSvgComponents'
import {
  compileArduinoSketch,
  createInitialSimulation,
  createVmContext,
  stepLoop,
  stepSetup,
  verifyCircuitAndCode,
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
  const [audioOn, setAudioOn] = useState(false)
  const [partSearch, setPartSearch] = useState('')
  const [partCategory, setPartCategory] = useState<'all' | ComponentCategory>('all')
  const [pinnedKinds, setPinnedKinds] = useState<ComponentKind[]>(['led', 'pushbutton'])
  const [showSavedDrawer, setShowSavedDrawer] = useState(false)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<CircuitDiagnosticItem[] | null>(null)
  const [quickSerialInput, setQuickSerialInput] = useState('')

  const [simState, setSimState] = useState<SimulationState>(() =>
    createInitialSimulation(initialPreset.board, initialPreset.components, initialPreset.wires),
  )
  const [loopIterations, setLoopIterations] = useState(0)

  const vmRef = useRef<VmContext | null>(null)
  const componentsRef = useRef(components)
  const wiresRef = useRef(wires)
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
      return simApi.submitIotMission(csrf, {
        mission_id: activeMission.id,
        board: boardId,
        code,
        component_count: components.length,
        wire_count: wires.length,
        checks_passed: missionChecks.filter((c) => c.passed).length,
        checks_total: missionChecks.length,
        has_hardware_alerts: simState.alerts.length > 0,
      })
    },
    onSuccess: async (res) => {
      setStatusNotice(
        en
          ? `Mission verified! Score ${res.score}/100 recorded (+${res.xp_awarded} XP).`
          : `Misi berhasil diverifikasi! Skor ${res.score}/100 tercatat (+${res.xp_awarded} XP).`,
      )
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['iot-projects'] }),
        qc.invalidateQueries({ queryKey: ['student-dashboard'] }),
        qc.invalidateQueries({ queryKey: ['student-leaderboard'] }),
        qc.invalidateQueries({ queryKey: ['instructor-dashboard'] }),
      ])
    },
  })

  useEffect(() => {
    if (!audioOn || !simState.running) return
    const active = Object.values(simState.buzzerActive).find((b) => b.active)
    if (!active) return
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = Math.max(200, Math.min(2400, active.freq || 1000))
      gain.gain.value = 0.03
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      const t = window.setTimeout(() => {
        osc.stop()
        void ctx.close()
      }, 110)
      return () => {
        window.clearTimeout(t)
        void ctx.close()
      }
    } catch {
      return
    }
  }, [audioOn, simState.running, simState.elapsedMs, simState.buzzerActive])

  useEffect(() => {
    if (!simState.running) return
    let cancelled = false
    let timerId = 0

    const tick = () => {
      if (cancelled || !vmRef.current) return
      const nextDelay = stepLoop(vmRef.current, componentsRef.current, wiresRef.current)
      setLoopIterations(vmRef.current.loopIterations)
      setSimState({ ...vmRef.current.sim, running: true })
      timerId = window.setTimeout(tick, Math.max(70, Math.round(nextDelay / speed)))
    }

    timerId = window.setTimeout(tick, Math.round(160 / speed))
    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [simState.running, speed])

  const loadPreset = (presetId: string) => {
    const preset = IOT_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    vmRef.current = null
    setBoardId(preset.board)
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
    setBoardId(nextBoard)
    setComponents((prev) =>
      prev.map((c) =>
        c.kind === 'mcu' && c.id === 'board'
          ? { ...c, boardId: nextBoard, label: BOARDS[nextBoard].shortName }
          : c,
      ),
    )
    vmRef.current = null
    setDiagnostics(null)
    setSimState(createInitialSimulation(nextBoard, components, wires))
  }

  const addExtraBoard = (extraBoard: BoardId) => {
    const hasPrimary = components.some((c) => c.kind === 'mcu' && c.id === 'board')
    const idx = components.filter((c) => c.kind === 'mcu').length + (hasPrimary ? 1 : 2)
    const spec = BOARDS[extraBoard]
    const newMcu: PlacedComponent = {
      id: nextUid('mcu'),
      kind: 'mcu',
      boardId: extraBoard,
      x: 320 + ((idx - 1) % 3) * 40,
      y: 76 + ((idx - 1) % 3) * 26,
      label: `${spec.shortName} #${idx}`,
      props: {},
    }
    const nextComps = [...components, newMcu]
    setComponents(nextComps)
    setSimState((prev) => ({ ...prev, ...createInitialSimulation(boardId, nextComps, wires), running: prev.running }))
  }

  const moveBoardOrComponent = (nodeId: string, x: number, y: number) => {
    setComponents((prev) => {
      if (nodeId === 'board') {
        const hasPrimary = prev.some((c) => c.kind === 'mcu' && c.id === 'board')
        if (hasPrimary) {
          return prev.map((c) => (c.kind === 'mcu' && c.id === 'board' ? { ...c, x, y } : c))
        }
        return [
          ...prev,
          { id: 'board', kind: 'mcu', boardId, x, y, label: BOARDS[boardId].shortName, props: {} },
        ]
      }
      return prev.map((c) => (c.id === nodeId ? { ...c, x, y } : c))
    })
  }

  const loadSavedProject = (p: SavedIotProject) => {
    vmRef.current = null
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
    const report = verifyCircuitAndCode(boardId, code, components, wires)
    setDiagnostics(report)
  }

  const startSimulation = () => {
    const report = verifyCircuitAndCode(boardId, code, components, wires)
    setDiagnostics(report)
    const compiled = compileArduinoSketch(code)
    if (compiled.compileError) {
      setSimState((prev) => ({ ...prev, running: false, compileError: compiled.compileError }))
      return
    }
    const ctx = createVmContext(boardId, compiled, components, wires)
    stepSetup(ctx, components, wires)
    stepLoop(ctx, components, wires)
    ctx.sim.running = true
    vmRef.current = ctx
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
      x: 330 + offset,
      y: 80 + (components.length % 4) * 58,
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
    const nextComps = [...components, newComp]
    setComponents(nextComps)
    setSimState((prev) => ({ ...prev, ...createInitialSimulation(boardId, nextComps, wires), running: prev.running }))
  }

  const duplicateNode = (nodeId: string) => {
    const src = components.find((c) => c.id === nodeId)
    if (!src) return
    const copy: PlacedComponent = {
      ...src,
      id: nextUid(src.kind === 'mcu' ? 'mcu' : src.kind),
      x: Math.min(760, src.x + 32),
      y: Math.min(410, src.y + 28),
      props: { ...src.props },
    }
    const nextComps = [...components, copy]
    setComponents(nextComps)
    setSimState((prev) => ({ ...prev, ...createInitialSimulation(boardId, nextComps, wires), running: prev.running }))
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

  const completedSet = new Set((projectsQ.data?.completed_missions ?? []).map((m) => m.mission_id))
  const lineCount = Math.max(18, code.split('\n').length)

  return (
    <div className="iot-studio">
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
            </Badge>
            <button type="button" className="btn-outline" onClick={() => setShowSavedDrawer((v) => !v)}>
              <FolderOpen size={15} /> {en ? 'Saved' : 'Tersimpan'} ({projectsQ.data?.projects.length ?? 0})
            </button>
            <button type="button" className="btn-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              <Save size={15} /> {saveMut.isPending ? (en ? 'Saving...' : 'Menyimpan...') : en ? 'Save Project' : 'Simpan Proyek'}
            </button>
          </div>
        }
      />

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
              {IOT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {en ? p.titleEn : p.titleId}
                </option>
              ))}
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
            onClick={() => setAudioOn((v) => !v)}
            title={en ? 'Toggle buzzer sound' : 'Aktifkan/bisukan suara buzzer'}
          >
            {audioOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
      </section>

      {/* Guided Practicum Missions Strip */}
      <section className="card iot-missions-strip">
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
                  : en ? 'Submit Mission (+50 XP)' : 'Kumpulkan Misi (+50 XP)'}
            </button>
          </div>
        ) : null}
      </section>

      {/* Split Workbench matching iotsimulator.net: Left Tabbed Panel | Right Circuit Canvas */}
      <div className="iot-workbench-grid">
        {/* LEFT PANE: Main.ino | Components | Terminal */}
        <section className="card iot-left-panel">
          <header className="iot-left-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'code'}
              className={`iot-left-tab ${leftTab === 'code' ? 'is-active' : ''}`}
              onClick={() => setLeftTab('code')}
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
          </header>

          {leftTab === 'code' ? (
            <div className={`iot-editor-shell ${isDark ? 'theme-dark' : 'theme-light'}`}>
              <div className="iot-panel-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12.5 }}>
                  <Code2 size={14} /> &lt;/&gt; Main.ino
                </span>
                <Badge tone={simState.compileError ? 'bad' : 'good'}>
                  {simState.compileError ? (en ? 'Compile Error' : 'Error Kompilasi') : `${BOARDS[boardId].shortName} C++`}
                </Badge>
              </div>
              {simState.compileError ? (
                <div className="iot-compile-error">{simState.compileError}</div>
              ) : null}
              <div className="iot-code-wrap">
                <div className="iot-line-gutter" aria-hidden="true">
                  {Array.from({ length: lineCount }, (_, idx) => (
                    <div key={idx}>{idx + 1}</div>
                  ))}
                </div>
                <textarea
                  aria-label={en ? 'Sketch source code' : 'Kode program mikrokontroler'}
                  className="iot-code-textarea"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
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
            onMoveBoardOrComponent={moveBoardOrComponent}
            onUpdateComponent={(id, patch) => {
              const nextComps = components.map((c) => (c.id === id ? { ...c, ...patch } : c))
              setComponents(nextComps)
            }}
            onUpdateProps={(id, patch) => {
              setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, props: { ...c.props, ...patch } } : c)))
            }}
            onAddWire={(from: WireEndpoint, to: WireEndpoint) => {
              const nw: Wire = { id: nextUid('wire'), from, to, color: wireColor }
              const nextWires = [...wires, nw]
              setWires(nextWires)
              setSimState((prev) => ({ ...prev, ...createInitialSimulation(boardId, components, nextWires), running: prev.running }))
            }}
            onUpdateWire={(wireId, patch) => {
              setWires((prev) => prev.map((w) => (w.id === wireId ? { ...w, ...patch } : w)))
            }}
            onDeleteWire={(wireId) => {
              const nextWires = wires.filter((w) => w.id !== wireId)
              setWires(nextWires)
              setSimState((prev) => ({ ...prev, ...createInitialSimulation(boardId, components, nextWires), running: prev.running }))
            }}
            onDeleteNode={(nodeId) => {
              if (nodeId === 'board') return
              const nextComps = components.filter((c) => c.id !== nodeId)
              const nextWires = wires.filter((w) => w.from.nodeId !== nodeId && w.to.nodeId !== nodeId)
              setComponents(nextComps)
              setWires(nextWires)
              setSimState((prev) => ({ ...prev, ...createInitialSimulation(boardId, nextComps, nextWires), running: prev.running }))
            }}
            onDuplicateNode={duplicateNode}
            onSelectPrimaryBoard={switchBoard}
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
