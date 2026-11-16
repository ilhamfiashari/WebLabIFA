export type BoardId = 'esp32-c3' | 'esp32' | 'arduino-uno' | 'pico-w'

export type PinKind = 'power' | 'gnd' | 'gpio' | 'adc' | 'pwm' | 'i2c' | 'uart'

export interface PinDef {
  id: string
  label: string
  x: number
  y: number
  voltage: 0 | 3.3 | 5
  kind: PinKind
  gpio?: number
  side: 'left' | 'right' | 'top' | 'bottom'
}

export interface BoardSpec {
  id: BoardId
  name: string
  shortName: string
  arch: string
  logicVoltage: 3.3 | 5
  clockMhz: number
  hasWifi: boolean
  hasBluetooth: boolean
  builtinLedGpio: number
  width: number
  height: number
  pins: PinDef[]
  descriptionId: string
  descriptionEn: string
}

export type ComponentCategory =
  | 'sensors'
  | 'inputs'
  | 'displays'
  | 'actuators'
  | 'passives'

export type ComponentKind =
  | 'led'
  | 'rgb-led'
  | 'pushbutton'
  | 'resistor'
  | 'potentiometer'
  | 'hc-sr04'
  | 'dht22'
  | 'ldr'
  | 'pir'
  | 'oled-ssd1306'
  | 'lcd-1602'
  | 'servo'
  | 'buzzer'
  | 'relay'

export interface ComponentPinDef {
  id: string
  label: string
  dx: number
  dy: number
  role: 'power' | 'gnd' | 'signal' | 'anode' | 'cathode'
}

export interface ComponentSpec {
  kind: ComponentKind
  category: ComponentCategory
  nameId: string
  nameEn: string
  subtitleId: string
  subtitleEn: string
  width: number
  height: number
  pins: ComponentPinDef[]
  pinned?: boolean
}

export interface PlacedComponent {
  id: string
  kind: ComponentKind
  x: number
  y: number
  label: string
  color?: 'red' | 'green' | 'yellow' | 'blue'
  ohms?: 220 | 1000 | 10000
  /** Runtime interactive sensor / input values set by user on canvas */
  props: {
    pressed?: boolean
    distanceCm?: number
    tempC?: number
    humidity?: number
    potPct?: number
    lux?: number
    motion?: boolean
  }
}

export interface WireEndpoint {
  /** 'board' or placed component id */
  nodeId: string
  pinId: string
}

export interface Wire {
  id: string
  from: WireEndpoint
  to: WireEndpoint
  color: string
}

export interface HardwareAlert {
  id: string
  severity: 'error' | 'warn'
  messageId: string
  messageEn: string
}

export interface GpioRuntime {
  gpio: number
  mode: 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT' | 'PWM' | 'ADC'
  digital: 0 | 1
  pwmDuty: number
  adcValue: number
  voltage: number
}

export interface SerialEntry {
  id: string
  timeMs: number
  text: string
  kind: 'rx' | 'tx' | 'sys'
}

export interface PlotPoint {
  t: number
  series: Record<string, number>
}

export interface MqttMessage {
  id: string
  timeMs: number
  broker: string
  topic: string
  payload: string
  tls: boolean
}

export interface SimulationState {
  running: boolean
  elapsedMs: number
  compileError: string | null
  gpioStates: Record<number, GpioRuntime>
  ledBrightness: Record<string, { r: number; g: number; b: number; burned?: boolean }>
  servoAngles: Record<string, number>
  buzzerActive: Record<string, { freq: number; active: boolean }>
  relayClosed: Record<string, boolean>
  oledLines: Record<string, string[]>
  lcdRows: Record<string, [string, string]>
  serialLog: SerialEntry[]
  plotHistory: PlotPoint[]
  mqttMessages: MqttMessage[]
  wifiConnected: boolean
  wifiIp: string
  alerts: HardwareAlert[]
}

export interface IotPresetTemplate {
  id: string
  missionId?: string
  board: BoardId
  titleId: string
  titleEn: string
  badge: string
  summaryId: string
  summaryEn: string
  code: string
  components: PlacedComponent[]
  wires: Wire[]
}

export interface MissionCheckResult {
  id: string
  labelId: string
  labelEn: string
  passed: boolean
}

export interface IotMissionSpec {
  id: string
  presetId: string
  titleId: string
  titleEn: string
  xp: number
  objectiveId: string
  objectiveEn: string
  evaluate: (ctx: {
    board: BoardId
    code: string
    components: PlacedComponent[]
    wires: Wire[]
    sim: SimulationState
    loopIterations: number
  }) => MissionCheckResult[]
}

export interface SavedIotProject {
  id: string
  title: string
  board: BoardId
  mission_id?: string | null
  code: string
  components: PlacedComponent[]
  wires: Wire[]
  updated_at: string
}

export interface CompletedMission {
  mission_id: string
  score: number
  completed_at: string
}
