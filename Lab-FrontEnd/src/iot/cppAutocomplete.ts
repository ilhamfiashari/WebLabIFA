export type AcKind = 'fn' | 'method' | 'kw' | 'type' | 'const' | 'var' | 'hdr' | 'snip'

export interface AcParamInfo {
  name: string
  type: string
  descId: string
  descEn: string
}

export interface AcSuggestion {
  label: string
  insertText: string
  kind: AcKind
  returnType?: string
  params?: AcParamInfo[]
  detailId: string
  detailEn: string
}

export interface AcResult {
  replaceStart: number
  replaceEnd: number
  items: AcSuggestion[]
}

export interface SignatureHelpResult {
  fnName: string
  returnType: string
  params: AcParamInfo[]
  activeParam: number
  summaryId: string
  summaryEn: string
}

const STATIC_SUGGESTIONS: AcSuggestion[] = [
  // Core Arduino GPIO & Timing
  {
    label: 'pinMode',
    insertText: 'pinMode($0)',
    kind: 'fn',
    returnType: 'void',
    params: [
      { name: 'pin', type: 'uint8_t', descId: 'Nomor pin GPIO/digital (mis. 2, LED_PIN, D4)', descEn: 'GPIO or digital pin number' },
      { name: 'mode', type: 'uint8_t', descId: 'Mode pin: OUTPUT, INPUT, atau INPUT_PULLUP', descEn: 'OUTPUT, INPUT, or INPUT_PULLUP' },
    ],
    detailId: 'Mengatur fungsi pin sebagai masukan atau keluaran digital.',
    detailEn: 'Configures the specified pin to behave either as an input or an output.',
  },
  {
    label: 'digitalWrite',
    insertText: 'digitalWrite($0)',
    kind: 'fn',
    returnType: 'void',
    params: [
      { name: 'pin', type: 'uint8_t', descId: 'Nomor pin tujuan yang sudah diset OUTPUT', descEn: 'Target pin configured as OUTPUT' },
      { name: 'val', type: 'uint8_t', descId: 'Logika keluaran: HIGH (nyala/3.3V-5V) atau LOW (mati/0V)', descEn: 'Logic level: HIGH or LOW' },
    ],
    detailId: 'Mengirim sinyal logika HIGH atau LOW ke pin digital.',
    detailEn: 'Write a HIGH or LOW value to a digital pin.',
  },
  {
    label: 'digitalRead',
    insertText: 'digitalRead($0)',
    kind: 'fn',
    returnType: 'int',
    params: [
      { name: 'pin', type: 'uint8_t', descId: 'Nomor pin INPUT / INPUT_PULLUP yang dibaca', descEn: 'Input pin number to read' },
    ],
    detailId: 'Membaca status logika pin digital (mengembalikan HIGH atau LOW).',
    detailEn: 'Reads the value from a specified digital pin (HIGH or LOW).',
  },
  {
    label: 'analogRead',
    insertText: 'analogRead($0)',
    kind: 'fn',
    returnType: 'int',
    params: [
      { name: 'pin', type: 'uint8_t', descId: 'Pin ADC analog (mis. A0, GPIO1, GPIO34)', descEn: 'Analog ADC pin (e.g. A0, GPIO1)' },
    ],
    detailId: 'Membaca tegangan analog dari ADC (0..1023 AVR / 0..4095 ESP32).',
    detailEn: 'Reads the analog voltage from an ADC pin.',
  },
  {
    label: 'analogWrite',
    insertText: 'analogWrite($0)',
    kind: 'fn',
    returnType: 'void',
    params: [
      { name: 'pin', type: 'uint8_t', descId: 'Pin dengan dukungan sinyal PWM', descEn: 'PWM-capable output pin' },
      { name: 'value', type: 'int', descId: 'Duty cycle PWM antara 0 (mati) hingga 255 (penuh)', descEn: 'PWM duty cycle from 0 to 255' },
    ],
    detailId: 'Mengirim gelombang PWM untuk meredupkan LED atau atur kecepatan.',
    detailEn: 'Writes an analog PWM wave to a pin (duty cycle 0..255).',
  },
  {
    label: 'delay',
    insertText: 'delay($0);',
    kind: 'fn',
    returnType: 'void',
    params: [
      { name: 'ms', type: 'unsigned long', descId: 'Durasi tunggu dalam satuan milidetik (1000 = 1 detik)', descEn: 'Duration to pause in milliseconds' },
    ],
    detailId: 'Menjeda eksekusi program sementara sesuai jumlah milidetik.',
    detailEn: 'Pauses program execution for the specified milliseconds.',
  },
  {
    label: 'delayMicroseconds',
    insertText: 'delayMicroseconds($0);',
    kind: 'fn',
    returnType: 'void',
    params: [
      { name: 'us', type: 'unsigned int', descId: 'Durasi jeda dalam mikrodetik (mis. 10 untuk trigger HC-SR04)', descEn: 'Microseconds to pause' },
    ],
    detailId: 'Menjeda eksekusi dalam hitungan mikrodetik presisi tinggi.',
    detailEn: 'Pauses execution for the given number of microseconds.',
  },
  {
    label: 'millis',
    insertText: 'millis()',
    kind: 'fn',
    returnType: 'unsigned long',
    params: [],
    detailId: 'Mengembalikan waktu berjalan sejak mikrokontroler menyala (ms).',
    detailEn: 'Returns milliseconds elapsed since board start.',
  },
  {
    label: 'micros',
    insertText: 'micros()',
    kind: 'fn',
    returnType: 'unsigned long',
    params: [],
    detailId: 'Mengembalikan waktu berjalan dalam mikrodetik sejak boot.',
    detailEn: 'Returns microseconds elapsed since board start.',
  },
  {
    label: 'tone',
    insertText: 'tone($0)',
    kind: 'fn',
    returnType: 'void',
    params: [
      { name: 'pin', type: 'uint8_t', descId: 'Pin GPIO yang terhubung ke Piezo Buzzer', descEn: 'Pin connected to Piezo Buzzer' },
      { name: 'frequency', type: 'unsigned int', descId: 'Frekuensi nada suara dalam Hertz (mis. 440, 1000)', descEn: 'Tone frequency in Hertz (Hz)' },
      { name: 'duration?', type: 'unsigned long', descId: '(Opsional) Lama bunyi nada dalam ms', descEn: '(Optional) Tone duration in ms' },
    ],
    detailId: 'Menghasilkan nada gelombang persegi pada pin Buzzer.',
    detailEn: 'Generates a square wave of the specified frequency on a pin.',
  },
  {
    label: 'noTone',
    insertText: 'noTone($0);',
    kind: 'fn',
    returnType: 'void',
    params: [
      { name: 'pin', type: 'uint8_t', descId: 'Pin Buzzer yang ingin dihentikan nadanya', descEn: 'Pin on which to stop generating tone' },
    ],
    detailId: 'Menghentikan sinyal nada dari fungsi tone() pada pin.',
    detailEn: 'Stops generation of tone triggered by tone().',
  },
  {
    label: 'map',
    insertText: 'map($0)',
    kind: 'fn',
    returnType: 'long',
    params: [
      { name: 'value', type: 'long', descId: 'Nilai input mentah (mis. hasil analogRead)', descEn: 'Number to map' },
      { name: 'fromLow', type: 'long', descId: 'Batas bawah rentang asal (mis. 0)', descEn: 'Lower bound of current range' },
      { name: 'fromHigh', type: 'long', descId: 'Batas atas rentang asal (mis. 4095)', descEn: 'Upper bound of current range' },
      { name: 'toLow', type: 'long', descId: 'Batas bawah rentang hasil (mis. 0)', descEn: 'Lower bound of target range' },
      { name: 'toHigh', type: 'long', descId: 'Batas atas rentang hasil (mis. 180)', descEn: 'Upper bound of target range' },
    ],
    detailId: 'Memetakan nilai dari satu rentang skala ke rentang skala lain.',
    detailEn: 'Re-maps a number from one range to another.',
  },
  {
    label: 'constrain',
    insertText: 'constrain($0)',
    kind: 'fn',
    returnType: 'long',
    params: [
      { name: 'x', type: 'long', descId: 'Nilai yang ingin dibatasi', descEn: 'Value to constrain' },
      { name: 'a', type: 'long', descId: 'Batas minimum yang diizinkan', descEn: 'Lower end of range' },
      { name: 'b', type: 'long', descId: 'Batas maksimum yang diizinkan', descEn: 'Upper end of range' },
    ],
    detailId: 'Membatasi nilai x agar tetap berada di rentang [a, b].',
    detailEn: 'Constrains a number to stay within range [a, b].',
  },
  {
    label: 'ultrasonicRead',
    insertText: 'ultrasonicRead($0)',
    kind: 'fn',
    returnType: 'float',
    params: [
      { name: 'trigPin', type: 'uint8_t', descId: 'Pin TRIG pada sensor ultrasonik HC-SR04', descEn: 'TRIG pin on HC-SR04' },
      { name: 'echoPin', type: 'uint8_t', descId: 'Pin ECHO pada sensor ultrasonik HC-SR04', descEn: 'ECHO pin on HC-SR04' },
    ],
    detailId: 'Mengukur jarak objek menggunakan sensor HC-SR04 (satuan cm).',
    detailEn: 'Measures obstacle distance with HC-SR04 sensor in cm.',
  },
  {
    label: 'pulseIn',
    insertText: 'pulseIn($0)',
    kind: 'fn',
    returnType: 'unsigned long',
    params: [
      { name: 'pin', type: 'uint8_t', descId: 'Pin sinyal masukan yang dibaca durasinya', descEn: 'Pin number on which to read the pulse' },
      { name: 'state', type: 'uint8_t', descId: 'Tipe pulsa yang diukur: HIGH atau LOW', descEn: 'Pulse type to wait for: HIGH or LOW' },
      { name: 'timeout?', type: 'unsigned long', descId: '(Opsional) Batas waktu tunggu dalam mikrodetik', descEn: '(Optional) Timeout in microseconds' },
    ],
    detailId: 'Mengukur durasi lebar pulsa (mikrodetik) pada pin digital.',
    detailEn: 'Reads a pulse duration on a pin in microseconds.',
  },
  {
    label: 'shiftOut',
    insertText: 'shiftOut($0)',
    kind: 'fn',
    returnType: 'void',
    params: [
      { name: 'dataPin', type: 'uint8_t', descId: 'Pin DS / SER ke IC 74HC595', descEn: 'Serial data output pin' },
      { name: 'clockPin', type: 'uint8_t', descId: 'Pin SHCP / SRCLK detak clock', descEn: 'Shift register clock pin' },
      { name: 'bitOrder', type: 'uint8_t', descId: 'Urutan bit: MSBFIRST atau LSBFIRST', descEn: 'Bit order: MSBFIRST or LSBFIRST' },
      { name: 'val', type: 'byte', descId: 'Nilai 1 byte (0..255) yang dikirim keluar', descEn: 'Byte value to shift out' },
    ],
    detailId: 'Menggeser keluar 8-bit data secara serial (cocok untuk 74HC595).',
    detailEn: 'Shifts out a byte of data one bit at a time.',
  },

  // Objects & Snippets
  {
    label: 'Serial.begin(115200)',
    insertText: 'Serial.begin(115200);',
    kind: 'snip',
    returnType: 'void',
    params: [
      { name: 'baud', type: 'unsigned long', descId: 'Kecepatan baud komunikasi serial (standar: 115200 atau 9600)', descEn: 'Serial baud rate (115200 or 9600)' },
    ],
    detailId: 'Mengaktifkan komunikasi Serial Monitor UART pada baudrate 115200.',
    detailEn: 'Initialize Serial UART at 115200 baud.',
  },
  {
    label: 'Serial.println',
    insertText: 'Serial.println($0);',
    kind: 'fn',
    returnType: 'size_t',
    params: [
      { name: 'data', type: 'any', descId: 'Teks string, angka, atau nilai variabel yang dicetak + baris baru', descEn: 'String, number, or expression to print with newline' },
    ],
    detailId: 'Mencetak data ke Serial Monitor diikuti baris baru (newline).',
    detailEn: 'Prints data to the serial port followed by a newline.',
  },
  {
    label: 'Serial.print',
    insertText: 'Serial.print($0);',
    kind: 'fn',
    returnType: 'size_t',
    params: [
      { name: 'data', type: 'any', descId: 'Teks string atau angka untuk dicetak tanpa pindah baris', descEn: 'Value to print without trailing newline' },
    ],
    detailId: 'Mencetak data ke Serial Monitor tanpa berpindah baris.',
    detailEn: 'Prints data to the serial port without newline.',
  },
  { label: 'Serial', insertText: 'Serial', kind: 'const', detailId: 'Objek port serial UART (ketik titik . untuk lihat method)', detailEn: 'Hardware Serial UART object' },
  { label: 'oled', insertText: 'oled', kind: 'const', detailId: 'Objek layar OLED SSD1306 I2C (ketik . untuk lihat method)', detailEn: 'SSD1306 I2C OLED display object' },
  { label: 'dht', insertText: 'dht', kind: 'const', detailId: 'Objek sensor suhu & kelembapan DHT22', detailEn: 'DHT22 temperature & humidity object' },
  { label: 'lcd', insertText: 'lcd', kind: 'const', detailId: 'Objek LCD I2C 16x2 / 20x4 (ketik . untuk lihat method)', detailEn: 'I2C LCD 16x2 / 20x4 object' },
  { label: 'Wire', insertText: 'Wire', kind: 'const', detailId: 'Bus I2C (SDA/SCL)', detailEn: 'I2C TwoWire bus' },
  { label: 'WiFi', insertText: 'WiFi', kind: 'const', detailId: 'Modul koneksi Wi-Fi ESP32/Pico W', detailEn: 'Wi-Fi networking module' },

  // Structure & Control Flow Snippets
  { label: 'setup', insertText: 'void setup() {\n  $0\n}', kind: 'snip', detailId: 'Fungsi inisialisasi program (berjalan 1 kali saat boot)', detailEn: 'Setup function (runs once)' },
  { label: 'loop', insertText: 'void loop() {\n  $0\n}', kind: 'snip', detailId: 'Fungsi utama program (berjalan berulang terus-menerus)', detailEn: 'Main program loop' },
  { label: 'if', insertText: 'if ($0) {\n  \n}', kind: 'kw', detailId: 'Percabangan kondisi if', detailEn: 'Conditional if branch' },
  { label: 'else', insertText: 'else {\n  $0\n}', kind: 'kw', detailId: 'Cabang alternatif else', detailEn: 'Alternative else branch' },
  { label: 'for', insertText: 'for (int i = 0; i < $0; i++) {\n  \n}', kind: 'kw', detailId: 'Perulangan for counter', detailEn: 'For loop counter' },
  { label: 'while', insertText: 'while ($0) {\n  \n}', kind: 'kw', detailId: 'Perulangan selama kondisi bernilai true', detailEn: 'While loop' },
  { label: 'switch', insertText: 'switch ($0) {\n  case 0:\n    break;\n  default:\n    break;\n}', kind: 'kw', detailId: 'Percabangan multi-kasus switch-case', detailEn: 'Switch-case statement' },
  { label: 'return', insertText: 'return $0;', kind: 'kw', detailId: 'Mengembalikan nilai keluar dari fungsi', detailEn: 'Return from function' },

  // Constants
  { label: 'HIGH', insertText: 'HIGH', kind: 'const', detailId: 'Logika tinggi (3.3V / 5V)', detailEn: 'Logic HIGH level' },
  { label: 'LOW', insertText: 'LOW', kind: 'const', detailId: 'Logika rendah (0V / GND)', detailEn: 'Logic LOW level' },
  { label: 'OUTPUT', insertText: 'OUTPUT', kind: 'const', detailId: 'Konfigurasi pin sebagai keluaran', detailEn: 'Configure pin as output' },
  { label: 'INPUT', insertText: 'INPUT', kind: 'const', detailId: 'Konfigurasi pin sebagai masukan', detailEn: 'Configure pin as input' },
  { label: 'INPUT_PULLUP', insertText: 'INPUT_PULLUP', kind: 'const', detailId: 'Masukan dengan resistor pull-up internal aktif', detailEn: 'Input with internal pull-up resistor' },
  { label: 'true', insertText: 'true', kind: 'kw', detailId: 'Nilai boolean benar', detailEn: 'Boolean true' },
  { label: 'false', insertText: 'false', kind: 'kw', detailId: 'Nilai boolean salah', detailEn: 'Boolean false' },

  // C++ / Arduino Types
  { label: 'void', insertText: 'void ', kind: 'type', detailId: 'Tipe fungsi tanpa nilai kembalian', detailEn: 'Void return type' },
  { label: 'int', insertText: 'int ', kind: 'type', detailId: 'Bilangan bulat bertanda (integer)', detailEn: 'Signed integer' },
  { label: 'float', insertText: 'float ', kind: 'type', detailId: 'Bilangan desimal presisi tunggal', detailEn: 'Floating point number' },
  { label: 'bool', insertText: 'bool ', kind: 'type', detailId: 'Tipe logika boolean (true / false)', detailEn: 'Boolean type' },
  { label: 'String', insertText: 'String ', kind: 'type', detailId: 'Kelas objek teks string Arduino', detailEn: 'Arduino String class' },
  { label: 'const', insertText: 'const ', kind: 'type', detailId: 'Deklarasi konstanta baca-saja', detailEn: 'Constant qualifier' },
  { label: 'unsigned', insertText: 'unsigned ', kind: 'type', detailId: 'Modifier bilangan bulat non-negatif', detailEn: 'Unsigned modifier' },
  { label: 'uint8_t', insertText: 'uint8_t ', kind: 'type', detailId: 'Integer 8-bit tak bertanda (0..255)', detailEn: '8-bit unsigned integer' },
  { label: 'Servo', insertText: 'Servo ', kind: 'type', detailId: 'Kelas penggerak motor servo PWM', detailEn: 'PWM Servo controller class' },
]

