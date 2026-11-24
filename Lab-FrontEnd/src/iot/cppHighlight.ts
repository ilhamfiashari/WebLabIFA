export type CppTokenType =
  | 'plain'
  | 'comment'
  | 'preproc'
  | 'string'
  | 'number'
  | 'type'
  | 'keyword'
  | 'builtin'
  | 'const'
  | 'punct'

export interface CppToken {
  type: CppTokenType
  text: string
}

const CPP_TYPES = new Set([
  'void', 'int', 'long', 'short', 'char', 'bool', 'boolean', 'byte',
  'float', 'double', 'unsigned', 'signed', 'const', 'static', 'volatile',
  'struct', 'enum', 'class', 'typename', 'auto', 'size_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t',
  'String', 'Servo', 'LiquidCrystal_I2C', 'LiquidCrystal', 'Adafruit_SSD1306',
  'Adafruit_ILI9341', 'Adafruit_NeoPixel', 'DHT', 'WiFiClient', 'PubSubClient',
  'RotaryEncoder', 'Keypad', 'HX711', 'MPU6050',
])

const CPP_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'true', 'false', 'nullptr', 'NULL',
  'using', 'namespace', 'sizeof', 'new', 'delete', 'this',
])

const ARDUINO_BUILTINS = new Set([
  'setup', 'loop', 'Serial', 'Wire', 'SPI', 'WiFi', 'oled', 'lcd', 'dht',
  'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite',
  'analogReadResolution', 'ledcSetup', 'ledcAttachPin', 'ledcWrite',
  'delay', 'delayMicroseconds', 'millis', 'micros',
  'tone', 'noTone', 'pulseIn', 'shiftOut', 'shiftIn', 'ultrasonicRead',
  'map', 'constrain', 'min', 'max', 'abs', 'pow', 'sqrt', 'sin', 'cos',
  'begin', 'println', 'print', 'printf', 'available', 'read', 'write',
  'attach', 'detach', 'clear', 'setCursor', 'display', 'backlight',
  'readTemperature', 'readHumidity', 'publish', 'connect', 'subscribe',
  'show', 'setPixelColor', 'Color',
])

const ARDUINO_CONSTS = new Set([
  'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'INPUT_PULLDOWN',
  'RISING', 'FALLING', 'CHANGE', 'LED_BUILTIN', 'PI',
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13',
])

const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|^\s*#[A-Za-z_]\w*|<[A-Za-z0-9_./-]+>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|0[xX][0-9a-fA-F]+|0[bB][01]+|\b\d+(?:\.\d+)?(?:[uUlLfF]+)?\b|\b[A-Za-z_]\w*\b|[{}()[\];,=+\-*/<>!&|^~?:.]+|\s+)/gm

function classifyWord(word: string, afterDotOrArrow: boolean, isPreprocHeader: boolean): CppTokenType {
  if (isPreprocHeader) return 'string'
  if (CPP_TYPES.has(word)) return 'type'
  if (CPP_KEYWORDS.has(word)) return 'keyword'
  if (ARDUINO_BUILTINS.has(word)) return 'builtin'
  if (ARDUINO_CONSTS.has(word)) return 'const'
  if (!afterDotOrArrow && /^[A-Z][A-Z0-9_]{1,}$/.test(word)) return 'const'
  return 'plain'
}

/** Classify a single identifier with the Arduino-aware palette (types, builtins, constants). */
export function classifyArduinoWord(word: string, afterDotOrArrow = false): CppTokenType {
  return classifyWord(word, afterDotOrArrow, false)
}

/** Tokenize an Arduino/C++ sketch into syntax-highlighted segments. */
export function tokenizeArduinoCpp(code: string): CppToken[] {
  const tokens: CppToken[] = []
  let lastIndex = 0
  let onIncludeLine = false
  let afterDot = false

  TOKEN_RE.lastIndex = 0
  for (let m = TOKEN_RE.exec(code); m !== null; m = TOKEN_RE.exec(code)) {
    if (m.index > lastIndex) {
      tokens.push({ type: 'plain', text: code.slice(lastIndex, m.index) })
    }
    const raw = m[0]
    let type: CppTokenType = 'plain'

    if (raw.startsWith('//') || raw.startsWith('/*')) {
      type = 'comment'
      onIncludeLine = false
      afterDot = false
    } else if (/^\s*#/.test(raw)) {
      type = 'preproc'
      onIncludeLine = /#include\b/.test(raw)
      afterDot = false
    } else if (raw.startsWith('"') || raw.startsWith("'") || (onIncludeLine && raw.startsWith('<') && raw.endsWith('>'))) {
      type = 'string'
      onIncludeLine = false
      afterDot = false
    } else if (/^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d)/.test(raw)) {
      type = 'number'
      afterDot = false
    } else if (/^[A-Za-z_]/.test(raw)) {
      type = classifyWord(raw, afterDot, false)
      afterDot = false
    } else if (/^\s+$/.test(raw)) {
      type = 'plain'
      if (raw.includes('\n')) {
        onIncludeLine = false
        afterDot = false
      }
    } else {
      type = 'punct'
      afterDot = raw === '.' || raw === '->'
    }

    tokens.push({ type, text: raw })
    lastIndex = TOKEN_RE.lastIndex
  }

  if (lastIndex < code.length) {
    tokens.push({ type: 'plain', text: code.slice(lastIndex) })
  }
  return tokens
}
