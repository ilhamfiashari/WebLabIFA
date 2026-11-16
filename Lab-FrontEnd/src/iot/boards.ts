import type { BoardId, BoardSpec, ComponentKind, ComponentSpec, PinDef, PlacedComponent } from './types'

interface RawPin {
  id: string
  label: string
  voltage: 0 | 3.3 | 5
  kind: PinDef['kind']
  gpio?: number
}

function makeVerticalPins(width: number, startY: number, stepY: number, left: RawPin[], right: RawPin[]): PinDef[] {
  return [
    ...left.map((p, i) => ({ ...p, x: 11, y: startY + i * stepY, side: 'left' as const })),
    ...right.map((p, i) => ({ ...p, x: width - 11, y: startY + i * stepY, side: 'right' as const })),
  ]
}

function makeHorizontalPins(
  topPins: Array<RawPin & { x: number }>,
  bottomPins: Array<RawPin & { x: number }>,
  topY: number,
  bottomY: number,
): PinDef[] {
  return [
    ...topPins.map((p) => ({ ...p, y: topY, side: 'top' as const })),
    ...bottomPins.map((p) => ({ ...p, y: bottomY, side: 'bottom' as const })),
  ]
}

export const BOARDS: Record<BoardId, BoardSpec> = {
  'esp32-c3': {
    id: 'esp32-c3',
    name: 'ESP32-C3 SuperMini / DevKit (RISC-V)',
    shortName: 'ESP32-C3',
    arch: 'RISC-V 32-bit · 160 MHz',
    logicVoltage: 3.3,
    clockMhz: 160,
    hasWifi: true,
    hasBluetooth: true,
    builtinLedGpio: 8,
    width: 188,
    height: 274,
    pins: makeVerticalPins(
      188,
      58,
      23,
      [
        { id: '3V3', label: '3V3', voltage: 3.3, kind: 'power' },
        { id: 'GND1', label: 'GND', voltage: 0, kind: 'gnd' },
        { id: 'GPIO0', label: 'GP0', voltage: 3.3, kind: 'adc', gpio: 0 },
        { id: 'GPIO1', label: 'GP1', voltage: 3.3, kind: 'adc', gpio: 1 },
        { id: 'GPIO2', label: 'GP2', voltage: 3.3, kind: 'pwm', gpio: 2 },
        { id: 'GPIO3', label: 'GP3', voltage: 3.3, kind: 'adc', gpio: 3 },
        { id: 'GPIO4', label: 'GP4', voltage: 3.3, kind: 'pwm', gpio: 4 },
        { id: 'GPIO5', label: 'GP5', voltage: 3.3, kind: 'gpio', gpio: 5 },
      ],
      [
        { id: '5V', label: '5V', voltage: 5, kind: 'power' },
        { id: 'GND2', label: 'GND', voltage: 0, kind: 'gnd' },
        { id: 'GPIO6', label: 'GP6', voltage: 3.3, kind: 'gpio', gpio: 6 },
        { id: 'GPIO7', label: 'GP7', voltage: 3.3, kind: 'pwm', gpio: 7 },
        { id: 'GPIO8', label: 'GP8', voltage: 3.3, kind: 'i2c', gpio: 8 },
        { id: 'GPIO9', label: 'GP9', voltage: 3.3, kind: 'i2c', gpio: 9 },
        { id: 'GPIO10', label: 'GP10', voltage: 3.3, kind: 'gpio', gpio: 10 },
        { id: 'GPIO21', label: 'TX', voltage: 3.3, kind: 'uart', gpio: 21 },
      ],
    ),
    descriptionId: 'Board ESP32-C3 compact dengan port USB-C, antena keramik/PCB 2.4GHz, dan RISC-V 3.3V.',
    descriptionEn: 'Compact ESP32-C3 DevKit with USB-C connector, 2.4GHz antenna, and 3.3V RISC-V core.',
  },
  esp32: {
    id: 'esp32',
    name: 'ESP32 DevKit v1 (WROOM-32)',
    shortName: 'ESP32',
    arch: 'Xtensa LX6 Dual-Core · 240 MHz',
    logicVoltage: 3.3,
    clockMhz: 240,
    hasWifi: true,
    hasBluetooth: true,
    builtinLedGpio: 2,
    width: 204,
    height: 308,
    pins: makeVerticalPins(
      204,
      82,
      24,
      [
        { id: '3V3', label: '3V3', voltage: 3.3, kind: 'power' },
        { id: 'GND1', label: 'GND', voltage: 0, kind: 'gnd' },
        { id: 'GPIO32', label: 'D32', voltage: 3.3, kind: 'adc', gpio: 32 },
        { id: 'GPIO33', label: 'D33', voltage: 3.3, kind: 'adc', gpio: 33 },
        { id: 'GPIO25', label: 'D25', voltage: 3.3, kind: 'pwm', gpio: 25 },
        { id: 'GPIO26', label: 'D26', voltage: 3.3, kind: 'gpio', gpio: 26 },
        { id: 'GPIO27', label: 'D27', voltage: 3.3, kind: 'gpio', gpio: 27 },
        { id: 'GPIO14', label: 'D14', voltage: 3.3, kind: 'gpio', gpio: 14 },
      ],
      [
        { id: 'VIN', label: 'VIN', voltage: 5, kind: 'power' },
        { id: 'GND2', label: 'GND', voltage: 0, kind: 'gnd' },
        { id: 'GPIO2', label: 'D2', voltage: 3.3, kind: 'pwm', gpio: 2 },
        { id: 'GPIO4', label: 'D4', voltage: 3.3, kind: 'pwm', gpio: 4 },
        { id: 'GPIO5', label: 'D5', voltage: 3.3, kind: 'gpio', gpio: 5 },
        { id: 'GPIO18', label: 'D18', voltage: 3.3, kind: 'pwm', gpio: 18 },
        { id: 'GPIO21', label: 'SDA', voltage: 3.3, kind: 'i2c', gpio: 21 },
        { id: 'GPIO22', label: 'SCL', voltage: 3.3, kind: 'i2c', gpio: 22 },
      ],
    ),
    descriptionId: 'ESP32 WROOM-32 bergaya Wokwi dengan perisai RF perak, antena meander, Micro-USB, EN & BOOT.',
    descriptionEn: 'Classic Wokwi-style ESP32 WROOM-32 with RF shield, meander antenna, Micro-USB, EN & BOOT.',
  },
  'arduino-uno': {
    id: 'arduino-uno',
    name: 'Arduino Uno R3 (ATmega328P)',
    shortName: 'Arduino Uno',
    arch: 'AVR 8-bit DIP · 16 MHz',
    logicVoltage: 5,
    clockMhz: 16,
    hasWifi: false,
    hasBluetooth: false,
    builtinLedGpio: 13,
    width: 318,
    height: 214,
    pins: makeHorizontalPins(
      [
        { id: 'A5', label: 'SCL', voltage: 5, kind: 'i2c', gpio: 19, x: 96 },
        { id: 'A4', label: 'SDA', voltage: 5, kind: 'i2c', gpio: 18, x: 116 },
        { id: 'GND2', label: 'GND', voltage: 0, kind: 'gnd', x: 138 },
        { id: 'D13', label: '13', voltage: 5, kind: 'gpio', gpio: 13, x: 158 },
        { id: 'D11', label: '~11', voltage: 5, kind: 'pwm', gpio: 11, x: 178 },
        { id: 'D10', label: '~10', voltage: 5, kind: 'pwm', gpio: 10, x: 198 },
        { id: 'D9', label: '~9', voltage: 5, kind: 'pwm', gpio: 9, x: 218 },
        { id: 'D6', label: '~6', voltage: 5, kind: 'pwm', gpio: 6, x: 238 },
        { id: 'D5', label: '~5', voltage: 5, kind: 'pwm', gpio: 5, x: 258 },
        { id: 'D4', label: '4', voltage: 5, kind: 'gpio', gpio: 4, x: 278 },
        { id: 'D2', label: '2', voltage: 5, kind: 'gpio', gpio: 2, x: 298 },
      ],
      [
        { id: '3V3', label: '3.3V', voltage: 3.3, kind: 'power', x: 122 },
        { id: '5V', label: '5V', voltage: 5, kind: 'power', x: 146 },
        { id: 'GND1', label: 'GND', voltage: 0, kind: 'gnd', x: 170 },
        { id: 'A0', label: 'A0', voltage: 5, kind: 'adc', gpio: 14, x: 214 },
        { id: 'A1', label: 'A1', voltage: 5, kind: 'adc', gpio: 15, x: 238 },
      ],
      13,
      201,
    ),
    descriptionId: 'Bentuk asli Arduino Uno R3 teal-blue dengan port USB-B, DC jack, dan IC ATmega328P DIP.',
    descriptionEn: 'Authentic teal-blue Arduino Uno R3 silhouette with USB-B port, DC barrel jack, and DIP ATmega328P.',
  },
  'arduino-mega': {
    id: 'arduino-mega',
    name: 'Arduino Mega 2560 Rev3',
    shortName: 'Arduino Mega',
    arch: 'ATmega2560 QFP · 16 MHz',
    logicVoltage: 5,
    clockMhz: 16,
    hasWifi: false,
    hasBluetooth: false,
    builtinLedGpio: 13,
    width: 376,
    height: 222,
    pins: makeHorizontalPins(
      [
        { id: 'D21', label: 'SCL', voltage: 5, kind: 'i2c', gpio: 21, x: 96 },
        { id: 'D20', label: 'SDA', voltage: 5, kind: 'i2c', gpio: 20, x: 118 },
        { id: 'GND2', label: 'GND', voltage: 0, kind: 'gnd', x: 140 },
        { id: 'D13', label: '~13', voltage: 5, kind: 'pwm', gpio: 13, x: 162 },
        { id: 'D11', label: '~11', voltage: 5, kind: 'pwm', gpio: 11, x: 184 },
        { id: 'D10', label: '~10', voltage: 5, kind: 'pwm', gpio: 10, x: 206 },
        { id: 'D9', label: '~9', voltage: 5, kind: 'pwm', gpio: 9, x: 228 },
        { id: 'D6', label: '~6', voltage: 5, kind: 'pwm', gpio: 6, x: 250 },
        { id: 'D5', label: '~5', voltage: 5, kind: 'pwm', gpio: 5, x: 272 },
        { id: 'D4', label: '~4', voltage: 5, kind: 'pwm', gpio: 4, x: 294 },
        { id: 'D2', label: '~2', voltage: 5, kind: 'pwm', gpio: 2, x: 316 },
      ],
      [
        { id: '3V3', label: '3.3V', voltage: 3.3, kind: 'power', x: 122 },
        { id: '5V', label: '5V', voltage: 5, kind: 'power', x: 146 },
        { id: 'GND1', label: 'GND', voltage: 0, kind: 'gnd', x: 170 },
        { id: 'A0', label: 'A0', voltage: 5, kind: 'adc', gpio: 54, x: 214 },
        { id: 'A1', label: 'A1', voltage: 5, kind: 'adc', gpio: 55, x: 238 },
      ],
      13,
      209,
    ),
    descriptionId: 'Arduino Mega 2560 PCB panjang dengan header dual-row I/O ekstra dan chip QFP100 ATmega2560.',
    descriptionEn: 'Extended Arduino Mega 2560 PCB with QFP100 ATmega2560 chip and extra dual-row I/O block.',
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
    width: 170,
    height: 306,
    pins: makeVerticalPins(
      170,
      54,
      24,
      [
        { id: '3V3', label: '3V3', voltage: 3.3, kind: 'power' },
        { id: 'GND1', label: 'GND', voltage: 0, kind: 'gnd' },
        { id: 'GP2', label: 'GP2', voltage: 3.3, kind: 'gpio', gpio: 2 },
        { id: 'GP3', label: 'GP3', voltage: 3.3, kind: 'gpio', gpio: 3 },
        { id: 'GP4', label: 'SDA', voltage: 3.3, kind: 'i2c', gpio: 4 },
        { id: 'GP5', label: 'SCL', voltage: 3.3, kind: 'i2c', gpio: 5 },
        { id: 'GP6', label: 'GP6', voltage: 3.3, kind: 'gpio', gpio: 6 },
        { id: 'GP7', label: 'GP7', voltage: 3.3, kind: 'gpio', gpio: 7 },
      ],
      [
        { id: 'VSYS', label: 'VSYS', voltage: 5, kind: 'power' },
        { id: 'GND2', label: 'GND', voltage: 0, kind: 'gnd' },
        { id: 'GP15', label: 'GP15', voltage: 3.3, kind: 'pwm', gpio: 15 },
        { id: 'GP16', label: 'GP16', voltage: 3.3, kind: 'gpio', gpio: 16 },
        { id: 'GP18', label: 'GP18', voltage: 3.3, kind: 'gpio', gpio: 18 },
        { id: 'GP25', label: 'LED', voltage: 3.3, kind: 'gpio', gpio: 25 },
        { id: 'GP26', label: 'ADC0', voltage: 3.3, kind: 'adc', gpio: 26 },
        { id: 'GP27', label: 'ADC1', voltage: 3.3, kind: 'adc', gpio: 27 },
      ],
    ),
    descriptionId: 'Bentuk asli Raspberry Pi Pico W hijau dengan pin castellated, Micro-USB atas, tombol BOOTSEL & chip Wi-Fi CYW43439.',
    descriptionEn: 'Authentic green Raspberry Pi Pico W PCB with castellated pads, top Micro-USB, BOOTSEL button & CYW43439 Wi-Fi shield.',
  },
}