const PREPROC_SUGGESTIONS: AcSuggestion[] = [
  { label: '#include <ESP32Servo.h>', insertText: '#include <ESP32Servo.h>\n', kind: 'hdr', detailId: 'Library kontrol sudut Servo PWM ESP32', detailEn: 'ESP32 PWM Servo library' },
  { label: '#include <Adafruit_SSD1306.h>', insertText: '#include <Adafruit_SSD1306.h>\n', kind: 'hdr', detailId: 'Driver layar OLED 128×64 I2C', detailEn: '128x64 I2C OLED display driver' },
  { label: '#include <DHT.h>', insertText: '#include <DHT.h>\n', kind: 'hdr', detailId: 'Library sensor suhu & kelembapan DHT22/DHT11', detailEn: 'DHT22/DHT11 sensor library' },
  { label: '#include <LiquidCrystal_I2C.h>', insertText: '#include <LiquidCrystal_I2C.h>\n', kind: 'hdr', detailId: 'Driver layar LCD 16×2 & 20×4 I2C', detailEn: 'I2C 16x2 & 20x4 LCD driver' },
  { label: '#include <Adafruit_NeoPixel.h>', insertText: '#include <Adafruit_NeoPixel.h>\n', kind: 'hdr', detailId: 'Kontrol LED RGB WS2812 / NeoPixel', detailEn: 'WS2812 NeoPixel LED driver' },
  { label: '#include <Wire.h>', insertText: '#include <Wire.h>\n', kind: 'hdr', detailId: 'Komunikasi bus I2C (SDA/SCL)', detailEn: 'I2C communication bus' },
  { label: '#include <WiFi.h>', insertText: '#include <WiFi.h>\n', kind: 'hdr', detailId: 'Koneksi jaringan Wi-Fi', detailEn: 'Wi-Fi connectivity library' },
  { label: '#include <WebServer.h>', insertText: '#include <WebServer.h>\n', kind: 'hdr', detailId: 'Web server HTTP ESP32 (GET/POST & HTML/JSON)', detailEn: 'ESP32 HTTP WebServer library' },
  { label: '#include <PubSubClient.h>', insertText: '#include <PubSubClient.h>\n', kind: 'hdr', detailId: 'Klien MQTT IoT publish/subscribe', detailEn: 'MQTT publish/subscribe client' },
  { label: '#define', insertText: '#define $0 ', kind: 'kw', detailId: 'Definisikan makro / konstanta nomor pin', detailEn: 'Define constant macro or pin' },
]

