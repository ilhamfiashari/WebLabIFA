export type AcKind = 'fn' | 'method' | 'kw' | 'type' | 'const' | 'var' | 'hdr' | 'snip'

export interface AcSuggestion {
  label: string
  insertText: string
  kind: AcKind
  detailId: string
  detailEn: string
}

export interface AcResult {
  replaceStart: number
  replaceEnd: number
  items: AcSuggestion[]
}

const STATIC_SUGGESTIONS: AcSuggestion[] = [
  // Core Arduino GPIO & Timing
  { label: 'pinMode', insertText: 'pinMode($0)', kind: 'fn', detailId: 'pinMode(pin, OUTPUT | INPUT | INPUT_PULLUP)', detailEn: 'pinMode(pin, OUTPUT | INPUT | INPUT_PULLUP)' },
  { label: 'digitalWrite', insertText: 'digitalWrite($0)', kind: 'fn', detailId: 'digitalWrite(pin, HIGH | LOW)', detailEn: 'digitalWrite(pin, HIGH | LOW)' },
  { label: 'digitalRead', insertText: 'digitalRead($0)', kind: 'fn', detailId: 'digitalRead(pin) -> HIGH | LOW', detailEn: 'digitalRead(pin) -> HIGH | LOW' },
  { label: 'analogRead', insertText: 'analogRead($0)', kind: 'fn', detailId: 'analogRead(pin) -> nilai ADC', detailEn: 'analogRead(pin) -> ADC value' },
  { label: 'analogWrite', insertText: 'analogWrite($0)', kind: 'fn', detailId: 'analogWrite(pin, 0..255)', detailEn: 'analogWrite(pin, 0..255)' },
  { label: 'delay', insertText: 'delay($0);', kind: 'fn', detailId: 'delay(ms) — jeda milidetik', detailEn: 'delay(ms) — pause milliseconds' },
  { label: 'delayMicroseconds', insertText: 'delayMicroseconds($0);', kind: 'fn', detailId: 'delayMicroseconds(us)', detailEn: 'delayMicroseconds(us)' },
  { label: 'millis', insertText: 'millis()', kind: 'fn', detailId: 'Waktu berjalan sejak boot (ms)', detailEn: 'Elapsed milliseconds since boot' },
  { label: 'micros', insertText: 'micros()', kind: 'fn', detailId: 'Waktu berjalan (mikrodetik)', detailEn: 'Elapsed microseconds since boot' },
  { label: 'tone', insertText: 'tone($0)', kind: 'fn', detailId: 'tone(pin, freqHz) — bunyikan buzzer', detailEn: 'tone(pin, freqHz) — play buzzer tone' },
  { label: 'noTone', insertText: 'noTone($0);', kind: 'fn', detailId: 'noTone(pin) — hentikan buzzer', detailEn: 'noTone(pin) — stop buzzer tone' },
  { label: 'map', insertText: 'map($0)', kind: 'fn', detailId: 'map(val, inMin, inMax, outMin, outMax)', detailEn: 'map(val, inMin, inMax, outMin, outMax)' },
  { label: 'constrain', insertText: 'constrain($0)', kind: 'fn', detailId: 'constrain(x, min, max)', detailEn: 'constrain(x, min, max)' },
  { label: 'ultrasonicRead', insertText: 'ultrasonicRead($0)', kind: 'fn', detailId: 'ultrasonicRead(trigPin, echoPin) -> cm', detailEn: 'ultrasonicRead(trigPin, echoPin) -> cm' },
  { label: 'pulseIn', insertText: 'pulseIn($0)', kind: 'fn', detailId: 'pulseIn(pin, HIGH | LOW)', detailEn: 'pulseIn(pin, HIGH | LOW)' },
  { label: 'shiftOut', insertText: 'shiftOut($0)', kind: 'fn', detailId: 'shiftOut(dataPin, clockPin, MSBFIRST, val)', detailEn: 'shiftOut(dataPin, clockPin, MSBFIRST, val)' },

  // Objects & Snippets
  { label: 'Serial.begin(115200)', insertText: 'Serial.begin(115200);', kind: 'snip', detailId: 'Inisialisasi Serial UART 115200 baud', detailEn: 'Initialize Serial UART at 115200 baud' },
  { label: 'Serial.println', insertText: 'Serial.println($0);', kind: 'fn', detailId: 'Cetak baris ke Serial Monitor', detailEn: 'Print line to Serial Monitor' },
  { label: 'Serial.print', insertText: 'Serial.print($0);', kind: 'fn', detailId: 'Cetak teks ke Serial Monitor', detailEn: 'Print text to Serial Monitor' },
  { label: 'Serial', insertText: 'Serial', kind: 'const', detailId: 'Objek port serial UART', detailEn: 'Hardware Serial UART object' },
  { label: 'oled', insertText: 'oled', kind: 'const', detailId: 'Objek layar OLED SSD1306 I2C', detailEn: 'SSD1306 I2C OLED display object' },
  { label: 'dht', insertText: 'dht', kind: 'const', detailId: 'Objek sensor suhu & kelembapan DHT22', detailEn: 'DHT22 temperature & humidity object' },
  { label: 'lcd', insertText: 'lcd', kind: 'const', detailId: 'Objek LCD I2C 16x2 / 20x4', detailEn: 'I2C LCD 16x2 / 20x4 object' },
  { label: 'Wire', insertText: 'Wire', kind: 'const', detailId: 'Bus I2C (SDA/SCL)', detailEn: 'I2C TwoWire bus' },
  { label: 'WiFi', insertText: 'WiFi', kind: 'const', detailId: 'Modul koneksi Wi-Fi ESP32/Pico W', detailEn: 'Wi-Fi networking module' },

  // Structure & Control Flow Snippets
  { label: 'setup', insertText: 'void setup() {\n  $0\n}', kind: 'snip', detailId: 'Fungsi inisialisasi (berjalan sekali)', detailEn: 'Setup function (runs once)' },
  { label: 'loop', insertText: 'void loop() {\n  $0\n}', kind: 'snip', detailId: 'Loop utama program (berulang)', detailEn: 'Main program loop' },
  { label: 'if', insertText: 'if ($0) {\n  \n}', kind: 'kw', detailId: 'Percabangan kondisi if', detailEn: 'Conditional if branch' },
  { label: 'else', insertText: 'else {\n  $0\n}', kind: 'kw', detailId: 'Cabang alternatif else', detailEn: 'Alternative else branch' },
  { label: 'for', insertText: 'for (int i = 0; i < $0; i++) {\n  \n}', kind: 'kw', detailId: 'Perulangan for counter', detailEn: 'For loop counter' },
  { label: 'while', insertText: 'while ($0) {\n  \n}', kind: 'kw', detailId: 'Perulangan selama kondisi benar', detailEn: 'While loop' },
  { label: 'switch', insertText: 'switch ($0) {\n  case 0:\n    break;\n  default:\n    break;\n}', kind: 'kw', detailId: 'Percabangan switch-case', detailEn: 'Switch-case statement' },
  { label: 'return', insertText: 'return $0;', kind: 'kw', detailId: 'Kembalikan nilai fungsi', detailEn: 'Return from function' },

  // Constants
  { label: 'HIGH', insertText: 'HIGH', kind: 'const', detailId: 'Logika tinggi (3.3V / 5V)', detailEn: 'Logic HIGH level' },
  { label: 'LOW', insertText: 'LOW', kind: 'const', detailId: 'Logika rendah (0V / GND)', detailEn: 'Logic LOW level' },
  { label: 'OUTPUT', insertText: 'OUTPUT', kind: 'const', detailId: 'Mode pin sebagai keluaran', detailEn: 'Configure pin as output' },
  { label: 'INPUT', insertText: 'INPUT', kind: 'const', detailId: 'Mode pin sebagai masukan', detailEn: 'Configure pin as input' },
  { label: 'INPUT_PULLUP', insertText: 'INPUT_PULLUP', kind: 'const', detailId: 'Masukan dengan resistor pull-up internal', detailEn: 'Input with internal pull-up resistor' },
  { label: 'true', insertText: 'true', kind: 'kw', detailId: 'Nilai boolean benar', detailEn: 'Boolean true' },
  { label: 'false', insertText: 'false', kind: 'kw', detailId: 'Nilai boolean salah', detailEn: 'Boolean false' },

  // C++ / Arduino Types
  { label: 'void', insertText: 'void ', kind: 'type', detailId: 'Tipe fungsi tanpa nilai kembali', detailEn: 'Void return type' },
  { label: 'int', insertText: 'int ', kind: 'type', detailId: 'Bilangan bulat (integer)', detailEn: 'Signed integer' },
  { label: 'float', insertText: 'float ', kind: 'type', detailId: 'Bilangan desimal (floating point)', detailEn: 'Floating point number' },
  { label: 'bool', insertText: 'bool ', kind: 'type', detailId: 'Tipe boolean (true/false)', detailEn: 'Boolean type' },
  { label: 'String', insertText: 'String ', kind: 'type', detailId: 'Teks string Arduino', detailEn: 'Arduino String class' },
  { label: 'const', insertText: 'const ', kind: 'type', detailId: 'Deklarasi konstanta tetap', detailEn: 'Constant qualifier' },
  { label: 'unsigned', insertText: 'unsigned ', kind: 'type', detailId: 'Bilangan bulat tak bertanda', detailEn: 'Unsigned modifier' },
  { label: 'uint8_t', insertText: 'uint8_t ', kind: 'type', detailId: 'Integer 8-bit tanpa tanda (0..255)', detailEn: '8-bit unsigned integer' },
  { label: 'Servo', insertText: 'Servo ', kind: 'type', detailId: 'Kelas motor servo PWM', detailEn: 'PWM Servo controller class' },
]

