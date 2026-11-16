import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  CheckCircle2,
  Code2,
  Cpu,
  FolderOpen,
  Layers,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Badge, PageHead } from '../portal/ui'
import { useI18n } from '../shared/i18n'
import { simApi } from '../simulator/api'
import { BOARDS, COMPONENT_CATALOG, WIRE_COLORS, getComponentSpec } from './boards'
import { CircuitCanvas } from './CircuitCanvas'
import { compileArduinoSketch, createInitialSimulation, createVmContext, stepLoop, stepSetup, type VmContext } from './firmwareVm'
import { IOT_MISSIONS, IOT_PRESETS } from './presets'
import { TelemetryDock } from './TelemetryDock'
import type { BoardId, ComponentCategory, ComponentKind, PlacedComponent, SavedIotProject, SimulationState, Wire, WireEndpoint } from './types'
import './iot.css'

let uidCounter = 1
function nextUid(prefix: string): string {
  uidCounter += 1
  return `${prefix}-${uidCounter}`
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
  const qc = useQueryClient()

  const initialPreset = useMemo(() => {
    if (initialLabId) {
      const m = IOT_PRESETS.find((p) => p.missionId === initialLabId || p.id === initialLabId)
      if (m) return m
    }
    return IOT_PRESETS[0]
  }, [initialLabId])

  const [boardId, setBoardId] = useState<BoardId>(initialPreset.board)
  const [activePresetId, setActivePresetId] = useState<string>(initialPreset.id)
  const [activeMissionId, setActiveMissionId] = useState<string | null>(initialPreset.missionId ?? null)
  const [projectTitle, setProjectTitle] = useState(en ? initialPreset.titleEn : initialPreset.titleId)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [code, setCode] = useState(initialPreset.code)
  const [components, setComponents] = useState<PlacedComponent[]>(initialPreset.components)
  const [wires, setWires] = useState<Wire[]>(initialPreset.wires)
  const [wireColor, setWireColor] = useState(WIRE_COLORS[0].id)
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1)
  const [audioOn, setAudioOn] = useState(false)
  const [partSearch, setPartSearch] = useState('')
  const [partCategory, setPartCategory] = useState<'all' | ComponentCategory>('all')
  const [showSavedDrawer, setShowSavedDrawer] = useState(false)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)

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

  // Audio beep effect when buzzer active & user enabled sound
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

  // Continuous firmware simulation timer
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
    setSimState(createInitialSimulation(preset.board, preset.components, preset.wires))
    setStatusNotice(null)
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
    setSimState(createInitialSimulation(p.board, p.components, p.wires))
    setShowSavedDrawer(false)
    setStatusNotice(en ? `Loaded "${p.title}".` : `Proyek "${p.title}" dimuat.`)
  }

  const startSimulation = () => {
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

  const stopSimulation = () => {
    setSimState((prev) => ({ ...prev, running: false }))
  }

  const resetSimulation = () => {
    vmRef.current = null
    setLoopIterations(0)
    setSimState(createInitialSimulation(boardId, components, wires))
  }

  const addComponent = (kind: ComponentKind) => {
    const spec = getComponentSpec(kind)
    const offset = (components.length % 5) * 28
    const newComp: PlacedComponent = {
      id: nextUid(kind),
      kind,
      x: 320 + offset,
      y: 90 + (components.length % 4) * 58,
      label: en ? spec.nameEn : spec.nameId,
      color: kind === 'led' ? 'red' : undefined,
      ohms: kind === 'resistor' ? 220 : undefined,
      props: {
        distanceCm: kind === 'hc-sr04' ? 40 : undefined,
        tempC: kind === 'dht22' ? 28 : undefined,
        humidity: kind === 'dht22' ? 60 : undefined,
        potPct: kind === 'potentiometer' ? 50 : undefined,
        lux: kind === 'ldr' ? 420 : undefined,
        pressed: kind === 'pushbutton' ? false : undefined,
        motion: kind === 'pir' ? false : undefined,
      },
    }
    const nextComps = [...components, newComp]
    setComponents(nextComps)
    setSimState((prev) => ({ ...prev, ...createInitialSimulation(boardId, nextComps, wires), running: prev.running }))
  }

  const filteredParts = COMPONENT_CATALOG.filter((c) => {
    if (partCategory !== 'all' && c.category !== partCategory) return false
    const q = partSearch.trim().toLowerCase()
    if (!q) return true
    return c.nameId.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.kind.includes(q)
  })

  const completedSet = new Set((projectsQ.data?.completed_missions ?? []).map((m) => m.mission_id))
  const lineCount = Math.max(12, code.split('\n').length)

  return (
    <div className="iot-studio">
      <PageHead
        title={en ? 'IoT Hardware & ESP32 Simulator' : 'Simulator Hardware IoT & ESP32'}
        description={
          en
            ? 'Build interactive ESP32-C3, Arduino Uno, and Raspberry Pi Pico W circuits, write Arduino C++ sketches, wire components, and inspect real-time Serial Plotter telemetry.'
            : 'Rangkai sirkuit virtual ESP32-C3, Arduino Uno, dan Raspberry Pi Pico W, tulis kode Arduino C++, sambungkan kabel pin, dan pantau Serial Plotter secara real-time.'
        }
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge tone="info">
              <Cpu size={13} /> {BOARDS[boardId].shortName} · {BOARDS[boardId].logicVoltage}V
            </Badge>
            <button type="button" className="btn-outline" onClick={() => setShowSavedDrawer((v) => !v)}>
              <FolderOpen size={15} /> {en ? 'Saved Projects' : 'Proyek Tersimpan'} ({projectsQ.data?.projects.length ?? 0})
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

      {/* Saved Projects Collapsible Shelf */}
      {showSavedDrawer ? (
        <section className="card iot-saved-shelf">
          <div className="card-head">
            <div>
              <h2>{en ? 'Your Saved Circuits' : 'Daftar Sirkuit Tersimpan'}</h2>
              <p>{en ? 'Click a project to load its board, wiring, and sketch.' : 'Pilih proyek untuk memuat board, rangkaian kabel, dan kodenya.'}</p>
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
              {en ? 'No saved projects yet. Click "Save Project" above to store your current circuit.' : 'Belum ada proyek tersimpan. Klik "Simpan Proyek" di atas untuk menyimpan sirkuit ini.'}
            </p>
          )}
        </section>
      ) : null}

      {/* Top Simulator Controls Bar */}
      <section className="card iot-controls-bar" aria-label={en ? 'Simulator Toolbar' : 'Toolbar Simulator'}>
        <div className="iot-ctrl-group">
          <label className="iot-inline-label">
            <span>{en ? 'Board' : 'Mikrokontroler'}</span>
            <select
              aria-label={en ? 'Select board' : 'Pilih board'}
              className="sim-select-full"
              value={boardId}
              onChange={(e) => {
                const next = e.target.value as BoardId
                setBoardId(next)
                vmRef.current = null
                setSimState(createInitialSimulation(next, components, wires))
              }}
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
            <span>{en ? 'Project Name' : 'Nama Proyek'}</span>
            <input
              className="input"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              style={{ minWidth: 190 }}
            />
          </label>
        </div>

        <div className="iot-ctrl-actions">
          {!simState.running ? (
            <button type="button" className="btn-primary" onClick={startSimulation}>
              <Play size={15} /> {en ? 'Run Simulation' : 'Jalankan Simulasi'}
            </button>
          ) : (
            <button type="button" className="btn-outline" onClick={stopSimulation}>
              <Pause size={15} /> {en ? 'Pause' : 'Jeda'}
            </button>
          )}
          <button type="button" className="btn-outline" onClick={resetSimulation}>
            <RotateCcw size={15} /> Reset
          </button>
          <select
            aria-label={en ? 'Simulation speed' : 'Kecepatan simulasi'}
            className="sim-select-full"
            style={{ width: 'auto', minWidth: 82 }}
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

      {/* Practicum Missions Banner */}
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

      {/* Main Split Workbench: Left Code Editor | Right Circuit Canvas & Parts */}
      <div className="iot-workbench-grid">
        {/* Left: Arduino C++ Code Editor */}
        <section className="card iot-editor-panel" aria-label={en ? 'Arduino Code Editor' : 'Editor Kode Arduino C++'}>
          <header className="iot-panel-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5 }}>
              <Code2 size={15} /> sketch_{boardId}.ino
            </span>
            <Badge tone={simState.compileError ? 'bad' : 'good'}>
              {simState.compileError ? (en ? 'Compile Error' : 'Error Kompilasi') : 'Arduino C++'}
            </Badge>
          </header>
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
        </section>

        {/* Right: Component Strip + Interactive Canvas */}
        <div className="iot-canvas-column">
          <section className="card iot-palette-card">
            <div className="iot-palette-top">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <Layers size={14} /> {en ? 'Add Parts:' : 'Tambah Komponen:'}
                </span>
                {COMPONENT_CATALOG.filter((c) => c.pinned).map((c) => (
                  <button
                    key={c.kind}
                    type="button"
                    className="btn-outline iot-part-btn"
                    onClick={() => addComponent(c.kind)}
                    title={en ? c.subtitleEn : c.subtitleId}
                  >
                    <Plus size={12} /> {en ? c.nameEn : c.nameId}
                  </button>
                ))}
              </div>
              <div className="iot-wire-picker">
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{en ? 'Wire:' : 'Kabel:'}</span>
                {WIRE_COLORS.map((wc) => (
                  <button
                    key={wc.id}
                    type="button"
                    className={`iot-color-dot ${wireColor === wc.id ? 'is-selected' : ''}`}
                    style={{ background: wc.id }}
                    title={en ? wc.nameEn : wc.nameId}
                    aria-label={en ? wc.nameEn : wc.nameId}
                    onClick={() => setWireColor(wc.id)}
                  />
                ))}
              </div>
            </div>

            <div className="iot-palette-search">
              <div className="search" style={{ minWidth: 180, flex: '1 1 180px' }}>
                <Search size={14} />
                <input
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  placeholder={en ? 'More components (LDR, PIR, LCD, Relay, RGB)...' : 'Cari komponen lain (LDR, PIR, LCD, Relay, RGB)...'}
                />
              </div>
              <div className="chips">
                {(['all', 'sensors', 'inputs', 'displays', 'actuators', 'passives'] as const).map((cat) => (
                  <button key={cat} type="button" className="chip" aria-pressed={partCategory === cat} onClick={() => setPartCategory(cat)}>
                    {cat === 'all' ? (en ? 'All' : 'Semua') : cat}
                  </button>
                ))}
              </div>
            </div>
            {(partSearch.trim() || partCategory !== 'all') ? (
              <div className="iot-extra-parts">
                {filteredParts.map((c) => (
                  <button key={c.kind} type="button" className="btn-outline iot-part-btn" onClick={() => addComponent(c.kind)}>
                    <Plus size={12} /> {en ? c.nameEn : c.nameId}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <CircuitCanvas
            boardId={boardId}
            components={components}
            wires={wires}
            sim={simState}
            wireColor={wireColor}
            lang={lang}
            onMoveComponent={(id, x, y) => {
              setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)))
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
            onDeleteWire={(wireId) => {
              const nextWires = wires.filter((w) => w.id !== wireId)
              setWires(nextWires)
              setSimState((prev) => ({ ...prev, ...createInitialSimulation(boardId, components, nextWires), running: prev.running }))
            }}
            onDeleteComponent={(id) => {
              const nextComps = components.filter((c) => c.id !== id)
              const nextWires = wires.filter((w) => w.from.nodeId !== id && w.to.nodeId !== id)
              setComponents(nextComps)
              setWires(nextWires)
              setSimState((prev) => ({ ...prev, ...createInitialSimulation(boardId, nextComps, nextWires), running: prev.running }))
            }}
          />
        </div>
      </div>

      {/* Bottom Dock: Serial Monitor, Plotter, GPIO & Safety, Wi-Fi/MQTT */}
      <TelemetryDock
        sim={simState}
        hasWifi={BOARDS[boardId].hasWifi}
        lang={lang}
        onClearSerial={() => setSimState((prev) => ({ ...prev, serialLog: [], plotHistory: [] }))}
        onSendSerial={(text) => {
          if (vmRef.current) {
            vmRef.current.serialRxQueue.push(text)
          }
          setSimState((prev) => ({
            ...prev,
            serialLog: [...prev.serialLog.slice(-79), { id: nextUid('tx'), timeMs: prev.elapsedMs, text, kind: 'tx' }],
          }))
        }}
      />
    </div>
  )
}