const MEMBER_MAP: Record<string, AcSuggestion[]> = {
  Serial: [
    {
      label: 'begin',
      insertText: 'begin($0);',
      kind: 'method',
      returnType: 'void',
      params: [{ name: 'baud', type: 'unsigned long', descId: 'Kecepatan baud UART (mis. 115200 atau 9600)', descEn: 'UART baud rate (e.g. 115200 or 9600)' }],
      detailId: 'Mulai antarmuka Serial Monitor UART.',
      detailEn: 'Start Serial UART monitor.',
    },
    {
      label: 'println',
      insertText: 'println($0);',
      kind: 'method',
      returnType: 'size_t',
      params: [{ name: 'val', type: 'any', descId: 'Teks atau nilai variabel yang dicetak + newline', descEn: 'Text or value to print with newline' }],
      detailId: 'Cetak pesan diikuti baris baru ke Serial.',
      detailEn: 'Print line to Serial.',
    },
    {
      label: 'print',
      insertText: 'print($0);',
      kind: 'method',
      returnType: 'size_t',
      params: [{ name: 'val', type: 'any', descId: 'Teks atau nilai yang dicetak tanpa pindah baris', descEn: 'Text or value to print' }],
      detailId: 'Cetak teks tanpa berpindah baris.',
      detailEn: 'Print text to Serial.',
    },
    { label: 'available', insertText: 'available()', kind: 'method', returnType: 'int', params: [], detailId: 'Cek jumlah byte input serial yang siap dibaca.', detailEn: 'Bytes available to read.' },
    { label: 'read', insertText: 'read()', kind: 'method', returnType: 'int', params: [], detailId: 'Baca 1 byte karakter dari buffer masukan Serial.', detailEn: 'Read incoming byte.' },
  ],
  oled: [
    { label: 'begin', insertText: 'begin();', kind: 'method', returnType: 'bool', params: [], detailId: 'Inisialisasi layar OLED SSD1306 I2C.', detailEn: 'Initialize SSD1306 OLED.' },
    { label: 'clear', insertText: 'clear();', kind: 'method', returnType: 'void', params: [], detailId: 'Bersihkan buffer piksel layar OLED.', detailEn: 'Clear OLED framebuffer.' },
    {
      label: 'setCursor',
      insertText: 'setCursor($0, 0);',
      kind: 'method',
      returnType: 'void',
      params: [
        { name: 'x', type: 'int', descId: 'Koordinat kolom piksel horizontal (0..127)', descEn: 'Horizontal pixel X (0..127)' },
        { name: 'y', type: 'int', descId: 'Koordinat baris piksel vertikal (0..63)', descEn: 'Vertical pixel Y (0..63)' },
      ],
      detailId: 'Atur posisi awal kursor teks pada OLED.',
      detailEn: 'Set OLED cursor position.',
    },
    {
      label: 'println',
      insertText: 'println($0);',
      kind: 'method',
      returnType: 'void',
      params: [{ name: 'text', type: 'String', descId: 'Baris teks yang ditulis ke buffer OLED', descEn: 'Line of text for OLED buffer' }],
      detailId: 'Tulis baris teks ke buffer OLED.',
      detailEn: 'Write text line to OLED.',
    },
    { label: 'display', insertText: 'display();', kind: 'method', returnType: 'void', params: [], detailId: 'Kirim buffer agar tampil di layar OLED.', detailEn: 'Flush buffer to OLED screen.' },
  ],
  dht: [
    {
      label: 'readTemperature',
      insertText: 'readTemperature($0)',
      kind: 'method',
      returnType: 'float',
      params: [{ name: 'pin', type: 'uint8_t', descId: 'Pin DATA sensor DHT22 (atau kosong jika terpasang)', descEn: 'DHT22 DATA pin' }],
      detailId: 'Membaca suhu lingkungan dalam °C dari DHT22.',
      detailEn: 'Read temperature (°C) from DHT22.',
    },
    {
      label: 'readHumidity',
      insertText: 'readHumidity($0)',
      kind: 'method',
      returnType: 'float',
      params: [{ name: 'pin', type: 'uint8_t', descId: 'Pin DATA sensor DHT22', descEn: 'DHT22 DATA pin' }],
      detailId: 'Membaca kelembapan relatif (%) dari DHT22.',
      detailEn: 'Read humidity (%) from DHT22.',
    },
  ],
  lcd: [
    { label: 'init', insertText: 'init();', kind: 'method', returnType: 'void', params: [], detailId: 'Inisialisasi modul LCD I2C.', detailEn: 'Initialize I2C LCD.' },
    { label: 'backlight', insertText: 'backlight();', kind: 'method', returnType: 'void', params: [], detailId: 'Menyalakan lampu latar LCD.', detailEn: 'Turn on LCD backlight.' },
    { label: 'clear', insertText: 'clear();', kind: 'method', returnType: 'void', params: [], detailId: 'Menghapus seluruh karakter di layar LCD.', detailEn: 'Clear LCD display.' },
    {
      label: 'setCursor',
      insertText: 'setCursor($0, 0);',
      kind: 'method',
      returnType: 'void',
      params: [
        { name: 'col', type: 'uint8_t', descId: 'Indeks kolom karakter (0..15 atau 0..19)', descEn: 'Column index (0..15 / 0..19)' },
        { name: 'row', type: 'uint8_t', descId: 'Indeks baris LCD (0..1 atau 0..3)', descEn: 'Row index (0..1 / 0..3)' },
      ],
      detailId: 'Pindahkan kursor cetak teks ke kolom & baris LCD.',
      detailEn: 'Set LCD cursor column & row.',
    },
    {
      label: 'print',
      insertText: 'print($0);',
      kind: 'method',
      returnType: 'void',
      params: [{ name: 'text', type: 'any', descId: 'Teks atau angka yang ditampilkan di layar LCD', descEn: 'Text or value to display' }],
      detailId: 'Tampilkan teks pada posisi kursor LCD.',
      detailEn: 'Print text on LCD.',
    },
  ],
  servo: [
    {
      label: 'attach',
      insertText: 'attach($0);',
      kind: 'method',
      returnType: 'uint8_t',
      params: [{ name: 'pin', type: 'int', descId: 'Nomor pin PWM yang terhubung ke kabel sinyal Servo', descEn: 'PWM pin connected to Servo signal' }],
      detailId: 'Hubungkan objek Servo ke pin PWM mikrokontroler.',
      detailEn: 'Attach Servo object to PWM pin.',
    },
    {
      label: 'write',
      insertText: 'write($0);',
      kind: 'method',
      returnType: 'void',
      params: [{ name: 'angle', type: 'int', descId: 'Sudut target putaran tuas Servo (0° hingga 180°)', descEn: 'Target Servo angle (0..180 deg)' }],
      detailId: 'Putar sudut Servo ke derajat yang diinginkan (0..180°).',
      detailEn: 'Rotate Servo angle (0..180°).',
    },
  ],
  WiFi: [
    {
      label: 'begin',
      insertText: 'begin("$0", "");',
      kind: 'method',
      returnType: 'int',
      params: [
        { name: 'ssid', type: 'const char*', descId: 'Nama jaringan Wi-Fi (mis. "Wokwi-GUEST")', descEn: 'Wi-Fi SSID name' },
        { name: 'passphrase?', type: 'const char*', descId: '(Opsional) Kata sandi Wi-Fi atau "" jika terbuka', descEn: '(Optional) Wi-Fi password' },
      ],
      detailId: 'Memulai koneksi stasiun Wi-Fi ESP32/Pico W.',
      detailEn: 'Connect ESP32/Pico W to a Wi-Fi network.',
    },
    {
      label: 'localIP',
      insertText: 'localIP()',
      kind: 'method',
      returnType: 'String',
      params: [],
      detailId: 'Mengembalikan alamat IP lokal Wi-Fi ESP32 saat terhubung.',
      detailEn: 'Return local assigned Wi-Fi IP address.',
    },
  ],
  server: [
    {
      label: 'begin',
      insertText: 'begin();',
      kind: 'method',
      returnType: 'void',
      params: [],
      detailId: 'Mengaktifkan HTTP WebServer di port 80 untuk Web Browser.',
      detailEn: 'Start HTTP WebServer listening on port 80.',
    },
    {
      label: 'on',
      insertText: 'on("$0", handleRoute);',
      kind: 'method',
      returnType: 'void',
      params: [
        { name: 'uri', type: 'const char*', descId: 'Path URL endpoint (mis. "/api/sensors" atau "/led/on")', descEn: 'HTTP route URI path' },
        { name: 'handler', type: 'THandlerFunction', descId: 'Nama fungsi void handler yang dipanggil saat URL diakses', descEn: 'Void callback handler function name' },
      ],
      detailId: 'Mendaftarkan endpoint route WebServer beserta fungsi handler-nya.',
      detailEn: 'Register an HTTP route and handler callback.',
    },
    {
      label: 'send',
      insertText: 'send(200, "application/json", $0);',
      kind: 'method',
      returnType: 'void',
      params: [
        { name: 'code', type: 'int', descId: 'Kode status HTTP (mis. 200, 404)', descEn: 'HTTP status code' },
        { name: 'contentType', type: 'const char*', descId: 'MIME type (mis. "text/html" atau "application/json")', descEn: 'MIME content type' },
        { name: 'content', type: 'String', descId: 'Isi respons HTML, JSON, atau teks ke Web Browser', descEn: 'Response payload string' },
      ],
      detailId: 'Mengirim respons HTTP dari handler WebServer ke Web Browser.',
      detailEn: 'Send HTTP response back to the Web Browser.',
    },
    {
      label: 'handleClient',
      insertText: 'handleClient();',
      kind: 'method',
      returnType: 'void',
      params: [],
      detailId: 'Memproses request HTTP Web Browser & menyinkronkan sensor terbaru.',
      detailEn: 'Process pending HTTP client requests in loop().',
    },
  ],
  mqtt: [
    {
      label: 'begin',
      insertText: 'begin("$0");',
      kind: 'method',
      returnType: 'void',
      params: [{ name: 'brokerUrl', type: 'const char*', descId: 'URL broker MQTT/MQTTS TLS (mis. "mqtts://broker.weblab.local:8883")', descEn: 'MQTT or MQTTS broker URL' }],
      detailId: 'Menghubungkan klien ke broker MQTT IoT.',
      detailEn: 'Configure MQTT broker endpoint.',
    },
    {
      label: 'publish',
      insertText: 'publish("$0", "{}");',
      kind: 'method',
      returnType: 'bool',
      params: [
        { name: 'topic', type: 'const char*', descId: 'Nama topik publikasi MQTT (mis. "ifalab/telemetry")', descEn: 'MQTT topic string' },
        { name: 'payload', type: 'const char*', descId: 'Isi pesan / JSON payload yang dikirim', descEn: 'Payload string or JSON' },
      ],
      detailId: 'Mengirim pesan telemetri ke topik broker MQTT.',
      detailEn: 'Publish payload message to an MQTT topic.',
    },
  ],
}

