import type { BoardId, BoardSpec, ComponentKind, ComponentSpec, PinDef } from './types'

function esp32C3Pins(): PinDef[] {
  const leftLabels: Array<{ id: string; label: string; voltage: 0 | 3.3 | 5; kind: PinDef['kind']; gpio?: number }> = [
    { id: '3V3', label: '3V3', voltage: 3.3, kind: 'power' },
    { id: 'GND1', label: 'GND', voltage: 0, kind: 'gnd' },
    { id: 'GPIO0', label: 'GP0 · ADC0', voltage: 3.3, kind: 'adc', gpio: 0 },
    { id: 'GPIO1', label: 'GP1 · ADC1', voltage: 3.3, kind: 'adc', gpio: 1 },
    { id: 'GPIO2', label: 'GP2 · PWM', voltage: 3.3, kind: 'pwm', gpio: 2 },
    { id: 'GPIO3', label: 'GP3 · ADC3', voltage: 3.3, kind: 'adc', gpio: 3 },
    { id: 'GPIO4', label: 'GP4 · PWM', voltage: 3.3, kind: 'pwm', gpio: 4 },
    { id: 'GPIO5', label: 'GP5', voltage: 3.3, kind: 'gpio', gpio: 5 },
  ]
  const rightLabels: Array<{ id: string; label: string; voltage: 0 | 3.3 | 5; kind: PinDef['kind']; gpio?: number }> = [
    { id: '5V', label: '5V (VBUS)', voltage: 5, kind: 'power' },
    { id: 'GND2', label: 'GND', voltage: 0, kind: 'gnd' },
    { id: 'GPIO6', label: 'GP6', voltage: 3.3, kind: 'gpio', gpio: 6 },
    { id: 'GPIO7', label: 'GP7 · PWM', voltage: 3.3, kind: 'pwm', gpio: 7 },
    { id: 'GPIO8', label: 'GP8 · SDA/LED', voltage: 3.3, kind: 'i2c', gpio: 8 },
    { id: 'GPIO9', label: 'GP9 · SCL', voltage: 3.3, kind: 'i2c', gpio: 9 },
    { id: 'GPIO10', label: 'GP10', voltage: 3.3, kind: 'gpio', gpio: 10 },
    { id: 'GPIO21', label: 'GP21 · TX', voltage: 3.3, kind: 'uart', gpio: 21 },
  ]
  return [
    ...leftLabels.map((p, i) => ({ ...p, x: 10, y: 56 + i * 24, side: 'left' as const })),
    ...rightLabels.map((p, i) => ({ ...p, x: 158, y: 56 + i * 24, side: 'right' as const })),
  ]
}

function esp32DevkitPins(): PinDef[] {
  const leftLabels: Array<{ id: string; label: string; voltage: 0 | 3.3 | 5; kind: PinDef['kind']; gpio?: number }> = [
    { id: '3V3', label: '3V3', voltage: 3.3, kind: 'power' },
    { id: 'GND1', label: 'GND', voltage: 0, kind: 'gnd' },
    { id: 'GPIO32', label: 'D32 · ADC', voltage: 3.3, kind: 'adc', gpio: 32 },
    { id: 'GPIO33', label: 'D33 · ADC', voltage: 3.3, kind: 'adc', gpio: 33 },
    { id: 'GPIO25', label: 'D25 · DAC', voltage: 3.3, kind: 'pwm', gpio: 25 },
    { id: 'GPIO26', label: 'D26', voltage: 3.3, kind: 'gpio', gpio: 26 },
    { id: 'GPIO27', label: 'D27', voltage: 3.3, kind: 'gpio', gpio: 27 },
    { id: 'GPIO14', label: 'D14', voltage: 3.3, kind: 'gpio', gpio: 14 },
  ]
  const rightLabels: Array<{ id: string; label: string; voltage: 0 | 3.3 | 5; kind: PinDef['kind']; gpio?: number }> = [
    { id: 'VIN', label: 'VIN (5V)', voltage: 5, kind: 'power' },
    { id: 'GND2', label: 'GND', voltage: 0, kind: 'gnd' },
    { id: 'GPIO2', label: 'D2 · LED', voltage: 3.3, kind: 'pwm', gpio: 2 },
    { id: 'GPIO4', label: 'D4 · PWM', voltage: 3.3, kind: 'pwm', gpio: 4 },
    { id: 'GPIO5', label: 'D5', voltage: 3.3, kind: 'gpio', gpio: 5 },
    { id: 'GPIO18', label: 'D18 · PWM', voltage: 3.3, kind: 'pwm', gpio: 18 },
    { id: 'GPIO21', label: 'D21 · SDA', voltage: 3.3, kind: 'i2c', gpio: 21 },
    { id: 'GPIO22', label: 'D22 · SCL', voltage: 3.3, kind: 'i2c', gpio: 22 },
  ]
  return [
    ...leftLabels.map((p, i) => ({ ...p, x: 10, y: 56 + i * 24, side: 'left' as const })),
    ...rightLabels.map((p, i) => ({ ...p, x: 158, y: 56 + i * 24, side: 'right' as const })),
  ]
}

