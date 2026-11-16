import { BOARDS, getBoardInstances, getBoardPin, getComponentSpec } from './boards'
import type { BoardId, ComponentKind, LogicSample, PlacedComponent, Wire } from './types'

export const WOKWI_BOARD_TYPE_MAP: Record<BoardId, string> = {
  'esp32-c3': 'wokwi-esp32-c3-devkitm-1',
  esp32: 'wokwi-esp32-devkit-v1',
  'arduino-uno': 'wokwi-arduino-uno',
  'arduino-mega': 'wokwi-arduino-mega',
  'pico-w': 'wokwi-pi-pico',
}

export const WOKWI_PART_TYPE_MAP: Record<Exclude<ComponentKind, 'mcu'>, string> = {
  led: 'wokwi-led',
  'rgb-led': 'wokwi-rgb-led',
  pushbutton: 'wokwi-pushbutton',
  'slide-switch': 'wokwi-slide-switch',
  resistor: 'wokwi-resistor',
  breadboard: 'wokwi-breadboard-half',
  potentiometer: 'wokwi-potentiometer',
  'slide-pot': 'wokwi-slide-potentiometer',
  joystick: 'wokwi-analog-joystick',
  'rotary-encoder': 'wokwi-ky-040',
  'keypad-4x4': 'wokwi-membrane-keypad',
  'dip-switch': 'wokwi-dip-switch-8',
  'ir-receiver': 'wokwi-ir-receiver',
  'ir-remote': 'wokwi-ir-remote',
  'hc-sr04': 'wokwi-hc-sr04',
  dht22: 'wokwi-dht22',
  mq2: 'wokwi-mq2-gas-sensor',
  ds18b20: 'wokwi-ds18b20',
  ntc: 'wokwi-ntc-temperature-sensor',
  ldr: 'wokwi-photoresistor-sensor',
  pir: 'wokwi-pir-motion-sensor',
  mpu6050: 'wokwi-mpu6050',
  bmp180: 'wokwi-bmp180',
  hx711: 'wokwi-hx711',
  'rfid-rc522': 'wokwi-mfrc522',
  'rtc-ds1307': 'wokwi-ds1307',
  'oled-ssd1306': 'board-ssd1306',
  'lcd-1602': 'wokwi-lcd1602',
  'lcd-20x4': 'wokwi-lcd2004',
  'seven-seg': 'wokwi-7segment',
  'seven-seg-4': 'wokwi-tm1637-7segment',
  'led-bar-graph': 'wokwi-led-bar-graph',
  'max7219-matrix': 'wokwi-max7219-matrix',
  'neopixel-ring': 'wokwi-neopixel-ring',
  'neopixel-strip': 'wokwi-led-strip',
  'tft-ili9341': 'wokwi-ili9341',
  servo: 'wokwi-servo',
  stepper: 'wokwi-stepper-motor',
  buzzer: 'wokwi-buzzer',
  relay: 'wokwi-relay-module',
}

export interface WokwiDiagramPart {
  id: string
  type: string
  top: number
  left: number
  rotate?: number
  hide?: boolean
  attrs?: Record<string, string>
}

export type WokwiConnectionTuple = [string, string, string, string[]]

export interface WokwiDiagramJson {
  version: number
  author: string
  editor: string
  parts: WokwiDiagramPart[]
  connections: WokwiConnectionTuple[]
  serialMonitor?: { display: 'auto' | 'always' | 'never'; newline?: 'lf' | 'crlf' }
  dependencies?: Record<string, string>
}