export const COMPONENT_CATALOG: ComponentSpec[] = [
  // Basic / Passive
  {
    kind: 'led',
    category: 'displays',
    nameId: 'LED',
    nameEn: 'LED',
    subtitleId: 'Displays · Indikator cahaya',
    subtitleEn: 'Displays',
    width: 60,
    height: 78,
    pinned: true,
    pins: [
      { id: 'A', label: 'Anode (+)', dx: 22, dy: 72, role: 'anode' },
      { id: 'K', label: 'Cathode (-)', dx: 38, dy: 72, role: 'cathode' },
    ],
  },
  {
    kind: 'rgb-led',
    category: 'displays',
    nameId: 'RGB LED',
    nameEn: 'RGB LED',
    subtitleId: 'Displays · Common Cathode',
    subtitleEn: 'Displays · R/G/B',
    width: 82,
    height: 78,
    pins: [
      { id: 'R', label: 'Red', dx: 16, dy: 72, role: 'anode' },
      { id: 'GND', label: 'GND', dx: 34, dy: 72, role: 'cathode' },
      { id: 'G', label: 'Green', dx: 52, dy: 72, role: 'anode' },
      { id: 'B', label: 'Blue', dx: 70, dy: 72, role: 'anode' },
    ],
  },
  {
    kind: 'resistor',
    category: 'passives',
    nameId: 'Resistor',
    nameEn: 'Resistor',
    subtitleId: 'Passive · 4 Gelang Warna',
    subtitleEn: 'Passive · 4-Band Color',
    width: 90,
    height: 44,
    pinned: true,
    pins: [
      { id: 'P1', label: 'Terminal 1', dx: 6, dy: 22, role: 'signal' },
      { id: 'P2', label: 'Terminal 2', dx: 84, dy: 22, role: 'signal' },
    ],
  },
  {
    kind: 'breadboard',
    category: 'passives',
    nameId: 'Breadboard',
    nameEn: 'Breadboard',
    subtitleId: 'Passive · Mini Rail',
    subtitleEn: 'Passive · Mini Rail',
    width: 170,
    height: 112,
    pins: [
      { id: 'VCC_L', label: '+ Rail L', dx: 18, dy: 14, role: 'power' },
      { id: 'GND_L', label: '- Rail L', dx: 18, dy: 26, role: 'gnd' },
      { id: 'A1', label: 'Row A', dx: 52, dy: 52, role: 'signal' },
      { id: 'A2', label: 'Row B', dx: 92, dy: 52, role: 'signal' },
      { id: 'B1', label: 'Row C', dx: 52, dy: 82, role: 'signal' },
      { id: 'B2', label: 'Row D', dx: 92, dy: 82, role: 'signal' },
    ],
  },
  // Input Devices
  {
    kind: 'pushbutton',
    category: 'inputs',
    nameId: 'Pushbutton',
    nameEn: 'Pushbutton',
    subtitleId: 'Input Devices · Momentary',
    subtitleEn: 'Input Devices',
    width: 78,
    height: 68,
    pinned: true,
    pins: [
      { id: 'OUT', label: 'Signal', dx: 10, dy: 48, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 68, dy: 48, role: 'gnd' },
    ],
  },
  {
    kind: 'potentiometer',
    category: 'inputs',
    nameId: 'Potentiometer',
    nameEn: 'Potentiometer',
    subtitleId: 'Input Devices · Rotary ADC',
    subtitleEn: 'Input Devices · Rotary',
    width: 84,
    height: 92,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 86, role: 'power' },
      { id: 'SIG', label: 'SIG', dx: 42, dy: 86, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 64, dy: 86, role: 'gnd' },
    ],
  },
  {
    kind: 'slide-pot',
    category: 'inputs',
    nameId: 'Slide Potentiometer',
    nameEn: 'Slide Potentiometer',
    subtitleId: 'Input Devices · Linear Fader',
    subtitleEn: 'Input Devices · Linear',
    width: 112,
    height: 58,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 52, role: 'power' },
      { id: 'SIG', label: 'SIG', dx: 56, dy: 52, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 92, dy: 52, role: 'gnd' },
    ],
  },
  {
    kind: 'rotary-encoder',
    category: 'inputs',
    nameId: 'Rotary Encoder (KY-040)',
    nameEn: 'Rotary Encoder (KY-040)',
    subtitleId: 'Input Devices · CLK/DT/SW',
    subtitleEn: 'Input Devices · KY-040',
    width: 92,
    height: 86,
    pins: [
      { id: 'GND', label: 'GND', dx: 18, dy: 80, role: 'gnd' },
      { id: 'VCC', label: '+', dx: 34, dy: 80, role: 'power' },
      { id: 'SW', label: 'SW', dx: 50, dy: 80, role: 'signal' },
      { id: 'DT', label: 'DT', dx: 64, dy: 80, role: 'signal' },
      { id: 'CLK', label: 'CLK', dx: 78, dy: 80, role: 'signal' },
    ],
  },
  {
    kind: 'keypad-4x4',
    category: 'inputs',
    nameId: 'Keypad 4×4 Matrix',
    nameEn: 'Keypad 4×4 Matrix',
    subtitleId: 'Input Devices · 16 Tombol',
    subtitleEn: 'Input Devices · 16 Keys',
    width: 112,
    height: 126,
    pins: [
      { id: 'R1', label: 'R1', dx: 16, dy: 120, role: 'signal' },
      { id: 'R2', label: 'R2', dx: 40, dy: 120, role: 'signal' },
      { id: 'C1', label: 'C1', dx: 68, dy: 120, role: 'signal' },
      { id: 'C2', label: 'C2', dx: 94, dy: 120, role: 'signal' },
    ],
  },
  {
    kind: 'dip-switch',
    category: 'inputs',
    nameId: 'DIP Switch 8',
    nameEn: 'DIP Switch 8',
    subtitleId: 'Input Devices · 8 Bit Toggle',
    subtitleEn: 'Input Devices · 8-Way',
    width: 112,
    height: 68,
    pins: [
      { id: 'IN1', label: 'D1', dx: 20, dy: 62, role: 'signal' },
      { id: 'IN2', label: 'D2', dx: 44, dy: 62, role: 'signal' },
      { id: 'IN3', label: 'D3', dx: 68, dy: 62, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 92, dy: 62, role: 'gnd' },
    ],
  },
  {
    kind: 'ir-receiver',
    category: 'inputs',
    nameId: 'IR Receiver',
    nameEn: 'IR Receiver',
    subtitleId: 'Input Devices · 38kHz NEC',
    subtitleEn: 'Input Devices · 38kHz',
    width: 72,
    height: 76,
    pins: [
      { id: 'OUT', label: 'DAT', dx: 18, dy: 70, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 36, dy: 70, role: 'gnd' },
      { id: 'VCC', label: 'VCC', dx: 54, dy: 70, role: 'power' },
    ],
  },
  {
    kind: 'ir-remote',
    category: 'inputs',
    nameId: 'IR Remote',
    nameEn: 'IR Remote',
    subtitleId: 'Input Devices · Wireless NEC',
    subtitleEn: 'Input Devices · NEC Key',
    width: 84,
    height: 120,
    pins: [
      { id: 'TX', label: 'IR', dx: 42, dy: 114, role: 'signal' },
    ],
  },
  // Sensors
  {
    kind: 'hc-sr04',
    category: 'sensors',
    nameId: 'HC-SR04 Ultrasonic',
    nameEn: 'HC-SR04 Ultrasonic',
    subtitleId: 'Sensors · 2–400 cm',
    subtitleEn: 'Sensors · 2–400 cm',
    width: 116,
    height: 88,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 22, dy: 82, role: 'power' },
      { id: 'TRIG', label: 'TRIG', dx: 46, dy: 82, role: 'signal' },
      { id: 'ECHO', label: 'ECHO', dx: 70, dy: 82, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 94, dy: 82, role: 'gnd' },
    ],
  },
  {
    kind: 'dht22',
    category: 'sensors',
    nameId: 'DHT22 Sensor',
    nameEn: 'DHT22 Temp/Hum',
    subtitleId: 'Sensors · Suhu & Lembap',
    subtitleEn: 'Sensors · Temp & RH',
    width: 98,
    height: 88,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 24, dy: 82, role: 'power' },
      { id: 'DATA', label: 'SDA', dx: 49, dy: 82, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 74, dy: 82, role: 'gnd' },
    ],
  },
  {
    kind: 'mq2',
    category: 'sensors',
    nameId: 'MQ2 Gas Sensor',
    nameEn: 'MQ2 Gas Sensor',
    subtitleId: 'Sensors · LPG / Asap PPM',
    subtitleEn: 'Sensors · Gas & Smoke',
    width: 96,
    height: 86,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 80, role: 'power' },
      { id: 'GND', label: 'GND', dx: 40, dy: 80, role: 'gnd' },
      { id: 'DO', label: 'DO', dx: 60, dy: 80, role: 'signal' },
      { id: 'AO', label: 'AO', dx: 80, dy: 80, role: 'signal' },
    ],
  },
  {
    kind: 'ds18b20',
    category: 'sensors',
    nameId: 'DS18B20 Temperature',
    nameEn: 'DS18B20 Temp Sensor',
    subtitleId: 'Sensors · 1-Wire Digital',
    subtitleEn: 'Sensors · 1-Wire',
    width: 78,
    height: 78,
    pins: [
      { id: 'GND', label: 'GND', dx: 20, dy: 72, role: 'gnd' },
      { id: 'DQ', label: 'DQ', dx: 39, dy: 72, role: 'signal' },
      { id: 'VCC', label: 'VCC', dx: 58, dy: 72, role: 'power' },
    ],
  },
  {
    kind: 'ntc',
    category: 'sensors',
    nameId: 'Analog Temp Sensor (NTC)',
    nameEn: 'Analog Temp (NTC)',
    subtitleId: 'Sensors · Thermistor',
    subtitleEn: 'Sensors · Thermistor',
    width: 78,
    height: 76,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 70, role: 'power' },
      { id: 'OUT', label: 'OUT', dx: 39, dy: 70, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 58, dy: 70, role: 'gnd' },
    ],
  },
  {
    kind: 'ldr',
    category: 'sensors',
    nameId: 'Photoresistor LDR',
    nameEn: 'Photoresistor LDR',
    subtitleId: 'Sensors · Light Lux',
    subtitleEn: 'Sensors · Light Lux',
    width: 88,
    height: 82,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 22, dy: 76, role: 'power' },
      { id: 'AO', label: 'AO', dx: 44, dy: 76, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 66, dy: 76, role: 'gnd' },
    ],
  },
  {
    kind: 'pir',
    category: 'sensors',
    nameId: 'PIR Motion Sensor',
    nameEn: 'PIR Motion Sensor',
    subtitleId: 'Sensors · Deteksi Gerak',
    subtitleEn: 'Sensors · Motion',
    width: 90,
    height: 86,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 22, dy: 80, role: 'power' },
      { id: 'OUT', label: 'OUT', dx: 45, dy: 80, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 68, dy: 80, role: 'gnd' },
    ],
  },
  {
    kind: 'mpu6050',
    category: 'sensors',
    nameId: 'MPU6050 Accel + Gyro',
    nameEn: 'MPU6050 Accel + Gyro',
    subtitleId: 'Sensors · I2C IMU 6-Axis',
    subtitleEn: 'Sensors · 6-Axis IMU',
    width: 102,
    height: 82,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 76, role: 'power' },
      { id: 'GND', label: 'GND', dx: 40, dy: 76, role: 'gnd' },
      { id: 'SCL', label: 'SCL', dx: 62, dy: 76, role: 'signal' },
      { id: 'SDA', label: 'SDA', dx: 82, dy: 76, role: 'signal' },
    ],
  },
  {
    kind: 'bmp180',
    category: 'sensors',
    nameId: 'BMP180 Barometer',
    nameEn: 'BMP180 Pressure Sensor',
    subtitleId: 'Sensors · I2C hPa',
    subtitleEn: 'Sensors · I2C hPa',
    width: 94,
    height: 80,
    pins: [
      { id: 'VCC', label: 'VIN', dx: 18, dy: 74, role: 'power' },
      { id: 'GND', label: 'GND', dx: 38, dy: 74, role: 'gnd' },
      { id: 'SCL', label: 'SCL', dx: 58, dy: 74, role: 'signal' },
      { id: 'SDA', label: 'SDA', dx: 76, dy: 74, role: 'signal' },
    ],
  },
  {
    kind: 'rfid-rc522',
    category: 'sensors',
    nameId: 'MFRC522 RFID Reader',
    nameEn: 'MFRC522 RFID Reader',
    subtitleId: 'Sensors · 13.56MHz Tap',
    subtitleEn: 'Sensors · 13.56MHz',
    width: 106,
    height: 92,
    pins: [
      { id: 'SDA', label: 'SS', dx: 20, dy: 86, role: 'signal' },
      { id: 'SCK', label: 'SCK', dx: 42, dy: 86, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 64, dy: 86, role: 'gnd' },
      { id: '3V3', label: '3.3V', dx: 86, dy: 86, role: 'power' },
    ],
  },
  {
    kind: 'rtc-ds1307',
    category: 'sensors',
    nameId: 'DS1307 RTC Module',
    nameEn: 'DS1307 RTC',
    subtitleId: 'Sensors · I2C Real-Time Clock',
    subtitleEn: 'Sensors · I2C Clock',
    width: 96,
    height: 80,
    pins: [
      { id: 'GND', label: 'GND', dx: 18, dy: 74, role: 'gnd' },
      { id: 'VCC', label: '5V', dx: 38, dy: 74, role: 'power' },
      { id: 'SDA', label: 'SDA', dx: 58, dy: 74, role: 'signal' },
      { id: 'SCL', label: 'SCL', dx: 78, dy: 74, role: 'signal' },
    ],
  },
  // Displays
  {
    kind: 'lcd-1602',
    category: 'displays',
    nameId: 'LCD 1602 (I2C)',
    nameEn: 'LCD 16×2 (I2C)',
    subtitleId: 'Displays · I2C 16×2',
    subtitleEn: 'Displays · 16×2',
    width: 136,
    height: 84,
    pins: [
      { id: 'GND', label: 'GND', dx: 26, dy: 78, role: 'gnd' },
      { id: 'VCC', label: 'VCC', dx: 52, dy: 78, role: 'power' },
      { id: 'SDA', label: 'SDA', dx: 78, dy: 78, role: 'signal' },
      { id: 'SCL', label: 'SCL', dx: 104, dy: 78, role: 'signal' },
    ],
  },
  {
    kind: 'lcd-20x4',
    category: 'displays',
    nameId: 'LCD 20×4 (I2C)',
    nameEn: 'LCD 20×4 (I2C)',
    subtitleId: 'Displays · 4 Baris I2C',
    subtitleEn: 'Displays · 20×4 I2C',
    width: 150,
    height: 94,
    pins: [
      { id: 'GND', label: 'GND', dx: 28, dy: 88, role: 'gnd' },
      { id: 'VCC', label: 'VCC', dx: 58, dy: 88, role: 'power' },
      { id: 'SDA', label: 'SDA', dx: 88, dy: 88, role: 'signal' },
      { id: 'SCL', label: 'SCL', dx: 118, dy: 88, role: 'signal' },
    ],
  },
  {
    kind: 'oled-ssd1306',
    category: 'displays',
    nameId: 'OLED SSD1306',
    nameEn: 'OLED SSD1306',
    subtitleId: 'Displays · 128×64',
    subtitleEn: 'Displays · 128×64',
    width: 126,
    height: 94,
    pins: [
      { id: 'GND', label: 'GND', dx: 26, dy: 88, role: 'gnd' },
      { id: 'VCC', label: 'VCC', dx: 50, dy: 88, role: 'power' },
      { id: 'SCL', label: 'SCL', dx: 74, dy: 88, role: 'signal' },
      { id: 'SDA', label: 'SDA', dx: 98, dy: 88, role: 'signal' },
    ],
  },
  {
    kind: 'seven-seg',
    category: 'displays',
    nameId: '7-Segment Display',
    nameEn: 'Seven Segment Display',
    subtitleId: 'Displays · 1 Digit LED',
    subtitleEn: 'Displays · 1 Digit',
    width: 68,
    height: 86,
    pins: [
      { id: 'COM', label: 'COM', dx: 20, dy: 80, role: 'gnd' },
      { id: 'IN', label: 'SIG', dx: 48, dy: 80, role: 'signal' },
    ],
  },
  {
    kind: 'seven-seg-4',
    category: 'displays',
    nameId: '7-Segment (TM1637 4-Digit)',
    nameEn: '4-Digit 7-Segment (TM1637)',
    subtitleId: 'Displays · CLK/DIO',
    subtitleEn: 'Displays · 4 Digits',
    width: 124,
    height: 78,
    pins: [
      { id: 'CLK', label: 'CLK', dx: 22, dy: 72, role: 'signal' },
      { id: 'DIO', label: 'DIO', dx: 48, dy: 72, role: 'signal' },
      { id: 'VCC', label: 'VCC', dx: 74, dy: 72, role: 'power' },
      { id: 'GND', label: 'GND', dx: 100, dy: 72, role: 'gnd' },
    ],
  },
  {
    kind: 'led-bar-graph',
    category: 'displays',
    nameId: 'LED Bar Graph (10-Seg)',
    nameEn: 'LED Bar Graph',
    subtitleId: 'Displays · Level Meter',
    subtitleEn: 'Displays · 10-Seg',
    width: 112,
    height: 64,
    pins: [
      { id: 'IN', label: 'SIG', dx: 32, dy: 58, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 80, dy: 58, role: 'gnd' },
    ],
  },
  {
    kind: 'neopixel-ring',
    category: 'displays',
    nameId: 'NeoPixel Ring (WS2812)',
    nameEn: 'NeoPixel LED Ring (WS2812)',
    subtitleId: 'Displays · RGB Ring',
    subtitleEn: 'Displays · 12-LED Ring',
    width: 96,
    height: 96,
    pins: [
      { id: 'VCC', label: '5V', dx: 24, dy: 90, role: 'power' },
      { id: 'DIN', label: 'DIN', dx: 48, dy: 90, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 72, dy: 90, role: 'gnd' },
    ],
  },
  {
    kind: 'neopixel-strip',
    category: 'displays',
    nameId: 'LED Strip (WS2812)',
    nameEn: 'LED Strip (WS2812)',
    subtitleId: 'Displays · Addressable 8×',
    subtitleEn: 'Displays · WS2812 Strip',
    width: 144,
    height: 54,
    pins: [
      { id: 'GND', label: 'GND', dx: 24, dy: 48, role: 'gnd' },
      { id: 'DIN', label: 'DIN', dx: 72, dy: 48, role: 'signal' },
      { id: 'VCC', label: '5V', dx: 120, dy: 48, role: 'power' },
    ],
  },
  {
    kind: 'tft-ili9341',
    category: 'displays',
    nameId: 'ILI9341 2.8" TFT Screen',
    nameEn: 'ILI9341 2.8" TFT Display',
    subtitleId: 'Displays · SPI Color 320×240',
    subtitleEn: 'Displays · SPI Color',
    width: 124,
    height: 102,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 20, dy: 96, role: 'power' },
      { id: 'GND', label: 'GND', dx: 46, dy: 96, role: 'gnd' },
      { id: 'CS', label: 'CS', dx: 72, dy: 96, role: 'signal' },
      { id: 'MOSI', label: 'SDA', dx: 98, dy: 96, role: 'signal' },
    ],
  },
  // Actuators
  {
    kind: 'servo',
    category: 'actuators',
    nameId: 'Servo motor',
    nameEn: 'Servo motor',
    subtitleId: 'Actuators · SG90 PWM',
    subtitleEn: 'Actuators · SG90 PWM',
    width: 108,
    height: 86,
    pins: [
      { id: 'PWM', label: 'PWM', dx: 26, dy: 80, role: 'signal' },
      { id: 'VCC', label: 'VCC', dx: 54, dy: 80, role: 'power' },
      { id: 'GND', label: 'GND', dx: 82, dy: 80, role: 'gnd' },
    ],
  },
  {
    kind: 'buzzer',
    category: 'actuators',
    nameId: 'Piezo Buzzer',
    nameEn: 'Piezo Buzzer',
    subtitleId: 'Actuators · tone()',
    subtitleEn: 'Actuators · tone()',
    width: 74,
    height: 74,
    pins: [
      { id: 'POS', label: '(+)', dx: 24, dy: 68, role: 'signal' },
      { id: 'GND', label: '(-)', dx: 50, dy: 68, role: 'gnd' },
    ],
  },
  {
    kind: 'relay',
    category: 'actuators',
    nameId: 'Relay Module',
    nameEn: 'Relay Module',
    subtitleId: 'Actuators · NO/NC Switch',
    subtitleEn: 'Actuators · 5V Relay',
    width: 96,
    height: 80,
    pins: [
      { id: 'VCC', label: 'VCC', dx: 22, dy: 74, role: 'power' },
      { id: 'IN', label: 'IN', dx: 48, dy: 74, role: 'signal' },
      { id: 'GND', label: 'GND', dx: 74, dy: 74, role: 'gnd' },
    ],
  },
]