function arduinoUnoPins(): PinDef[] {
  const leftLabels: Array<{ id: string; label: string; voltage: 0 | 3.3 | 5; kind: PinDef['kind']; gpio?: number }> = [
    { id: '5V', label: '5V', voltage: 5, kind: 'power' },
    { id: '3V3', label: '3.3V', voltage: 3.3, kind: 'power' },
    { id: 'GND1', label: 'GND', voltage: 0, kind: 'gnd' },
    { id: 'A0', label: 'A0 (14)', voltage: 5, kind: 'adc', gpio: 14 },
    { id: 'A1', label: 'A1 (15)', voltage: 5, kind: 'adc', gpio: 15 },
    { id: 'A4', label: 'A4 · SDA', voltage: 5, kind: 'i2c', gpio: 18 },
    { id: 'A5', label: 'A5 · SCL', voltage: 5, kind: 'i2c', gpio: 19 },
    { id: 'D2', label: 'D2', voltage: 5, kind: 'gpio', gpio: 2 },
  ]
  const rightLabels: Array<{ id: string; label: string; voltage: 0 | 3.3 | 5; kind: PinDef['kind']; gpio?: number }> = [
    { id: 'GND2', label: 'GND', voltage: 0, kind: 'gnd' },
    { id: 'D13', label: 'D13 · LED', voltage: 5, kind: 'gpio', gpio: 13 },
    { id: 'D11', label: 'D11 · PWM', voltage: 5, kind: 'pwm', gpio: 11 },
    { id: 'D10', label: 'D10 · PWM', voltage: 5, kind: 'pwm', gpio: 10 },
    { id: 'D9', label: 'D9 · PWM', voltage: 5, kind: 'pwm', gpio: 9 },
    { id: 'D6', label: 'D6 · PWM', voltage: 5, kind: 'pwm', gpio: 6 },
    { id: 'D5', label: 'D5 · PWM', voltage: 5, kind: 'pwm', gpio: 5 },
    { id: 'D4', label: 'D4', voltage: 5, kind: 'gpio', gpio: 4 },
  ]
  return [
    ...leftLabels.map((p, i) => ({ ...p, x: 10, y: 56 + i * 24, side: 'left' as const })),
    ...rightLabels.map((p, i) => ({ ...p, x: 158, y: 56 + i * 24, side: 'right' as const })),
  ]
}

function picoWPins(): PinDef[] {
  const leftLabels: Array<{ id: string; label: string; voltage: 0 | 3.3 | 5; kind: PinDef['kind']; gpio?: number }> = [
    { id: '3V3', label: '3V3 OUT', voltage: 3.3, kind: 'power' },
    { id: 'GND1', label: 'GND', voltage: 0, kind: 'gnd' },
    { id: 'GP2', label: 'GP2', voltage: 3.3, kind: 'gpio', gpio: 2 },
    { id: 'GP3', label: 'GP3', voltage: 3.3, kind: 'gpio', gpio: 3 },
    { id: 'GP4', label: 'GP4 · SDA', voltage: 3.3, kind: 'i2c', gpio: 4 },
    { id: 'GP5', label: 'GP5 · SCL', voltage: 3.3, kind: 'i2c', gpio: 5 },
    { id: 'GP6', label: 'GP6', voltage: 3.3, kind: 'gpio', gpio: 6 },
    { id: 'GP7', label: 'GP7', voltage: 3.3, kind: 'gpio', gpio: 7 },
  ]
  const rightLabels: Array<{ id: string; label: string; voltage: 0 | 3.3 | 5; kind: PinDef['kind']; gpio?: number }> = [
    { id: 'VSYS', label: 'VBUS 5V', voltage: 5, kind: 'power' },
    { id: 'GND2', label: 'GND', voltage: 0, kind: 'gnd' },
    { id: 'GP15', label: 'GP15 · PWM', voltage: 3.3, kind: 'pwm', gpio: 15 },
    { id: 'GP16', label: 'GP16', voltage: 3.3, kind: 'gpio', gpio: 16 },
    { id: 'GP18', label: 'GP18', voltage: 3.3, kind: 'gpio', gpio: 18 },
    { id: 'GP25', label: 'GP25 · LED', voltage: 3.3, kind: 'gpio', gpio: 25 },
    { id: 'GP26', label: 'GP26 · ADC0', voltage: 3.3, kind: 'adc', gpio: 26 },
    { id: 'GP27', label: 'GP27 · ADC1', voltage: 3.3, kind: 'adc', gpio: 27 },
  ]
  return [
    ...leftLabels.map((p, i) => ({ ...p, x: 10, y: 56 + i * 24, side: 'left' as const })),
    ...rightLabels.map((p, i) => ({ ...p, x: 158, y: 56 + i * 24, side: 'right' as const })),
  ]
}

