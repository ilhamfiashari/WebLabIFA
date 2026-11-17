export type BoardId =
  | 'esp32-c3'
  | 'esp32'
  | 'arduino-uno'
  | 'arduino-nano'
  | 'arduino-mega'
  | 'pico-w'
  | 'pi-pico'

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
  | 'microcontrollers'
  | 'sensors'
  | 'inputs'
  | 'displays'
  | 'actuators'
  | 'passives'

export type ComponentKind =
  | 'mcu'
  | 'led'
  | 'rgb-led'
  | 'pushbutton'
  | 'slide-switch'
  | 'resistor'
  | 'breadboard'
  | 'potentiometer'
  | 'slide-pot'
  | 'joystick'
  | 'rotary-encoder'
  | 'keypad-4x4'
  | 'dip-switch'
  | 'ir-receiver'
  | 'ir-remote'
  | 'hc-sr04'
  | 'dht22'
  | 'mq2'
  | 'ds18b20'
  | 'ntc'
  | 'ldr'
  | 'pir'
  | 'mpu6050'
  | 'bmp180'
  | 'hx711'
  | 'rfid-rc522'
  | 'rtc-ds1307'
  | 'oled-ssd1306'
  | 'lcd-1602'
  | 'lcd-20x4'
  | 'seven-seg'
  | 'seven-seg-4'
  | 'led-bar-graph'
  | 'max7219-matrix'
  | 'neopixel-ring'
  | 'neopixel-strip'
  | 'tft-ili9341'
  | 'servo'
  | 'stepper'
  | 'stepper-a4988'
  | 'buzzer'
  | 'relay'
  | 'shift-74hc595'
  | 'shift-74hc165'
  | 'microsd'
  | 'lcd-nokia5110'
  | 'neopixel-single'
  | 'clock-gen'

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
  /** When kind === 'mcu', identifies which microcontroller board hardware spec to render */
  boardId?: BoardId
  x: number
  y: number
  /** Rotation in 90-degree increments matching Wokwi diagram.json (0, 90, 180, 270) */
  rotate?: number
  label: string
  color?: string
  ohms?: number
  /** Runtime interactive sensor / input values & Wokwi attrs set by user on canvas */
  props: {
    pressed?: boolean
    latched?: boolean
    distanceCm?: number
    tempC?: number
    humidity?: number
    potPct?: number
    lux?: number
    motion?: boolean
    gasPpm?: number
    pressureHpa?: number
    tiltDeg?: number
    weightKg?: number
    joyX?: number
    joyY?: number
    dipBits?: number[]
    encoderStep?: number
    lastKey?: string
    rfidUid?: string | null
    irHex?: string | null
    /* Wokwi component configuration attributes (attrs) */
    flip?: boolean
    common?: 'anode' | 'cathode'
    digits?: 1 | 2 | 3 | 4
    colon?: boolean
    tmType?: 'colon' | 'dp'
    bounce?: boolean
    shortcutKey?: string
    lcdPins?: 'i2c' | 'full'
    i2cAddress?: string
    lcdBackground?: 'green' | 'blue'
    lcdTextColor?: 'black' | 'white'
    ringPixels?: 8 | 12 | 16 | 24
    servoHorn?: 'single' | 'double' | 'cross'
    servoHornColor?: string
    buzzerMode?: 'smooth' | 'accurate'
    buzzerVolume?: number
    relayTransistor?: 'npn' | 'pnp'
    hxType?: '50kg' | '5kg' | 'gauge'
    matrixChain?: 1 | 2 | 4
    matrixLayout?: 'parola' | 'fc16'
    ntcBeta?: number
    ldrThreshold?: number
    ldrRl10?: number
    ldrGamma?: number
  }
}

export interface WireWaypoint {
  x: number
  y: number
}

export interface WireEndpoint {
  /** 'board', 'mcu-*', or placed component id */
  nodeId: string
  pinId: string
}

export interface Wire {
  id: string
  from: WireEndpoint
  to: WireEndpoint
  color: string
  /** Flexible multi-point bend vertices along wire path */
  waypoints?: WireWaypoint[]
  /** Legacy single elbow point kept for backwards compatibility */
  bendX?: number
  bendY?: number
}

export interface HardwareAlert {
  id: string
  severity: 'error' | 'warn'
  messageId: string
  messageEn: string
}

export interface CircuitDiagnosticItem {
  id: string
  status: 'ok' | 'warn' | 'error'
  textId: string
  textEn: string
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

export interface LogicSample {
  timeMs: number
  channels: Record<number, 0 | 1>
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
  logicHistory: LogicSample[]
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