export function getComponentSpec(kind: ComponentKind, boardId?: BoardId): ComponentSpec {
  if (kind === 'mcu') {
    const b = BOARDS[boardId ?? 'esp32-c3']
    return {
      kind: 'mcu',
      category: 'microcontrollers',
      nameId: b.shortName,
      nameEn: b.shortName,
      subtitleId: b.arch,
      subtitleEn: b.arch,
      width: b.width,
      height: b.height,
      pins: b.pins.map((p) => ({
        id: p.id,
        label: p.label,
        dx: p.x,
        dy: p.y,
        role: p.kind === 'power' ? 'power' : p.kind === 'gnd' ? 'gnd' : 'signal',
      })),
    }
  }
  return COMPONENT_CATALOG.find((c) => c.kind === kind) ?? COMPONENT_CATALOG[0]
}

export function getBoardPin(boardId: BoardId, pinId: string): PinDef | undefined {
  return BOARDS[boardId].pins.find((p) => p.id === pinId)
}

export interface BoardInstance {
  nodeId: string
  boardId: BoardId
  x: number
  y: number
  label: string
  isPrimary: boolean
}

export const DEFAULT_BOARD_X = 48
export const DEFAULT_BOARD_Y = 76

export function getBoardInstances(primaryBoardId: BoardId, components: PlacedComponent[]): BoardInstance[] {
  const mcus = components.filter((c) => c.kind === 'mcu')
  const primaryComp = mcus.find((c) => c.id === 'board')
  const primary: BoardInstance = {
    nodeId: 'board',
    boardId: primaryComp?.boardId ?? primaryBoardId,
    x: primaryComp?.x ?? DEFAULT_BOARD_X,
    y: primaryComp?.y ?? DEFAULT_BOARD_Y,
    label: primaryComp?.label ?? BOARDS[primaryBoardId].shortName,
    isPrimary: true,
  }
  const extras: BoardInstance[] = mcus
    .filter((c) => c.id !== 'board')
    .map((c) => ({
      nodeId: c.id,
      boardId: c.boardId ?? 'esp32-c3',
      x: c.x,
      y: c.y,
      label: c.label || BOARDS[c.boardId ?? 'esp32-c3'].shortName,
      isPrimary: false,
    }))
  return [primary, ...extras]
}

