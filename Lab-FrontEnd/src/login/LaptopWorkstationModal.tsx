import { useEffect, useRef, useState } from 'react'
import {
  BatteryCharging,
  ChevronRight,
  Code2,
  Cpu,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Monitor,
  Play,
  Shield,
  Terminal as TerminalIcon,
  Wifi,
  X,
} from 'lucide-react'
import { drawLabScreen, LAPTOP_HEIGHT, LAPTOP_WIDTH } from './lab-animation'
import { AUTO_CYCLE_MODES, LAPTOP_CONTENT, LAPTOP_MENU, LAPTOP_MODES, type LaptopMode } from './laptop-content'
import type { LabProgram, LabWeather, StudioSettings } from './studio-model'

export type WorkstationView = 'desktop' | 'terminal' | 'lab'

interface VirtualFile {
  name: string
  kind: 'code' | 'image' | 'config' | 'doc'
  size: string
  modified: string
  relatedMode: LaptopMode
  runCommand: string
  content: string[]
}

interface VirtualFolder {
  id: 'CyberSecurity' | 'WebDev' | 'Steganography' | 'IoT_ESP32'
  label: string
  accent: string
  relatedMode: LaptopMode
  descriptionId: string
  descriptionEn: string
  files: VirtualFile[]
}

const DESKTOP_FOLDERS: VirtualFolder[] = [
  {
    id: 'CyberSecurity',
    label: 'CyberSecurity',
    accent: '#22c58b',
    relatedMode: 'security',
    descriptionId: 'Audit OWASP Top 10, WAF & verifikasi tanda tangan',
    descriptionEn: 'OWASP Top 10 audits, WAF rules & signed telemetry',
    files: [
      {
        name: 'security_pipeline.py',
        kind: 'code',
        size: '2.4 KB',
        modified: '2026-11-25 09:40',
        relatedMode: 'security',
        runCommand: 'lab replay signed-telemetry.fixture',
        content: LAPTOP_CONTENT.security.code,
      },
      {
        name: 'owasp_assessment.py',
        kind: 'code',
        size: '1.8 KB',
        modified: '2026-11-25 09:32',
        relatedMode: 'pentest',
        runCommand: 'nmap -sV 192.0.2.10',
        content: LAPTOP_CONTENT.pentest.code,
      },
      {
        name: 'firewall.rules',
        kind: 'config',
        size: '1.1 KB',
        modified: '2026-11-25 09:15',
        relatedMode: 'attacks',
        runCommand: 'lab waf-watch --mode strict',
        content: [
          '# IFA Lab Default-Deny Policy',
          'default ingress DROP',
          'allow tcp 443  tls_min=1.3  rate_limit=120/m',
          'allow tcp 8883 mqtts_cert=required',
          'block sqli_signature -> action=QUARANTINE',
          'block xss_script_tag -> action=DROP',
          'audit destination=/var/log/ifa-siem.log',
        ],
      },
      {
        name: 'sast_report.json',
        kind: 'doc',
        size: '3.2 KB',
        modified: '2026-11-25 08:50',
        relatedMode: 'vulnerability',
        runCommand: 'lab audit --sbom cyclonedx.json',
        content: [
          '{',
          '  "scanner": "CodeQL + Semgrep + Cargo Audit",',
          '  "open_critical": 0,',
          '  "open_high": 0,',
          '  "patched": ["cookie@0.18.3", "url@2.5.9"],',
          '  "status": "PASSED"',
          '}',
        ],
      },
    ],
  },
  {
    id: 'WebDev',
    label: 'WebDev',
    accent: '#38bdf8',
    relatedMode: 'web',
    descriptionId: 'HTML5, CSS3 Grid, FastAPI REST & PostgreSQL',
    descriptionEn: 'HTML5, CSS3 Grid, FastAPI REST & PostgreSQL',
    files: [
      {
        name: 'index.html',
        kind: 'code',
        size: '1.3 KB',
        modified: '2026-11-25 09:42',
        relatedMode: 'web',
        runCommand: 'curl -i http://localhost:3000/api/v1/labs',
        content: [
          '<!doctype html>',
          '<html lang="id">',
          '  <head><title>WebLabIFA Studio</title></head>',
          '  <body>',
          '    <header class="hero">',
          '      <h1>Web App Development Lab</h1>',
          '      <h2>HTML5 · CSS3 · FastAPI · PostgreSQL</h2>',
          '    </header>',
          '    <main class="grid-3">',
          '      <button id="run-btn">Run Live Preview</button>',
          '    </main>',
          '  </body>',
          '</html>',
        ],
      },
      {
        name: 'fastapi_server.py',
        kind: 'code',
        size: '1.9 KB',
        modified: '2026-11-25 09:28',
        relatedMode: 'web',
        runCommand: 'curl -i http://localhost:3000/api/v1/labs',
        content: LAPTOP_CONTENT.web.code,
      },
      {
        name: 'schema.sql',
        kind: 'code',
        size: '1.4 KB',
        modified: '2026-11-25 09:10',
        relatedMode: 'web',
        runCommand: 'psql -c "EXPLAIN SELECT * FROM labs"',
        content: [
          'CREATE TABLE labs (',
          '  id TEXT PRIMARY KEY,',
          '  title TEXT NOT NULL,',
          '  track TEXT CHECK (track IN (\'web\', \'iot\', \'cyber\')),',
          '  status TEXT NOT NULL DEFAULT \'published\'',
          ');',
          'CREATE INDEX labs_status_idx ON labs(status);',
        ],
      },
    ],
  },
  {
    id: 'Steganography',
    label: 'Steganography',
    accent: '#c084fc',
    relatedMode: 'stego',
    descriptionId: 'Ekstraksi LSB RGB, analisis bit-plane & hex PNG',
    descriptionEn: 'RGB LSB extraction, bit-plane & PNG hex forensics',
    files: [
      {
        name: 'lsb_extract.py',
        kind: 'code',
        size: '1.6 KB',
        modified: '2026-11-25 09:45',
        relatedMode: 'stego',
        runCommand: 'python3 lsb_extract.py cover_lab.png',
        content: LAPTOP_CONTENT.stego.code,
      },
      {
        name: 'cover_lab.png',
        kind: 'image',
        size: '312 KB',
        modified: '2026-11-25 09:30',
        relatedMode: 'stego',
        runCommand: 'stegsolve cover_lab.png',
        content: [
          'PNG Signature: 89 50 4E 47 0D 0A 1A 0A (valid)',
          'Dimensions   : 1446 x 1087 · 24-bit RGB',
          'LSB Plane-0  : Chi-square anomaly = 0.994',
          'Bit Stream   : 01000110 01001100 01000001 01000111 ...',
          'Covert tEXt  : 46 4C 41 47 7B 49 46 41 5F 53 54 45 47 4F',
          'Decoded UTF-8: FLAG{IFA_STEGO_LSB_2026}',
        ],
      },
      {
        name: 'exif_chunks.hex',
        kind: 'doc',
        size: '842 B',
        modified: '2026-11-25 09:20',
        relatedMode: 'stego',
        runCommand: 'hexdump -C cover_lab.png | head',
        content: [
          '00000000  89 50 4e 47 0d 0a 1a 0a  00 00 00 0d 49 48 44 52  |.PNG........IHDR|',
          '00000010  00 00 05 a6 00 00 04 3f  08 02 00 00 00 7e 14 91  |.......?.....~..|',
          '000004e0  00 00 00 18 74 45 58 74  46 4c 41 47 7b 49 46 41  |....tEXtFLAG{IFA|',
          '000004f0  5f 53 54 45 47 4f 5f 4c  53 42 5f 32 30 32 36 7d  |_STEGO_LSB_2026}|',
          '00000510  00 00 00 00 49 45 4e 44  ae 42 60 82              |....IEND.B`.|',
        ],
      },
    ],
  },
  {
    id: 'IoT_ESP32',
    label: 'IoT_ESP32',
    accent: '#fbbf24',
    relatedMode: 'iot',
    descriptionId: 'Firmware ESP32-C3, sensor DHT22/HC-SR04 & MQTTS',
    descriptionEn: 'ESP32-C3 firmware, DHT22/HC-SR04 sensors & MQTTS',
    files: [
      {
        name: 'esp32_dht22.ino',
        kind: 'code',
        size: '3.1 KB',
        modified: '2026-11-25 09:44',
        relatedMode: 'iot',
        runCommand: 'lab serial --board esp32-c3',
        content: LAPTOP_CONTENT.iot.code,
      },
      {
        name: 'mqtt_tls.conf',
        kind: 'config',
        size: '960 B',
        modified: '2026-11-25 09:12',
        relatedMode: 'protocols',
        runCommand: 'tshark -i lab0 -f "tcp port 8883"',
        content: [
          'broker_uri = mqtts://broker.lab.local:8883',
          'tls_version = TLSv1.3',
          'client_cert = /etc/iot/esp32-c3-01.crt',
          'acl_topic = lab/esp32/+/telemetry',
          'qos = 1',
          'reject_wildcard_publish = true',
        ],
      },
      {
        name: 'diagram.json',
        kind: 'doc',
        size: '1.5 KB',
        modified: '2026-11-25 08:58',
        relatedMode: 'iot',
        runCommand: 'lab serial --board esp32-c3',
        content: [
          '{',
          '  "board": "esp32-c3-devkit",',
          '  "parts": ["dht22@GPIO4", "hc-sr04@GPIO5,18", "led@GPIO2", "oled-i2c"],',
          '  "status": "wiring_verified"',
          '}',
        ],
      },
    ],
  },
]