const PREPROC_SUGGESTIONS: AcSuggestion[] = [
  { label: '#include <ESP32Servo.h>', insertText: '#include <ESP32Servo.h>\n', kind: 'hdr', detailId: 'Library Servo PWM ESP32', detailEn: 'ESP32 PWM Servo library' },
  { label: '#include <Adafruit_SSD1306.h>', insertText: '#include <Adafruit_SSD1306.h>\n', kind: 'hdr', detailId: 'Driver layar OLED 128x64 I2C', detailEn: '128x64 I2C OLED display driver' },
  { label: '#include <DHT.h>', insertText: '#include <DHT.h>\n', kind: 'hdr', detailId: 'Sensor suhu & kelembapan DHT22/DHT11', detailEn: 'DHT22/DHT11 sensor library' },
  { label: '#include <LiquidCrystal_I2C.h>', insertText: '#include <LiquidCrystal_I2C.h>\n', kind: 'hdr', detailId: 'Driver LCD 16x2 & 20x4 I2C', detailEn: 'I2C 16x2 & 20x4 LCD driver' },
  { label: '#include <Adafruit_NeoPixel.h>', insertText: '#include <Adafruit_NeoPixel.h>\n', kind: 'hdr', detailId: 'Kontrol LED RGB WS2812 / NeoPixel', detailEn: 'WS2812 NeoPixel LED driver' },
  { label: '#include <Wire.h>', insertText: '#include <Wire.h>\n', kind: 'hdr', detailId: 'Komunikasi bus I2C (SDA/SCL)', detailEn: 'I2C communication bus' },
  { label: '#include <WiFi.h>', insertText: '#include <WiFi.h>\n', kind: 'hdr', detailId: 'Koneksi jaringan Wi-Fi', detailEn: 'Wi-Fi connectivity library' },
  { label: '#include <PubSubClient.h>', insertText: '#include <PubSubClient.h>\n', kind: 'hdr', detailId: 'Klien MQTT IoT publish/subscribe', detailEn: 'MQTT publish/subscribe client' },
  { label: '#define', insertText: '#define $0 ', kind: 'kw', detailId: 'Definisikan makro / nomor pin konstan', detailEn: 'Define constant macro or pin' },
]