export function resolveNodeBoardId(primaryBoardId: BoardId, components: PlacedComponent[], nodeId: string): BoardId | null {
  if (nodeId === 'board') {
    const primaryComp = components.find((c) => c.kind === 'mcu' && c.id === 'board')
    return primaryComp?.boardId ?? primaryBoardId
  }
  const comp = components.find((c) => c.id === nodeId && c.kind === 'mcu')
  return comp ? (comp.boardId ?? 'esp32-c3') : null
}

export interface ResistorColorBand {
  digit?: number
  multiplier?: number
  nameId: string
  nameEn: string
  hex: string
}

export const RESISTOR_DIGIT_BANDS: ResistorColorBand[] = [
  { digit: 0, nameId: 'Hitam (0)', nameEn: 'Black (0)', hex: '#18181b' },
  { digit: 1, nameId: 'Cokelat (1)', nameEn: 'Brown (1)', hex: '#78350f' },
  { digit: 2, nameId: 'Merah (2)', nameEn: 'Red (2)', hex: '#dc2626' },
  { digit: 3, nameId: 'Oranye (3)', nameEn: 'Orange (3)', hex: '#ea580c' },
  { digit: 4, nameId: 'Kuning (4)', nameEn: 'Yellow (4)', hex: '#eab308' },
  { digit: 5, nameId: 'Hijau (5)', nameEn: 'Green (5)', hex: '#16a34a' },
  { digit: 6, nameId: 'Biru (6)', nameEn: 'Blue (6)', hex: '#2563eb' },
  { digit: 7, nameId: 'Ungu (7)', nameEn: 'Violet (7)', hex: '#7c3aed' },
  { digit: 8, nameId: 'Abu-abu (8)', nameEn: 'Grey (8)', hex: '#64748b' },
  { digit: 9, nameId: 'Putih (9)', nameEn: 'White (9)', hex: '#f8fafc' },
]