export function toWokwiDiagramJson(
  boardId: BoardId,
  components: PlacedComponent[],
  wires: Wire[],
  author = 'IFA Lab Practicum',
): WokwiDiagramJson {
  const boards = getBoardInstances(boardId, components)
  const parts: WokwiDiagramPart[] = [
    ...boards.map((b) => ({
      type: WOKWI_BOARD_TYPE_MAP[b.boardId],
      id: b.nodeId,
      top: Math.round(b.y),
      left: Math.round(b.x),
      attrs: { label: b.label },
    })),
    ...components
      .filter((c) => c.kind !== 'mcu')
      .map((c) => {
        const k = c.kind as Exclude<ComponentKind, 'mcu'>
        const attrs: Record<string, string> = {}
        if (c.kind === 'led' && c.color) attrs.color = c.color
        if (c.kind === 'resistor') attrs.value = String(c.ohms ?? 220)
        if (c.kind === 'dht22') {
          attrs.temperature = String(c.props.tempC ?? 28)
          attrs.humidity = String(c.props.humidity ?? 60)
        }
        return {
          type: WOKWI_PART_TYPE_MAP[k] ?? `wokwi-${c.kind}`,
          id: c.id,
          top: Math.round(c.y),
          left: Math.round(c.x),
          ...(c.rotate ? { rotate: c.rotate } : {}),
          ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
        }
      }),
  ]

  const connections: WokwiConnectionTuple[] = wires.map((w) => {
    const hints = (w.waypoints ?? []).flatMap((wp) => [`h${Math.round(wp.x)}`, `v${Math.round(wp.y)}`])
    return [`${w.from.nodeId}:${w.from.pinId}`, `${w.to.nodeId}:${w.to.pinId}`, w.color || '#10b981', hints]
  })

  return {
    version: 1,
    author,
    editor: 'wokwi',
    parts,
    connections,
    serialMonitor: { display: 'always', newline: 'lf' },
  }
}

export interface WokwiLintResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const REVERSE_BOARD_MAP: Record<string, BoardId> = Object.fromEntries(
  Object.entries(WOKWI_BOARD_TYPE_MAP).map(([k, v]) => [v, k as BoardId]),
) as Record<string, BoardId>

const REVERSE_PART_MAP: Record<string, Exclude<ComponentKind, 'mcu'>> = Object.fromEntries(
  Object.entries(WOKWI_PART_TYPE_MAP).map(([k, v]) => [v, k as Exclude<ComponentKind, 'mcu'>]),
) as Record<string, Exclude<ComponentKind, 'mcu'>>