export const BOARDS: Record<BoardId, BoardSpec> = {
  'esp32-c3': {
    id: 'esp32-c3',
    name: 'ESP32-C3 DevKit (RISC-V)',
    shortName: 'ESP32-C3',
    arch: 'RISC-V 32-bit · 160 MHz',
    logicVoltage: 3.3,
    clockMhz: 160,
    hasWifi: true,
    hasBluetooth: true,
    builtinLedGpio: 8,
    width: 168,
    height: 256,
    pins: esp32C3Pins(),
    descriptionId: 'Mikrokontroler RISC-V 3.3V dengan Wi-Fi, BLE, I2C, PWM, dan ADC 12-bit.',
    descriptionEn: '3.3V RISC-V microcontroller with built-in Wi-Fi, BLE, I2C, PWM, and 12-bit ADC.',
  },
  esp32: {
    id: 'esp32',
    name: 'ESP32 DevKit v1 (Dual-Core)',
    shortName: 'ESP32 DevKit',
    arch: 'Xtensa LX6 · 240 MHz',
    logicVoltage: 3.3,
    clockMhz: 240,
    hasWifi: true,
    hasBluetooth: true,
    builtinLedGpio: 2,
    width: 168,
    height: 256,
    pins: esp32DevkitPins(),
    descriptionId: 'Board ESP32 dual-core populer dengan 3.3V GPIO, DAC/ADC, Wi-Fi, dan MQTT.',
    descriptionEn: 'Dual-core ESP32 DevKit with 3.3V GPIO, DAC/ADC, Wi-Fi, and MQTT.',
  },
  'arduino-uno': {
    id: 'arduino-uno',
    name: 'Arduino Uno R3 (ATmega328P)',
    shortName: 'Arduino Uno',
    arch: 'AVR 8-bit · 16 MHz',
    logicVoltage: 5,
    clockMhz: 16,
    hasWifi: false,
    hasBluetooth: false,
    builtinLedGpio: 13,
    width: 168,
    height: 256,
    pins: arduinoUnoPins(),
    descriptionId: 'Board klasik 5V ramah pemula dengan 6 pin PWM dan ADC 10-bit (0..1023).',
    descriptionEn: 'Beginner-friendly 5V AVR board with 6 PWM channels and 10-bit ADC (0..1023).',
  },
  'pico-w': {
    id: 'pico-w',
    name: 'Raspberry Pi Pico W (RP2040)',
    shortName: 'Pi Pico W',
    arch: 'ARM Cortex-M0+ · 133 MHz',
    logicVoltage: 3.3,
    clockMhz: 133,
    hasWifi: true,
    hasBluetooth: true,
    builtinLedGpio: 25,
    width: 168,
    height: 256,
    pins: picoWPins(),
    descriptionId: 'Mikrokontroler dual ARM Cortex-M0+ dengan konektivitas Wi-Fi 3.3V.',
    descriptionEn: 'Dual ARM Cortex-M0+ board with 3.3V GPIO and onboard Wi-Fi.',
  },
}