const MEMBER_MAP: Record<string, AcSuggestion[]> = {
  Serial: [
    { label: 'begin(115200)', insertText: 'begin(115200);', kind: 'method', detailId: 'Mulai Serial monitor 115200 baud', detailEn: 'Start Serial at 115200 baud' },
    { label: 'println(...)', insertText: 'println($0);', kind: 'method', detailId: 'Cetak pesan + baris baru ke Serial', detailEn: 'Print line to Serial' },
    { label: 'print(...)', insertText: 'print($0);', kind: 'method', detailId: 'Cetak teks tanpa baris baru', detailEn: 'Print text to Serial' },
    { label: 'available()', insertText: 'available()', kind: 'method', detailId: 'Cek jumlah byte input serial tersedia', detailEn: 'Bytes available to read' },
    { label: 'read()', insertText: 'read()', kind: 'method', detailId: 'Baca 1 byte dari input Serial', detailEn: 'Read incoming byte' },
  ],
  oled: [
    { label: 'begin()', insertText: 'begin();', kind: 'method', detailId: 'Inisialisasi layar OLED SSD1306', detailEn: 'Initialize SSD1306 OLED' },
    { label: 'clear()', insertText: 'clear();', kind: 'method', detailId: 'Bersihkan buffer layar OLED', detailEn: 'Clear OLED framebuffer' },
    { label: 'setCursor(x, y)', insertText: 'setCursor($0, 0);', kind: 'method', detailId: 'Atur posisi kursor teks layar', detailEn: 'Set OLED cursor position' },
    { label: 'println(...)', insertText: 'println($0);', kind: 'method', detailId: 'Tulis baris teks ke buffer OLED', detailEn: 'Write text line to OLED' },
    { label: 'display()', insertText: 'display();', kind: 'method', detailId: 'Render buffer ke layar fisik OLED', detailEn: 'Flush buffer to OLED screen' },
  ],
  dht: [
    { label: 'readTemperature(pin)', insertText: 'readTemperature($0)', kind: 'method', detailId: 'Baca suhu °C dari sensor DHT22', detailEn: 'Read temperature (°C) from DHT22' },
    { label: 'readHumidity(pin)', insertText: 'readHumidity($0)', kind: 'method', detailId: 'Baca kelembapan relatif (%) DHT22', detailEn: 'Read humidity (%) from DHT22' },
  ],
  lcd: [
    { label: 'init()', insertText: 'init();', kind: 'method', detailId: 'Inisialisasi modul LCD I2C', detailEn: 'Initialize I2C LCD' },
    { label: 'backlight()', insertText: 'backlight();', kind: 'method', detailId: 'Nyalakan lampu latar LCD', detailEn: 'Turn on LCD backlight' },
    { label: 'clear()', insertText: 'clear();', kind: 'method', detailId: 'Hapus isi layar LCD', detailEn: 'Clear LCD display' },
    { label: 'setCursor(col, row)', insertText: 'setCursor($0, 0);', kind: 'method', detailId: 'Atur kolom & baris teks LCD', detailEn: 'Set LCD cursor column & row' },
    { label: 'print(...)', insertText: 'print($0);', kind: 'method', detailId: 'Tampilkan teks di layar LCD', detailEn: 'Print text on LCD' },
  ],
  servo: [
    { label: 'attach(pin)', insertText: 'attach($0);', kind: 'method', detailId: 'Hubungkan objek Servo ke pin PWM', detailEn: 'Attach Servo object to PWM pin' },
    { label: 'write(angle)', insertText: 'write($0);', kind: 'method', detailId: 'Putar sudut Servo (0..180°)', detailEn: 'Rotate Servo angle (0..180°)' },
  ],
}