export const RESISTOR_MULTIPLIER_BANDS: ResistorColorBand[] = [
  { multiplier: 1, nameId: 'Hitam (×1Ω)', nameEn: 'Black (×1Ω)', hex: '#18181b' },
  { multiplier: 10, nameId: 'Cokelat (×10Ω)', nameEn: 'Brown (×10Ω)', hex: '#78350f' },
  { multiplier: 100, nameId: 'Merah (×100Ω)', nameEn: 'Red (×100Ω)', hex: '#dc2626' },
  { multiplier: 1000, nameId: 'Oranye (×1kΩ)', nameEn: 'Orange (×1kΩ)', hex: '#ea580c' },
  { multiplier: 10000, nameId: 'Kuning (×10kΩ)', nameEn: 'Yellow (×10kΩ)', hex: '#eab308' },
  { multiplier: 100000, nameId: 'Hijau (×100kΩ)', nameEn: 'Green (×100kΩ)', hex: '#16a34a' },
  { multiplier: 1000000, nameId: 'Biru (×1MΩ)', nameEn: 'Blue (×1MΩ)', hex: '#2563eb' },
]

export const RESISTOR_QUICK_VALUES = [47, 100, 220, 330, 470, 1000, 2200, 4700, 10000, 100000]

export function formatOhms(ohms: number): string {
  if (ohms >= 1000000) return `${+(ohms / 1000000).toFixed(2)}MΩ`
  if (ohms >= 1000) return `${+(ohms / 1000).toFixed(2)}kΩ`
  return `${Math.round(ohms)}Ω`
}