interface TerminalEntry {
  id: number
  kind: 'cmd' | 'ok' | 'warn' | 'info' | 'highlight'
  text: string
}

function executeSimulatedCommand(raw: string, cwd: string): {
  lines: Array<{ kind: TerminalEntry['kind']; text: string }>
  nextCwd?: string
  clear?: boolean
  openDesktop?: boolean
  switchMode?: LaptopMode
} {
  const cmd = raw.trim()
  const lower = cmd.toLowerCase()
  if (!cmd) return { lines: [] }
  if (lower === 'clear' || lower === 'cls') return { lines: [], clear: true }
  if (lower === 'desktop') {
    return {
      lines: [{ kind: 'ok', text: '[OS] Switching workspace to IFA Lab Desktop...' }],
      openDesktop: true,
    }
  }
  if (lower === 'help' || lower === '?') {
    return {
      lines: [
        { kind: 'highlight', text: 'IFA Lab Simulated Workstation Shell — Available commands:' },
        { kind: 'info', text: '  ls [folder]        List desktop folders or files inside a folder' },
        { kind: 'info', text: '  cd <folder|..>     Change active directory' },
        { kind: 'info', text: '  cat <filename>     Inspect source code, hex dump, or config file' },
        { kind: 'ok', text: '  nmap               Run sandboxed OWASP/port discovery scan' },
        { kind: 'ok', text: '  stegsolve / lsb    Extract LSB hidden payload from cover_lab.png' },
        { kind: 'ok', text: '  curl               Test FastAPI + PostgreSQL web endpoint' },
        { kind: 'ok', text: '  iot / serial       Stream ESP32-C3 DHT22 & MQTTS telemetry' },
        { kind: 'ok', text: '  tshark             Capture DHCP/DNS/TCP/TLS 1.3 handshake' },
        { kind: 'info', text: '  desktop | clear    Switch to OS Desktop or clear terminal' },
      ],
    }
  }
  if (lower === 'whoami') return { lines: [{ kind: 'info', text: 'ifa (uid=1000 groups=cybersec,webdev,iot-lab)' }] }
  if (lower === 'pwd') return { lines: [{ kind: 'info', text: cwd }] }
  if (lower.startsWith('uname')) {
    return { lines: [{ kind: 'info', text: 'Linux weblab-workstation 6.12.0-ifa #1 SMP x86_64 GNU/Linux' }] }
  }
  if (lower === 'ls' || lower.startsWith('ls ')) {
    const arg = cmd.slice(2).trim().replace(/^-[a-zA-Z]+\s*/, '').replace(/\/$/, '')
    const targetFolder =
      DESKTOP_FOLDERS.find((f) => f.id.toLowerCase() === arg.toLowerCase()) ??
      DESKTOP_FOLDERS.find((f) => cwd.endsWith(`/${f.id}`))
    if (!arg && cwd === '/home/ifa/Desktop') {
      return {
        lines: [
          { kind: 'ok', text: 'drwxr-xr-x  ifa  4 files   CyberSecurity/' },
          { kind: 'ok', text: 'drwxr-xr-x  ifa  3 files   WebDev/' },
          { kind: 'ok', text: 'drwxr-xr-x  ifa  3 files   Steganography/' },
          { kind: 'ok', text: 'drwxr-xr-x  ifa  3 files   IoT_ESP32/' },
          { kind: 'info', text: '-rw-r--r--  ifa  612 B     README.md' },
        ],
      }
    }
    if (targetFolder) {
      return {
        lines: targetFolder.files.map((f) => ({
          kind: f.kind === 'image' ? 'highlight' : 'info',
          text: `-rw-r--r--  ifa  ${f.size.padEnd(8)}  ${f.modified}  ${f.name}`,
        })),
      }
    }
    return { lines: [{ kind: 'warn', text: `ls: cannot access '${arg}': No such file or directory` }] }
  }
  if (lower.startsWith('cd')) {
    const arg = cmd.slice(2).trim().replace(/\/$/, '')
    if (!arg || arg === '~' || arg === '..' || arg === '/home/ifa/Desktop') {
      return { lines: [], nextCwd: '/home/ifa/Desktop' }
    }
    const found = DESKTOP_FOLDERS.find((f) => f.id.toLowerCase() === arg.toLowerCase())
    if (found) {
      return { lines: [], nextCwd: `/home/ifa/Desktop/${found.id}`, switchMode: found.relatedMode }
    }
    return { lines: [{ kind: 'warn', text: `bash: cd: ${arg}: No such directory` }] }
  }
  if (lower.startsWith('cat ')) {
    const target = cmd.slice(4).trim()
    if (target.toLowerCase() === 'readme.md') {
      return {
        lines: [
          { kind: 'highlight', text: '# IFA Virtual Lab Workstation' },
          { kind: 'info', text: 'Tracks: Cyber Security (OWASP) · Web Dev · Steganography · IoT ESP32' },
          { kind: 'ok', text: 'All commands execute safely inside a local browser simulation.' },
        ],
      }
    }
    for (const folder of DESKTOP_FOLDERS) {
      const file = folder.files.find((f) => f.name.toLowerCase() === target.toLowerCase())
      if (file) {
        return {
          lines: [
            { kind: 'highlight', text: `--- ${folder.id}/${file.name} (${file.size}) ---` },
            ...file.content.map((line) => ({ kind: 'info' as const, text: line })),
          ],
          switchMode: file.relatedMode,
        }
      }
    }
    return { lines: [{ kind: 'warn', text: `cat: ${target}: No such file` }] }
  }
  if (lower.includes('nmap') || lower.includes('pentest')) {
    return {
      lines: LAPTOP_CONTENT.pentest.cli.slice(1).map((t) => ({ kind: 'ok', text: t })),
      switchMode: 'pentest',
    }
  }
  if (lower.includes('steg') || lower.includes('lsb') || lower.includes('hex')) {
    return {
      lines: LAPTOP_CONTENT.stego.cli.slice(1).map((t) => ({
        kind: t.includes('[DECODED]') ? 'highlight' : 'ok',
        text: t,
      })),
      switchMode: 'stego',
    }
  }
  if (lower.includes('curl') || lower.includes('psql') || lower.includes('sql') || lower.includes('web')) {
    return {
      lines: LAPTOP_CONTENT.web.cli.slice(1).map((t) => ({ kind: 'ok', text: t })),
      switchMode: 'web',
    }
  }
  if (lower.includes('iot') || lower.includes('serial') || lower.includes('esp32')) {
    return {
      lines: LAPTOP_CONTENT.iot.cli.slice(1).map((t) => ({ kind: 'ok', text: t })),
      switchMode: 'iot',
    }
  }
  if (lower.includes('tshark') || lower.includes('mqtt') || lower.includes('net')) {
    return {
      lines: LAPTOP_CONTENT.protocols.cli.slice(1).map((t) => ({ kind: 'ok', text: t })),
      switchMode: 'protocols',
    }
  }
  if (lower.includes('waf') || lower.includes('attack')) {
    return {
      lines: LAPTOP_CONTENT.attacks.cli.slice(1).map((t) => ({
        kind: t.includes('[WAF]') || t.includes('[RATE]') ? 'warn' : 'ok',
        text: t,
      })),
      switchMode: 'attacks',
    }
  }
  if (lower.includes('audit') || lower.includes('sbom')) {
    return {
      lines: LAPTOP_CONTENT.vulnerability.cli.slice(1).map((t) => ({ kind: 'ok', text: t })),
      switchMode: 'vulnerability',
    }
  }
  if (lower.includes('replay') || lower.includes('security')) {
    return {
      lines: LAPTOP_CONTENT.security.cli.slice(1).map((t) => ({ kind: 'ok', text: t })),
      switchMode: 'security',
    }
  }
  return {
    lines: [
      { kind: 'warn', text: `bash: ${cmd.split(' ')[0]}: command not found. Type 'help' to list simulated tools.` },
    ],
  }
}