/** Build formatted VS Code signature string like `void digitalWrite(uint8_t pin, uint8_t val)`. */
export function formatSuggestionSignature(item: AcSuggestion): string | null {
  if (!item.params && !item.returnType) return null
  const ret = item.returnType ? `${item.returnType} ` : ''
  const plist = (item.params ?? []).map((p) => `${p.type} ${p.name}`).join(', ')
  return `${ret}${item.label}(${plist})`
}

function extractSketchSymbols(
  code: string,
  extraFiles: Array<{ name: string; content: string }> = [],
): AcSuggestion[] {
  const seen = new Set<string>(STATIC_SUGGESTIONS.map((s) => s.label))
  const found: AcSuggestion[] = []
  const sources = [
    { name: 'Main.ino', content: code },
    ...extraFiles,
  ]

  for (const src of sources) {
    const defRe = /^\s*#define\s+([A-Za-z_]\w*)(?:\s+([^\n/]+?))?\s*$/gm
    for (let m = defRe.exec(src.content); m !== null; m = defRe.exec(src.content)) {
      const name = m[1]
      if (!seen.has(name)) {
        seen.add(name)
        const val = m[2] ? ` = ${m[2].trim()}` : ''
        found.push({
          label: name,
          insertText: name,
          kind: 'const',
          detailId: `#define ${name}${val} (${src.name})`,
          detailEn: `#define ${name}${val} (${src.name})`,
        })
      }
    }

    const declRe = /\b(?:int|float|double|bool|boolean|byte|long|uint8_t|uint16_t|uint32_t|String|Servo)\s+([A-Za-z_]\w*)/g
    for (let m = declRe.exec(src.content); m !== null; m = declRe.exec(src.content)) {
      const name = m[1]
      if (!seen.has(name) && name !== 'setup' && name !== 'loop') {
        seen.add(name)
        found.push({
          label: name,
          insertText: name,
          kind: 'var',
          detailId: `Variabel / objek (${src.name})`,
          detailEn: `Sketch variable / object (${src.name})`,
        })
      }
    }

    const fnRe = /^\s*(?:void|int|float|double|long|bool|boolean|String|uint\d+_t)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/gm
    for (let m = fnRe.exec(src.content); m !== null; m = fnRe.exec(src.content)) {
      const fnName = m[1]
      if (!seen.has(fnName) && fnName !== 'setup' && fnName !== 'loop') {
        seen.add(fnName)
        const hasArgs = m[2].trim().length > 0
        found.push({
          label: fnName,
          insertText: hasArgs ? `${fnName}($0)` : `${fnName}()`,
          kind: 'fn',
          detailId: `Fungsi proyek (${src.name}): ${fnName}(${m[2].trim()})`,
          detailEn: `Project function (${src.name}): ${fnName}(${m[2].trim()})`,
        })
      }
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
export function getArduinoAutocomplete(
  code: string,
  cursor: number,
  force = false,
  extraFiles: Array<{ name: string; content: string }> = [],
): AcResult | null {
  const lineStart = code.lastIndexOf('\n', cursor - 1) + 1
  const lineBefore = code.slice(lineStart, cursor)

  if (!force && isInsideCommentOrString(lineBefore)) {
    return null
  }

  // 1. Preprocessor (#include / #define) — ikut menyarankan file lokal proyek (#include "file.h")
  const preprocMatch = /^\s*(#[A-Za-z0-9_<./" ]*)$/.exec(lineBefore)
  if (preprocMatch) {
    const typed = preprocMatch[1].toLowerCase()
    const replaceStart = cursor - preprocMatch[1].length
    const localIncludeItems: AcSuggestion[] = extraFiles
      .filter((f) => /\.(h|hpp|cpp|c|ino)$/i.test(f.name))
      .map((f) => ({
        label: `#include "${f.name}"`,
        insertText: `#include "${f.name}"\n$0`,
        kind: 'hdr' as const,
        detailId: `Sertakan file proyek lokal (${f.name})`,
        detailEn: `Include local project file (${f.name})`,
      }))
    const items = [...localIncludeItems, ...PREPROC_SUGGESTIONS]
      .filter((s) => s.label.toLowerCase().startsWith(typed) || s.label.toLowerCase().includes(typed))
      .slice(0, 8)
    return items.length > 0 ? { replaceStart, replaceEnd: cursor, items } : null
  }

  // 2. Member access (Serial. / oled. / dht. / lcd. / gateServo. / WiFi. / mqtt.)
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
  const all = [...extractSketchSymbols(code, extraFiles), ...STATIC_SUGGESTIONS]

  const starts = all.filter((s) => s.label.toLowerCase().startsWith(lower) && s.label !== typedWord)
  const contains = all.filter((s) => !s.label.toLowerCase().startsWith(lower) && s.label.toLowerCase().includes(lower))
  const items = (typedWord ? [...starts, ...contains] : all).slice(0, 9)

  return items.length > 0 ? { replaceStart, replaceEnd: cursor, items } : null
}

/**
 * VS Code-style Signature Help / Parameter Hint detector while cursor sits inside `fnName(...)`.
 */
export function getArduinoSignatureHelp(code: string, cursor: number): SignatureHelpResult | null {
  if (cursor <= 0) return null
  const limit = Math.max(0, cursor - 280)
  let depth = 0
  let commas = 0
  let inStr = false
  let openParenIdx = -1

  for (let i = cursor - 1; i >= limit; i--) {
    const ch = code[i]
    if (ch === '"' && code[i - 1] !== '\\') {
      inStr = !inStr
      continue
    }
    if (inStr) continue
    if (ch === ';' || ch === '{' || ch === '}') {
      break
    }
    if (ch === ')') {
      depth += 1
    } else if (ch === '(') {
      if (depth === 0) {
        openParenIdx = i
        break
      }
      depth -= 1
    } else if (ch === ',' && depth === 0) {
      commas += 1
    }
  }

  if (openParenIdx < 0) return null
  const beforeParen = code.slice(Math.max(0, openParenIdx - 64), openParenIdx)
  const callMatch = /(?:([A-Za-z_]\w*)\.)?([A-Za-z_]\w*)\s*$/.exec(beforeParen)
  if (!callMatch) return null

  const objName = callMatch[1]
  const fnName = callMatch[2]
  if (fnName === 'if' || fnName === 'for' || fnName === 'while' || fnName === 'switch') return null

  let suggestion: AcSuggestion | undefined
  let displayName = fnName
  if (objName) {
    const candidates =
      MEMBER_MAP[objName] ??
      (/servo|arm|gate/i.test(objName) ? MEMBER_MAP.servo : /lcd/i.test(objName) ? MEMBER_MAP.lcd : [])
    suggestion = candidates.find((c) => c.label === fnName)
    displayName = `${objName}.${fnName}`
  } else {
    suggestion = STATIC_SUGGESTIONS.find((c) => c.label === fnName && (c.kind === 'fn' || c.params))
  }

  if (!suggestion || !suggestion.params) return null

  const params = suggestion.params
  const activeParam = params.length > 0 ? Math.min(commas, params.length - 1) : 0
  return {
    fnName: displayName,
    returnType: suggestion.returnType ?? 'void',
    params,
    activeParam,
    summaryId: suggestion.detailId,
    summaryEn: suggestion.detailEn,
  }
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