export const COMPONENT_CATALOG: ComponentSpec[] = [
  {
    kind: 'led',
    category: 'actuators',
    nameId: 'LED 5mm',
    nameEn: '5mm LED',
    subtitleId: 'Lampu indikator digital/PWM',
    subtitleEn: 'Digital / PWM indicator LED',
    width: 64,
    height: 74,
    pinned: true,
    pins: [
      { id: 'A', label: 'Anode (+)', dx: 22, dy: 68, role: 'anode' },
      { id: 'K', label: 'Cathode (-)', dx: 42, dy: 68, role: 'cathode' },
    ],
  },
  {
    kind: 'resistor',
    category: 'passives',
    nameId: 'Resistor 220Ω',
    nameEn: '220Ω Resistor',
    subtitleId: 'Pembatas arus pengaman LED',
    subtitleEn: 'Current-limiting LED resistor',
    width: 82,
    height: 44,
    pinned: true,
    pins: [
      { id: 'P1', label: 'Terminal 1', dx: 6, dy: 22, role: 'signal' },
      { id: 'P2', label: 'Terminal 2', dx: 76, dy: 22, role: 'signal' },
    ],
  },
  {
    kind: 'pushbutton',
    category: 'inputs',
    nameId: 'Pushbutton',
    nameEn: 'Pushbutton',
    subtitleId: 'Tombol taktil klik/tahan',
    subtitleEn: 'Interactive tactile switch',
    width: 72,
    height: 68,
    pinned: true,
    pins: [
      { id: 'OUT', label: 'Signal', dx: 18, dy: 62, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 54, dy: 62, role: 'gnd' },
    ],
  },
  {
    kind: 'potentiometer',
    category: 'inputs',
    nameId: 'Potensiometer',
    nameEn: 'Potentiometer',
    subtitleId: 'Input analog putar (0–100%)',
    subtitleEn: 'Analog rotary knob (0–100%)',
    width: 84,
    height: 86,
    pinned: true,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 80, role: 'power' },
      { id: 'SIG', label: 'SIG (ADC)', dx: 42, dy: 80, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 64, dy: 80, role: 'gnd' },
    ],
  },
  {
    kind: 'hc-sr04',
    category: 'sensors',
    nameId: 'Ultrasonik HC-SR04',
    nameEn: 'HC-SR04 Ultrasonic',
    subtitleId: 'Sensor jarak 2–400 cm',
    subtitleEn: 'Distance sensor 2–400 cm',
    width: 112,
    height: 84,
    pinned: true,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 78, role: 'power' },
      { id: 'TRIG', label: 'TRIG', dx: 44, dy: 78, role: 'signal' },
      { id: 'ECHO', label: 'ECHO', dx: 68, dy: 78, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 92, dy: 78, role: 'gnd' },
    ],
  },
  {
    kind: 'dht22',
    category: 'sensors',
    nameId: 'Sensor DHT22',
    nameEn: 'DHT22 Temp/Hum',
    subtitleId: 'Suhu & kelembapan interaktif',
    subtitleEn: 'Temp & humidity module',
    width: 96,
    height: 84,
    pinned: true,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 22, dy: 78, role: 'power' },
      { id: 'DATA', label: 'DATA', dx: 48, dy: 78, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 74, dy: 78, role: 'gnd' },
    ],
  },
  {
    kind: 'oled-ssd1306',
    category: 'displays',
    nameId: 'OLED SSD1306',
    nameEn: 'OLED SSD1306',
    subtitleId: 'Layar I2C 128×64 piksel',
    subtitleEn: 'I2C 128×64 graphic display',
    width: 124,
    height: 92,
    pinned: true,
    pins: [
      { id: 'GND', label: 'GND', dx: 26, dy: 86, role: 'gnd' },
      { id: 'VCC', label: 'VCC', dx: 50, dy: 86, role: 'power' },
      { id: 'SCL', label: 'SCL', dx: 74, dy: 86, role: 'signal' },
      { id: 'SDA', label: 'SDA', dx: 98, dy: 86, role: 'signal' },
    ],
  },
  {
    kind: 'servo',
    category: 'actuators',
    nameId: 'Servo SG90',
    nameEn: 'SG90 Servo',
    subtitleId: 'Motor sudut PWM 0–180°',
    subtitleEn: '0–180° PWM servo actuator',
    width: 102,
    height: 84,
    pinned: true,
    pins: [
      { id: 'PWM', label: 'PWM', dx: 26, dy: 78, role: 'signal' },
      { id: 'VCC', label: 'VCC', dx: 51, dy: 78, role: 'power' },
      { id: 'GND', label: 'GND', dx: 76, dy: 78, role: 'gnd' },
    ],
  },
  {
    kind: 'buzzer',
    category: 'actuators',
    nameId: 'Buzzer Piezo',
    nameEn: 'Piezo Buzzer',
    subtitleId: 'Alarm suara & frekuensi tone()',
    subtitleEn: 'Audible tone() piezo speaker',
    width: 72,
    height: 72,
    pins: [
      { id: 'POS', label: '(+) Signal', dx: 22, dy: 66, role: 'signal' },
      { id: 'GND', label: '(-) GND', dx: 50, dy: 66, role: 'gnd' },
    ],
  },
  {
    kind: 'rgb-led',
    category: 'actuators',
    nameId: 'RGB LED',
    nameEn: 'RGB LED',
    subtitleId: 'Campuran warna Merah/Hijau/Biru',
    subtitleEn: 'Tri-color PWM LED',
    width: 82,
    height: 74,
    pins: [
      { id: 'R', label: 'Red', dx: 16, dy: 68, role: 'anode' },
      { id: 'GND', label: 'GND', dx: 34, dy: 68, role: 'cathode' },
      { id: 'G', label: 'Green', dx: 52, dy: 68, role: 'anode' },
      { id: 'B', label: 'Blue', dx: 70, dy: 68, role: 'anode' },
    ],
  },
  {
    kind: 'ldr',
    category: 'sensors',
    nameId: 'Sensor Cahaya LDR',
    nameEn: 'Photoresistor LDR',
    subtitleId: 'Simulasi intensitas cahaya (lux)',
    subtitleEn: 'Interactive ambient light sensor',
    width: 86,
    height: 78,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 72, role: 'power' },
      { id: 'AO', label: 'AO (ADC)', dx: 43, dy: 72, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 66, dy: 72, role: 'gnd' },
    ],
  },
  {
    kind: 'pir',
    category: 'sensors',
    nameId: 'Sensor Gerak PIR',
    nameEn: 'PIR Motion Sensor',
    subtitleId: 'Deteksi gerakan objek digital',
    subtitleEn: 'Digital motion trigger',
    width: 86,
    height: 82,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 76, role: 'power' },
      { id: 'OUT', label: 'OUT', dx: 43, dy: 76, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 66, dy: 76, role: 'gnd' },
    ],
  },
  {
    kind: 'lcd-1602',
    category: 'displays',
    nameId: 'LCD 16×2 I2C',
    nameEn: 'I2C LCD 16×2',
    subtitleId: 'Layar karakter 16 kolom × 2 baris',
    subtitleEn: '16×2 character I2C backlight',
    width: 132,
    height: 78,
    pins: [
      { id: 'GND', label: 'GND', dx: 26, dy: 72, role: 'gnd' },
      { id: 'VCC', label: 'VCC', dx: 52, dy: 72, role: 'power' },
      { id: 'SDA', label: 'SDA', dx: 78, dy: 72, role: 'signal' },
      { id: 'SCL', label: 'SCL', dx: 104, dy: 72, role: 'signal' },
    ],
  },
  {
    kind: 'relay',
    category: 'actuators',
    nameId: 'Modul Relay',
    nameEn: 'Relay Module',
    subtitleId: 'Sakelar beban terisolasi 1 kanal',
    subtitleEn: 'Single-channel isolated switch',
    width: 92,
    height: 78,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 22, dy: 72, role: 'power' },
      { id: 'IN', label: 'IN', dx: 46, dy: 72, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 70, dy: 72, role: 'gnd' },
    ],
  },
]

export function getComponentSpec(kind: ComponentKind): ComponentSpec {
  return COMPONENT_CATALOG.find((c) => c.kind === kind) ?? COMPONENT_CATALOG[0]
}

export function getBoardPin(boardId: BoardId, pinId: string): PinDef | undefined {
  return BOARDS[boardId].pins.find((p) => p.id === pinId)
}

export const WIRE_COLORS = [
  { id: '#ef4444', nameId: 'Merah (VCC)', nameEn: 'Red (VCC)' },
  { id: '#1e293b', nameId: 'Hitam (GND)', nameEn: 'Black (GND)' },
  { id: '#10b981', nameId: 'Hijau (Sinyal)', nameEn: 'Green (Signal)' },
  { id: '#3b82f6', nameId: 'Biru (I2C/PWM)', nameEn: 'Blue (I2C/PWM)' },
  { id: '#f59e0b', nameId: 'Oranye (Data)', nameEn: 'Orange (Data)' },
  { id: '#8b5cf6', nameId: 'Ungu (Analog)', nameEn: 'Purple (Analog)' },
]