function extractSketchSymbols(code: string): AcSuggestion[] {
  const seen = new Set<string>(STATIC_SUGGESTIONS.map((s) => s.label))
  const found: AcSuggestion[] = []

  const defRe = /^\s*#define\s+([A-Za-z_]\w*)(?:\s+([^\s/]+))?/gm
  for (let m = defRe.exec(code); m !== null; m = defRe.exec(code)) {
    const name = m[1]
    if (!seen.has(name)) {
      seen.add(name)
      const val = m[2] ? ` = ${m[2]}` : ''
      found.push({
        label: name,
        insertText: name,
        kind: 'const',
        detailId: `#define ${name}${val}`,
        detailEn: `#define ${name}${val}`,
      })
    }
  }

  const declRe = /\b(?:int|float|double|bool|boolean|byte|long|uint8_t|uint16_t|uint32_t|String|Servo)\s+([A-Za-z_]\w*)/g
  for (let m = declRe.exec(code); m !== null; m = declRe.exec(code)) {
    const name = m[1]
    if (!seen.has(name) && name !== 'setup' && name !== 'loop') {
      seen.add(name)
      found.push({
        label: name,
        insertText: name,
        kind: 'var',
        detailId: 'Variabel / objek lokal pada sketsa',
        detailEn: 'Local sketch variable / object',
      })
    }
  }

  return found
}