export function decodeResistorBands(ohmsRaw: number): { d1: number; d2: number; multIdx: number; bands: [string, string, string, string] } {
  const ohms = Math.max(10, Math.min(99000000, Math.round(ohmsRaw || 220)))
  let exp = Math.floor(Math.log10(ohms)) - 1
  if (exp < 0) exp = 0
  if (exp > RESISTOR_MULTIPLIER_BANDS.length - 1) exp = RESISTOR_MULTIPLIER_BANDS.length - 1
  const mult = RESISTOR_MULTIPLIER_BANDS[exp].multiplier ?? 1
  const twoDigits = Math.max(10, Math.min(99, Math.round(ohms / mult)))
  const d1 = Math.floor(twoDigits / 10)
  const d2 = twoDigits % 10
  return {
    d1,
    d2,
    multIdx: exp,
    bands: [
      RESISTOR_DIGIT_BANDS[d1]?.hex ?? '#dc2626',
      RESISTOR_DIGIT_BANDS[d2]?.hex ?? '#dc2626',
      RESISTOR_MULTIPLIER_BANDS[exp]?.hex ?? '#78350f',
      '#eab308',
    ],
  }
}

export const WIRE_COLORS = [
  { id: '#ef4444', nameId: 'Merah (VCC)', nameEn: 'Red (VCC)' },
  { id: '#1e293b', nameId: 'Hitam (GND)', nameEn: 'Black (GND)' },
  { id: '#10b981', nameId: 'Hijau (Sinyal)', nameEn: 'Green (Signal)' },
  { id: '#3b82f6', nameId: 'Biru (I2C/PWM)', nameEn: 'Blue (I2C/PWM)' },
  { id: '#f59e0b', nameId: 'Oranye (Data)', nameEn: 'Orange (Data)' },
  { id: '#8b5cf6', nameId: 'Ungu (Analog)', nameEn: 'Purple (Analog)' },
]
