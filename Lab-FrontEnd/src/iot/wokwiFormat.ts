import { BOARDS, getBoardInstances, getBoardPin, getComponentSpec } from './boards'
import type { BoardId, ComponentKind, LogicSample, PlacedComponent, Wire } from './types'

export const WOKWI_BOARD_TYPE_MAP: Record<BoardId, string> = {
  'esp32-c3': 'wokwi-esp32-c3-devkitm-1',
  esp32: 'wokwi-esp32-devkit-v1',
  'arduino-uno': 'wokwi-arduino-uno',
  'arduino-nano': 'wokwi-arduino-nano',
  'arduino-mega': 'wokwi-arduino-mega',
  'pico-w': 'wokwi-pi-pico',
  'pi-pico': 'wokwi-pi-pico',
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
  'stepper-a4988': 'wokwi-a4988',
  buzzer: 'wokwi-buzzer',
  relay: 'wokwi-relay-module',
  'shift-74hc595': 'wokwi-74hc595',
  'shift-74hc165': 'wokwi-74hc165',
  microsd: 'wokwi-microsd-card',
  'lcd-nokia5110': 'wokwi-nokia-5110-screen',
  'neopixel-single': 'wokwi-neopixel',
  'clock-gen': 'wokwi-clock-generator',
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

function buildWokwiAttrs(c: PlacedComponent): Record<string, string> {
  const attrs: Record<string, string> = {}
  const p = c.props
  if (c.label) attrs.label = c.label
  if (c.color && (c.kind === 'led' || c.kind === 'pushbutton' || c.kind === 'seven-seg' || c.kind === 'seven-seg-4' || c.kind === 'led-bar-graph' || c.kind === 'max7219-matrix')) {
    attrs.color = c.color
  }
  if (c.kind === 'led' && p.flip) attrs.flip = '1'
  if ((c.kind === 'rgb-led' || c.kind === 'seven-seg') && p.common) attrs.common = p.common
  if (c.kind === 'seven-seg') {
    if (p.digits) attrs.digits = String(p.digits)
    if (p.colon) attrs.colon = '1'
  }
  if (c.kind === 'seven-seg-4' && p.tmType) attrs.type = p.tmType
  if (c.kind === 'resistor') attrs.value = String(c.ohms ?? 220)
  if (c.kind === 'pushbutton') {
    if (p.bounce === false) attrs.bounce = '0'
    if (p.shortcutKey) attrs.key = p.shortcutKey
  }
  if (c.kind === 'slide-switch') {
    if (p.pressed) attrs.value = '1'
    if (p.bounce === false) attrs.bounce = '0'
  }
  if (c.kind === 'dht22') {
    attrs.temperature = String(p.tempC ?? 28)
    attrs.humidity = String(p.humidity ?? 60)
  }
  if (c.kind === 'hc-sr04') attrs.distance = String(p.distanceCm ?? 40)
  if (c.kind === 'ntc') {
    attrs.temperature = String(p.tempC ?? 25)
    if (p.ntcBeta) attrs.beta = String(p.ntcBeta)
  }
  if (c.kind === 'ldr') {
    attrs.lux = String(p.lux ?? 420)
    if (p.ldrThreshold !== undefined) attrs.threshold = String(p.ldrThreshold)
    if (p.ldrRl10 !== undefined) attrs.rl10 = String(p.ldrRl10)
    if (p.ldrGamma !== undefined) attrs.gamma = String(p.ldrGamma)
  }
  if (c.kind === 'lcd-1602' || c.kind === 'lcd-20x4') {
    if (p.lcdPins) attrs.pins = p.lcdPins
    if (p.i2cAddress) attrs.i2cAddress = p.i2cAddress
    if (p.lcdBackground) attrs.background = p.lcdBackground
    if (p.lcdTextColor) attrs.color = p.lcdTextColor
  }
  if (c.kind === 'neopixel-ring' && p.ringPixels) attrs.pixels = String(p.ringPixels)
  if (c.kind === 'servo') {
    if (p.servoHorn) attrs.horn = p.servoHorn
    if (p.servoHornColor) attrs.hornColor = p.servoHornColor
  }
  if (c.kind === 'buzzer') {
    if (p.buzzerMode) attrs.mode = p.buzzerMode
    if (p.buzzerVolume !== undefined) attrs.volume = String(p.buzzerVolume)
  }
  if (c.kind === 'relay' && p.relayTransistor) attrs.transistor = p.relayTransistor
  if (c.kind === 'hx711' && p.hxType) attrs.type = p.hxType
  if (c.kind === 'max7219-matrix') {
    if (p.matrixChain) attrs.chain = String(p.matrixChain)
    if (p.matrixLayout) attrs.layout = p.matrixLayout
  }
  return attrs
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
        const attrs = buildWokwiAttrs(c)
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
    const attrs = p.attrs ?? {}
    components.push({
      id: p.id,
      kind,
      x: Number(p.left) || 320,
      y: Number(p.top) || 120,
      rotate: p.rotate ? ((Math.round(Number(p.rotate) / 90) * 90) % 360 + 360) % 360 : 0,
      label: attrs.label || (kind === 'resistor' ? `R (${attrs.value ?? '220'}Ω)` : spec.nameId),
      color: attrs.color ?? (kind === 'led' || kind === 'pushbutton' ? 'red' : undefined),
      ohms: kind === 'resistor' ? Math.max(1, Number(attrs.value ?? 220) || 220) : undefined,
      props: {
        tempC: attrs.temperature ? Number(attrs.temperature) : kind === 'dht22' ? 28 : kind === 'ntc' ? 25 : undefined,
        humidity: attrs.humidity ? Number(attrs.humidity) : kind === 'dht22' ? 60 : undefined,
        distanceCm: attrs.distance ? Number(attrs.distance) : kind === 'hc-sr04' ? 40 : undefined,
        potPct: kind === 'potentiometer' || kind === 'slide-pot' ? 50 : undefined,
        lux: attrs.lux ? Number(attrs.lux) : kind === 'ldr' ? 420 : undefined,
        pressed: kind === 'slide-switch' ? attrs.value === '1' : undefined,
        flip: attrs.flip === '1',
        common: attrs.common === 'anode' || attrs.common === 'cathode' ? attrs.common : undefined,
        digits: attrs.digits ? (Number(attrs.digits) as 1 | 2 | 3 | 4) : undefined,
        colon: attrs.colon === '1',
        tmType: attrs.type === 'dp' || attrs.type === 'colon' ? attrs.type : undefined,
        bounce: attrs.bounce !== '0',
        shortcutKey: attrs.key || undefined,
        lcdPins: attrs.pins === 'i2c' || attrs.pins === 'full' ? attrs.pins : undefined,
        i2cAddress: attrs.i2cAddress || undefined,
        lcdBackground: attrs.background === 'blue' || attrs.background === 'green' ? attrs.background : undefined,
        lcdTextColor: attrs.color === 'white' || attrs.color === 'black' ? attrs.color : undefined,
        ringPixels: attrs.pixels ? (Number(attrs.pixels) as 8 | 12 | 16 | 24) : undefined,
        servoHorn: attrs.horn === 'single' || attrs.horn === 'double' || attrs.horn === 'cross' ? attrs.horn : undefined,
        servoHornColor: attrs.hornColor || undefined,
        buzzerMode: attrs.mode === 'accurate' || attrs.mode === 'smooth' ? attrs.mode : undefined,
        buzzerVolume: attrs.volume ? Number(attrs.volume) : undefined,
        relayTransistor: attrs.transistor === 'pnp' || attrs.transistor === 'npn' ? attrs.transistor : undefined,
        hxType: attrs.type === '5kg' || attrs.type === '50kg' || attrs.type === 'gauge' ? attrs.type : undefined,
        matrixChain: attrs.chain ? (Number(attrs.chain) as 1 | 2 | 4) : undefined,
        matrixLayout: attrs.layout === 'fc16' || attrs.layout === 'parola' ? attrs.layout : undefined,
        ntcBeta: attrs.beta ? Number(attrs.beta) : undefined,
        ldrThreshold: attrs.threshold ? Number(attrs.threshold) : undefined,
        ldrRl10: attrs.rl10 ? Number(attrs.rl10) : undefined,
        ldrGamma: attrs.gamma ? Number(attrs.gamma) : undefined,
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
  { id: 'sd', name: 'SD (SPI Storage)', version: '1.3.0', include: '#include <SD.h>', descriptionId: 'Baca/tulis file logging ke modul MicroSD Card SPI', descriptionEn: 'Read/write data logs on SPI MicroSD Card module' },
  { id: 'nokia', name: 'Adafruit PCD8544 Nokia 5110', version: '2.0.3', include: '#include <Adafruit_PCD8544.h>', descriptionId: 'Driver layar monokrom SPI Nokia 5110 84×48', descriptionEn: 'Monochrome SPI driver for Nokia 5110 84×48 LCD' },
  { id: 'accelstepper', name: 'AccelStepper', version: '1.64.0', include: '#include <AccelStepper.h>', descriptionId: 'Kontrol akselerasi Stepper Motor & driver A4988', descriptionEn: 'Stepper acceleration & A4988 Step/Dir driver' },
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