export function LaptopWorkstationModal({
  open,
  view,
  onChangeView,
  program,
  weather,
  settings,
  en,
  onSelectProgram,
  onClose,
}: {
  open: boolean
  view: WorkstationView
  onChangeView: (view: WorkstationView) => void
  program: LabProgram
  weather: LabWeather
  settings: StudioSettings
  en: boolean
  onSelectProgram: (mode: LabProgram) => void
  onClose: () => void
}) {
  const [activeFolderId, setActiveFolderId] = useState<VirtualFolder['id'] | null>('Steganography')
  const [selectedFileName, setSelectedFileName] = useState<string>('cover_lab.png')
  const [showReadme, setShowReadme] = useState(false)
  const [cwd, setCwd] = useState('/home/ifa/Desktop')
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<TerminalEntry[]>([
    { id: 1, kind: 'highlight', text: 'IFA Lab Virtual Workstation v2.4 — Isolated Local Sandbox' },
    { id: 2, kind: 'info', text: 'Type "help", "ls", "stegsolve", "nmap", "curl", "iot", or switch to Desktop.' },
  ])
  const nextId = useRef(3)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const termEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const setView = onChangeView

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    termEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [history, view])

  // Live zoomed canvas renderer inside the Lab & Terminal view
  useEffect(() => {
    if (!open || view !== 'lab') return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let start = performance.now()
    const draw = (now: number) => {
      const elapsed = (now - start) / 1000
      const activeMode: LabProgram = program === 'desktop' ? 'security' : program
      drawLabScreen(ctx, elapsed, activeMode, weather, settings.distance, settings.network)
      if (!settings.paused) {
        raf = requestAnimationFrame(draw)
      }
    }
    start = performance.now()
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [open, view, program, weather, settings.distance, settings.network, settings.paused])

  if (!open) return null

  const activeFolder = DESKTOP_FOLDERS.find((f) => f.id === activeFolderId) ?? null
  const activeFile = activeFolder?.files.find((f) => f.name === selectedFileName) ?? activeFolder?.files[0] ?? null
  const liveMode: LaptopMode =
    program === 'auto'
      ? 'security'
      : program === 'desktop'
        ? 'security'
        : program

  const runCommand = (rawCmd: string) => {
    const trimmed = rawCmd.trim()
    if (!trimmed) return
    const res = executeSimulatedCommand(trimmed, cwd)
    if (res.clear) {
      setHistory([])
      setInput('')
      return
    }
    const promptPrefix = `ifa@weblab:${cwd.replace('/home/ifa', '~')}$ ${trimmed}`
    const added: TerminalEntry[] = [
      { id: nextId.current++, kind: 'cmd', text: promptPrefix },
      ...res.lines.map((l) => ({ id: nextId.current++, kind: l.kind, text: l.text })),
    ]
    setHistory((prev) => [...prev.slice(-80), ...added])
    if (res.nextCwd) setCwd(res.nextCwd)
    if (res.switchMode) onSelectProgram(res.switchMode)
    if (res.openDesktop) {
      setView('desktop')
      onSelectProgram('desktop')
    }
    setInput('')
  }

  const openFolder = (folder: VirtualFolder) => {
    setShowReadme(false)
    setActiveFolderId(folder.id)
    setSelectedFileName(folder.files[0]?.name ?? '')
    setCwd(`/home/ifa/Desktop/${folder.id}`)
    onSelectProgram(folder.relatedMode)
  }

  const timeNow = new Date().toLocaleTimeString(en ? 'en-US' : 'id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return (
    <div
      className="ws-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={en ? 'IFA Lab Interactive Workstation' : 'Workstation Interaktif IFA Lab'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ws-window">
        {/* Realistic Workstation OS Titlebar */}
        <header className="ws-titlebar">
          <div className="ws-traffic">
            <button type="button" className="ws-dot ws-dot-red" aria-label={en ? 'Close window' : 'Tutup jendela'} onClick={onClose} />
            <button
              type="button"
              className="ws-dot ws-dot-amber"
              aria-label={en ? 'Show Desktop' : 'Tampilkan Desktop'}
              onClick={() => {
                setView('desktop')
                onSelectProgram('desktop')
              }}
            />
            <button
              type="button"
              className="ws-dot ws-dot-green"
              aria-label={en ? 'Expand Terminal' : 'Perlebar Terminal'}
              onClick={() => setView(view === 'terminal' ? 'lab' : 'terminal')}
            />
            <span className="ws-os-brand">IFA Lab OS</span>
          </div>

          <div className="ws-view-tabs" role="tablist" aria-label="Workstation views">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'desktop'}
              className={view === 'desktop' ? 'is-active' : ''}
              onClick={() => {
                setView('desktop')
                onSelectProgram('desktop')
              }}
            >
              <Monitor size={14} aria-hidden="true" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'terminal'}
              className={view === 'terminal' ? 'is-active' : ''}
              onClick={() => setView('terminal')}
            >
              <TerminalIcon size={14} aria-hidden="true" />
              <span>Terminal</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'lab'}
              className={view === 'lab' ? 'is-active' : ''}
              onClick={() => {
                setView('lab')
                if (program === 'desktop') onSelectProgram('stego')
              }}
            >
              <Code2 size={14} aria-hidden="true" />
              <span>{en ? 'Live Lab' : 'Simulasi Lab'}</span>
            </button>
          </div>

          <div className="ws-status-right">
            <span className="ws-status-pill">
              <Wifi size={12} aria-hidden="true" /> 10.14.0.28
            </span>
            <span className="ws-status-pill">
              <BatteryCharging size={12} aria-hidden="true" /> 96%
            </span>
            <span className="ws-clock">{timeNow}</span>
            <button type="button" className="ws-close-btn" aria-label={en ? 'Close workstation' : 'Tutup workstation'} onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Body */}
        {view === 'desktop' ? (
          <div className="ws-desktop">
            {/* Clickable Desktop Icons */}
            <aside className="ws-desktop-icons" aria-label="Desktop folders">
              {DESKTOP_FOLDERS.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={`ws-desktop-icon ${activeFolderId === folder.id && !showReadme ? 'is-selected' : ''}`}
                  onClick={() => openFolder(folder)}
                >
                  <span className="ws-folder-glyph" style={{ color: folder.accent }}>
                    {activeFolderId === folder.id && !showReadme ? (
                      <FolderOpen size={34} aria-hidden="true" />
                    ) : (
                      <Folder size={34} aria-hidden="true" />
                    )}
                  </span>
                  <span className="ws-icon-label">{folder.label}</span>
                </button>
              ))}
              <button
                type="button"
                className={`ws-desktop-icon ${showReadme ? 'is-selected' : ''}`}
                onClick={() => {
                  setShowReadme(true)
                  setActiveFolderId(null)
                }}
              >
                <span className="ws-folder-glyph" style={{ color: '#94a3b8' }}>
                  <FileText size={32} aria-hidden="true" />
                </span>
                <span className="ws-icon-label">README.md</span>
              </button>
              <button
                type="button"
                className="ws-desktop-icon"
                onClick={() => setView('terminal')}
              >
                <span className="ws-folder-glyph" style={{ color: '#34d399' }}>
                  <TerminalIcon size={32} aria-hidden="true" />
                </span>
                <span className="ws-icon-label">Terminal</span>
              </button>
            </aside>

            {/* Realistic OS File Manager Window */}
            <section className="ws-explorer" aria-label="File Explorer">
              <div className="ws-explorer-bar">
                <span className="ws-breadcrumb">
                  <HardDrive size={13} aria-hidden="true" />
                  <span>/home/ifa/Desktop</span>
                  {activeFolder ? (
                    <>
                      <ChevronRight size={13} aria-hidden="true" />
                      <strong>{activeFolder.label}</strong>
                    </>
                  ) : showReadme ? (
                    <>
                      <ChevronRight size={13} aria-hidden="true" />
                      <strong>README.md</strong>
                    </>
                  ) : null}
                </span>
                {activeFolder ? (
                  <span className="ws-explorer-desc">
                    {en ? activeFolder.descriptionEn : activeFolder.descriptionId}
                  </span>
                ) : null}
              </div>

              {showReadme ? (
                <div className="ws-readme-pane">
                  <h3>IFA Lab Virtual Workstation</h3>
                  <p>
                    {en
                      ? 'Explore realistic local simulations across Cyber Security, Web Development, Steganography, and IoT ESP32 right from the login preview.'
                      : 'Jelajahi simulasi lokal yang realistis lintas bidang Cyber Security, Pengembangan Web, Steganografi, dan IoT ESP32 langsung dari layar login.'}
                  </p>
                  <ul>
                    <li><strong>CyberSecurity/</strong> — OWASP Top 10 audit, firewall rules, SAST & SBOM report.</li>
                    <li><strong>WebDev/</strong> — HTML5 semantic markup, FastAPI routes & PostgreSQL indexing.</li>
                    <li><strong>Steganography/</strong> — RGB LSB bit-plane extractor & PNG hex chunk forensics.</li>
                    <li><strong>IoT_ESP32/</strong> — ESP32-C3 DHT22/HC-SR04 firmware & MQTTS TLS config.</li>
                  </ul>
                  <button type="button" className="ws-run-btn" onClick={() => setView('terminal')}>
                    <TerminalIcon size={14} aria-hidden="true" />
                    {en ? 'Open Wide Terminal' : 'Buka Terminal Lebih Lebar'}
                  </button>
                </div>
              ) : (
                <div className="ws-explorer-split">
                  <div className="ws-explorer-sidebar">
                    {DESKTOP_FOLDERS.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        className={activeFolderId === folder.id ? 'is-active' : ''}
                        onClick={() => openFolder(folder)}
                      >
                        <Folder size={14} style={{ color: folder.accent }} aria-hidden="true" />
                        <span>{folder.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="ws-file-list">
                    {(activeFolder?.files ?? []).map((file) => (
                      <button
                        key={file.name}
                        type="button"
                        className={`ws-file-row ${activeFile?.name === file.name ? 'is-active' : ''}`}
                        onClick={() => setSelectedFileName(file.name)}
                      >
                        <span className="ws-file-name">
                          {file.kind === 'image' ? (
                            <FileImage size={15} style={{ color: '#c084fc' }} aria-hidden="true" />
                          ) : file.kind === 'code' ? (
                            <FileCode2 size={15} style={{ color: '#38bdf8' }} aria-hidden="true" />
                          ) : (
                            <FileText size={15} style={{ color: '#94a3b8' }} aria-hidden="true" />
                          )}
                          <span>{file.name}</span>
                        </span>
                        <span className="ws-file-meta">{file.size}</span>
                      </button>
                    ))}
                  </div>

                  {activeFile ? (
                    <div className="ws-file-preview">
                      <div className="ws-preview-head">
                        <div>
                          <strong>{activeFile.name}</strong>
                          <span>{activeFile.size} · {activeFile.modified}</span>
                        </div>
                        <button
                          type="button"
                          className="ws-run-btn"
                          onClick={() => {
                            onSelectProgram(activeFile.relatedMode)
                            setView('terminal')
                            runCommand(activeFile.runCommand)
                          }}
                        >
                          <Play size={13} aria-hidden="true" />
                          {en ? 'Run in Terminal' : 'Jalankan di Terminal'}
                        </button>
                      </div>
                      <pre className="ws-code-box">
                        {activeFile.content.map((line, i) => (
                          <div key={i} className="ws-code-line">
                            <span className="ws-ln">{String(i + 1).padStart(2, '0')}</span>
                            <span>{line || ' '}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            {/* Bottom Frosted OS Dock */}
            <nav className="ws-dock" aria-label="OS quick dock">
              <button
                type="button"
                title="CyberSecurity"
                onClick={() => {
                  onSelectProgram('security')
                  setView('lab')
                }}
              >
                <Shield size={18} style={{ color: '#22c58b' }} aria-hidden="true" />
              </button>
              <button
                type="button"
                title="Web Dev"
                onClick={() => {
                  onSelectProgram('web')
                  setView('lab')
                }}
              >
                <Globe size={18} style={{ color: '#38bdf8' }} aria-hidden="true" />
              </button>
              <button
                type="button"
                title="Steganography"
                onClick={() => {
                  onSelectProgram('stego')
                  setView('lab')
                }}
              >
                <ImageIcon size={18} style={{ color: '#c084fc' }} aria-hidden="true" />
              </button>
              <button
                type="button"
                title="IoT ESP32"
                onClick={() => {
                  onSelectProgram('iot')
                  setView('lab')
                }}
              >
                <Cpu size={18} style={{ color: '#fbbf24' }} aria-hidden="true" />
              </button>
              <button type="button" title="Terminal" onClick={() => setView('terminal')}>
                <TerminalIcon size={18} style={{ color: '#5eead4' }} aria-hidden="true" />
              </button>
            </nav>
          </div>
        ) : (
          <div className={`ws-work-area ${view === 'terminal' ? 'is-terminal-wide' : 'is-lab-split'}`}>
            {/* Mode switcher strip */}
            <div className="ws-mode-strip">
              {AUTO_CYCLE_MODES.map((m) => {
                const idx = LAPTOP_MODES.indexOf(m)
                return (
                  <button
                    key={m}
                    type="button"
                    className={liveMode === m ? 'is-active' : ''}
                    onClick={() => onSelectProgram(m)}
                  >
                    {LAPTOP_MENU[idx]}
                  </button>
                )
              })}
            </div>

            <div className="ws-work-grid">
              {view === 'lab' ? (
                <div className="ws-canvas-card">
                  <canvas
                    ref={canvasRef}
                    width={LAPTOP_WIDTH}
                    height={LAPTOP_HEIGHT}
                    className="ws-live-canvas"
                  />
                </div>
              ) : null}

              {/* Wide Interactive Terminal */}
              <section
                className="ws-terminal"
                aria-label="Interactive workstation terminal"
                onClick={() => inputRef.current?.focus()}
              >
                <div className="ws-term-toolbar">
                  <span className="ws-term-title">
                    <TerminalIcon size={14} aria-hidden="true" />
                    ifa@weblab-workstation: {cwd.replace('/home/ifa', '~')}
                  </span>
                  <div className="ws-term-chips">
                    {[
                      ['ls', 'ls'],
                      ['nmap', 'nmap -sV 192.0.2.10'],
                      ['stegsolve', 'python3 lsb_extract.py cover_lab.png'],
                      ['curl /api', 'curl -i http://localhost:3000/api/v1/labs'],
                      ['esp32', 'lab serial --board esp32-c3'],
                      ['tshark', 'tshark -i lab0 -f "tcp port 8883"'],
                      ['clear', 'clear'],
                    ].map(([label, cmd]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          runCommand(cmd)
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ws-term-log" role="log" aria-live="polite">
                  {history.map((item) => (
                    <div key={item.id} className={`ws-term-line ws-kind-${item.kind}`}>
                      {item.text}
                    </div>
                  ))}
                  <div ref={termEndRef} />
                </div>

                <form
                  className="ws-term-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    runCommand(input)
                  }}
                >
                  <span className="ws-term-prompt">
                    <span className="ws-term-prompt-host">ifa@weblab:</span>
                    <span>{cwd.replace('/home/ifa', '~')}$</span>
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={en ? 'Type help, ls, stegsolve, nmap...' : 'Ketik help, ls, stegsolve, nmap...'}
                    aria-label={en ? 'Terminal command input' : 'Input perintah terminal'}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="ws-term-submit"
                    aria-label={en ? 'Run command' : 'Jalankan perintah'}
                  >
                    <Play size={12} aria-hidden="true" />
                    <span>{en ? 'Run' : 'Kirim'}</span>
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