function isInsideCommentOrString(lineBeforeCursor: string): boolean {
  if (lineBeforeCursor.includes('//')) return true
  let inStr = false
  for (let i = 0; i < lineBeforeCursor.length; i++) {
    if (lineBeforeCursor[i] === '"' && lineBeforeCursor[i - 1] !== '\\') {
      inStr = !inStr
    }
  }
  return inStr
}

/**
 * Compute autocomplete suggestions at the given textarea cursor offset.
 * Pass `force = true` for explicit Ctrl+Space invocation.
 */
export function getArduinoAutocomplete(code: string, cursor: number, force = false): AcResult | null {
  const lineStart = code.lastIndexOf('\n', cursor - 1) + 1
  const lineBefore = code.slice(lineStart, cursor)

  if (!force && isInsideCommentOrString(lineBefore)) {
    return null
  }

  // 1. Preprocessor (#include / #define)
  const preprocMatch = /^\s*(#[A-Za-z0-9_<./ ]*)$/.exec(lineBefore)
  if (preprocMatch) {
    const typed = preprocMatch[1].toLowerCase()
    const replaceStart = cursor - preprocMatch[1].length
    const items = PREPROC_SUGGESTIONS.filter((s) => s.label.toLowerCase().startsWith(typed) || s.label.toLowerCase().includes(typed)).slice(0, 8)
    return items.length > 0 ? { replaceStart, replaceEnd: cursor, items } : null
  }

  // 2. Member access (Serial. / oled. / dht. / lcd. / gateServo.)
  const dotMatch = /([A-Za-z_]\w*)\.([A-Za-z0-9_]*)$/.exec(lineBefore)
  if (dotMatch) {
    const objName = dotMatch[1]
    const prefix = dotMatch[2].toLowerCase()
    const replaceStart = cursor - dotMatch[2].length
    const candidates =
      MEMBER_MAP[objName] ??
      (/servo|arm|gate/i.test(objName) ? MEMBER_MAP.servo : /lcd/i.test(objName) ? MEMBER_MAP.lcd : [])
    const items = candidates.filter((m) => !prefix || m.label.toLowerCase().startsWith(prefix)).slice(0, 8)
    return items.length > 0 ? { replaceStart, replaceEnd: cursor, items } : null
  }

  // 3. Word / identifier prefix
  const wordMatch = /([A-Za-z_][A-Za-z0-9_]*)$/.exec(lineBefore)
  const typedWord = wordMatch?.[1] ?? ''
  if (!force && typedWord.length < 2) {
    return null
  }

  const replaceStart = cursor - typedWord.length
  const lower = typedWord.toLowerCase()
  const all = [...extractSketchSymbols(code), ...STATIC_SUGGESTIONS]

  const starts = all.filter((s) => s.label.toLowerCase().startsWith(lower) && s.label !== typedWord)
  const contains = all.filter((s) => !s.label.toLowerCase().startsWith(lower) && s.label.toLowerCase().includes(lower))
  const items = (typedWord ? [...starts, ...contains] : all).slice(0, 9)

  return items.length > 0 ? { replaceStart, replaceEnd: cursor, items } : null
}

/** Insert chosen completion text and compute the resulting cursor offset (resolving optional $0 marker). */
export function applyAutocompleteItem(
  code: string,
  replaceStart: number,
  replaceEnd: number,
  item: AcSuggestion,
): { nextCode: string; nextCursor: number } {
  const markerIdx = item.insertText.indexOf('$0')
  const cleanText = markerIdx >= 0 ? item.insertText.replace('$0', '') : item.insertText
  const nextCode = code.slice(0, replaceStart) + cleanText + code.slice(replaceEnd)
  const nextCursor = markerIdx >= 0 ? replaceStart + markerIdx : replaceStart + cleanText.length
  return { nextCode, nextCursor }
}