export function lintWokwiDiagram(rawText: string): WokwiLintResult {
  let doc: WokwiDiagramJson
  try {
    doc = JSON.parse(rawText) as WokwiDiagramJson
  } catch (err) {
    return { valid: false, errors: [`Syntax JSON tidak valid: ${(err as Error).message}`], warnings: [] }
  }
  const errors: string[] = []
  const warnings: string[] = []

  if (doc.version !== 1) errors.push('Properti "version" harus bernilai 1.')
  if (!Array.isArray(doc.parts)) {
    errors.push('Properti "parts" harus berupa array.')
    return { valid: false, errors, warnings }
  }

  const idCounts = new Map<string, number>()
  const partMap = new Map<string, WokwiDiagramPart>()
  for (const p of doc.parts) {
    if (!p.id || !p.type) {
      errors.push('Setiap part wajib memiliki "id" dan "type".')
      continue
    }
    idCounts.set(p.id, (idCounts.get(p.id) ?? 0) + 1)
    partMap.set(p.id, p)
    if (!REVERSE_BOARD_MAP[p.type] && !REVERSE_PART_MAP[p.type]) {
      warnings.push(`Tipe part "${p.type}" pada "${p.id}" belum terdaftar di katalog standar.`)
    }
  }
  for (const [id, count] of idCounts.entries()) {
    if (count > 1) errors.push(`Duplicate part ID: "${id}" muncul ${count} kali.`)
  }

  const hasBoard = doc.parts.some((p) => Boolean(REVERSE_BOARD_MAP[p.type]))
  if (!hasBoard) errors.push('Minimal harus ada 1 mikrokontroler di "parts".')

  if (Array.isArray(doc.connections)) {
    for (let i = 0; i < doc.connections.length; i++) {
      const tuple = doc.connections[i]
      if (!Array.isArray(tuple) || tuple.length < 2) {
        errors.push(`Koneksi baris #${i + 1} wajib berbentuk ["part:pin", "part:pin", "color", []].`)
        continue
      }
      for (const epStr of [tuple[0], tuple[1]]) {
        const [nid, pid] = String(epStr).split(':')
        const part = partMap.get(nid)
        if (!part) {
          errors.push(`Koneksi "${epStr}" merujuk part "${nid}" yang tidak ada.`)
          continue
        }
        const mcu = REVERSE_BOARD_MAP[part.type]
        if (mcu) {
          if (!getBoardPin(mcu, pid)) errors.push(`Pin "${pid}" tidak ditemukan di board "${nid}" (${part.type}).`)
        } else {
          const kind = REVERSE_PART_MAP[part.type]
          if (kind && !getComponentSpec(kind).pins.some((pin) => pin.id === pid)) {
            errors.push(`Pin "${pid}" tidak ditemukan di komponen "${nid}" (${part.type}).`)
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function parseWokwiDiagramJson(rawText: string): {
  ok: true
  boardId: BoardId
  components: PlacedComponent[]
  wires: Wire[]
} | { ok: false; error: string } {
  const lint = lintWokwiDiagram(rawText)
  if (!lint.valid) {
    return { ok: false, error: lint.errors[0] ?? 'diagram.json tidak valid' }
  }
  const doc = JSON.parse(rawText) as WokwiDiagramJson
  const mcuParts = doc.parts.filter((p) => Boolean(REVERSE_BOARD_MAP[p.type]))
  const primaryPart = mcuParts.find((p) => p.id === 'board') ?? mcuParts[0]
  const primaryBoardId: BoardId = REVERSE_BOARD_MAP[primaryPart.type] ?? 'esp32-c3'

  const components: PlacedComponent[] = []
  for (const p of doc.parts) {
    const bId = REVERSE_BOARD_MAP[p.type]
    if (bId) {
      components.push({
        id: p.id,
        kind: 'mcu',
        boardId: bId,
        x: Number(p.left) || 48,
        y: Number(p.top) || 76,
        label: p.attrs?.label || BOARDS[bId].shortName,
        props: {},
      })
      continue
    }
    const kind = REVERSE_PART_MAP[p.type]
    if (!kind) continue
    const spec = getComponentSpec(kind)
    components.push({
      id: p.id,
      kind,
      x: Number(p.left) || 320,
      y: Number(p.top) || 120,
      rotate: p.rotate ? ((Math.round(Number(p.rotate) / 90) * 90) % 360 + 360) % 360 : 0,
      label: kind === 'resistor' ? `R (${p.attrs?.value ?? '220'}Ω)` : spec.nameId,
      color: (p.attrs?.color as PlacedComponent['color']) ?? (kind === 'led' ? 'red' : undefined),
      ohms: kind === 'resistor' ? Math.max(10, Number(p.attrs?.value ?? 220) || 220) : undefined,
      props: {
        tempC: p.attrs?.temperature ? Number(p.attrs.temperature) : kind === 'dht22' ? 28 : undefined,
        humidity: p.attrs?.humidity ? Number(p.attrs.humidity) : kind === 'dht22' ? 60 : undefined,
        distanceCm: kind === 'hc-sr04' ? 40 : undefined,
        potPct: kind === 'potentiometer' || kind === 'slide-pot' ? 50 : undefined,
        lux: kind === 'ldr' ? 420 : undefined,
      },
    })
  }

  const wires: Wire[] = (doc.connections ?? []).map((tuple, idx) => {
    const [fromStr, toStr, color] = tuple
    const [fn, fp] = fromStr.split(':')
    const [tn, tp] = toStr.split(':')
    return {
      id: `wire-doc-${idx + 1}`,
      from: { nodeId: fn, pinId: fp },
      to: { nodeId: tn, pinId: tp },
      color: color || '#10b981',
    }
  })

  return { ok: true, boardId: primaryBoardId, components, wires }
}

export interface WokwiLibrarySpec {
  id: string
  name: string
  version: string
  include: string
  descriptionId: string
  descriptionEn: string
}

export const WOKWI_LIBRARY_REGISTRY: WokwiLibrarySpec[] = [
  { id: 'dht', name: 'DHT sensor library', version: '1.4.6', include: '#include <DHT.h>', descriptionId: 'Pembacaan suhu & kelembapan DHT22/DHT11', descriptionEn: 'DHT22 / DHT11 temperature & humidity sensor' },
  { id: 'ssd1306', name: 'Adafruit SSD1306', version: '2.5.10', include: '#include <Adafruit_SSD1306.h>', descriptionId: 'Driver layar OLED I2C/SPI 128×64', descriptionEn: '128×64 OLED display I2C driver' },
  { id: 'lcd-i2c', name: 'LiquidCrystal I2C', version: '1.1.4', include: '#include <LiquidCrystal_I2C.h>', descriptionId: 'Kontrol layar karakter LCD 16×2 & 20×4 I2C', descriptionEn: 'Control 16×2 & 20×4 character LCD over I2C' },
  { id: 'servo', name: 'ESP32Servo', version: '3.0.5', include: '#include <ESP32Servo.h>', descriptionId: 'Kontrol sudut PWM motor Servo SG90/MG996R', descriptionEn: 'PWM Servo angle driver for ESP32 & Arduino' },
  { id: 'fastled', name: 'FastLED / NeoPixel', version: '3.7.0', include: '#include <Adafruit_NeoPixel.h>', descriptionId: 'Animasi WS2812 RGB Ring, Strip & Dot Matrix', descriptionEn: 'Addressable WS2812 Ring & Strip RGB driver' },
  { id: 'pubsub', name: 'PubSubClient (MQTT)', version: '2.8.0', include: '#include <PubSubClient.h>', descriptionId: 'Klien MQTT + Wi-Fi Wokwi-GUEST untuk telemetri', descriptionEn: 'MQTT telemetry client over Wokwi-GUEST Wi-Fi' },
  { id: 'mpu6050', name: 'Adafruit MPU6050', version: '2.2.6', include: '#include <Adafruit_MPU6050.h>', descriptionId: 'Sensor Akselerometer & Giroskop 6-Axis I2C', descriptionEn: '6-axis IMU accelerometer & gyroscope' },
  { id: 'mfrc522', name: 'MFRC522 RFID', version: '1.4.11', include: '#include <MFRC522.h>', descriptionId: 'Pembaca kartu NFC/RFID 13.56MHz SPI', descriptionEn: '13.56MHz SPI RFID tag reader' },
  { id: 'tm1637', name: 'TM1637Display', version: '1.2.0', include: '#include <TM1637Display.h>', descriptionId: 'Tampilan angka 4-digit 7-Segment LED', descriptionEn: '4-digit 7-segment display driver' },
  { id: 'hx711', name: 'HX711 ADC', version: '0.7.5', include: '#include <HX711.h>', descriptionId: 'Amplifier sensor berat Load Cell 24-bit', descriptionEn: '24-bit Load Cell weight bridge amplifier' },
]

export function buildVcdExport(samples: LogicSample[], gpios: number[]): string {
  const symbols = ['!', '"', '#', '$', '%', '&', '\'', '(']
  const active = gpios.slice(0, 8)
  const lines: string[] = [
    '$version Wokwi-Compatible IFA Logic Analyzer 1.0 $end',
    '$timescale 1ms $end',
    '$scope module logic $end',
    ...active.map((g, i) => `$var wire 1 ${symbols[i]} D${g} $end`),
    '$upscope $end',
    '$enddefinitions $end',
  ]
  for (const s of samples) {
    lines.push(`#${Math.round(s.timeMs)}`)
    for (let i = 0; i < active.length; i++) {
      const bit = s.channels[active[i]] ?? 0
      lines.push(`${bit}${symbols[i]}`)
    }
  }
  return lines.join('\n')
}
