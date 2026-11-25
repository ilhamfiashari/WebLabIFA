export type DocCategoryId = 'getting-started' | 'guides' | 'boards' | 'parts-basic' | 'parts-inputs' | 'parts-sensors' | 'parts-displays' | 'parts-actuators'

export interface DocPinRow {
  pin: string
  name: string
  descId: string
  descEn: string
}

export interface DocAttrRow {
  attr: string
  defaultVal: string
  descId: string
  descEn: string
}

export interface DocTableBlock {
  headersId: string[]
  headersEn: string[]
  rows: string[][]
}

export interface DocSection {
  id: string
  category: DocCategoryId
  wokwiType?: string
  wokwiUrl: string
  titleId: string
  titleEn: string
  badge?: string
  summaryId: string
  summaryEn: string
  howItWorksId: string[]
  howItWorksEn: string[]
  pins?: DocPinRow[]
  attrs?: DocAttrRow[]
  table?: DocTableBlock
  diagramSnippet?: string
  codeSnippet?: string
}

export const DOC_CATEGORIES: Array<{ id: DocCategoryId; titleId: string; titleEn: string }> = [
  { id: 'getting-started', titleId: 'Mulai Cepat', titleEn: 'Getting Started' },
  { id: 'guides', titleId: 'Panduan & Fisika Rangkaian', titleEn: 'Guides & Circuit Physics' },
  { id: 'boards', titleId: 'Mikrokontroler (Boards)', titleEn: 'Microcontrollers (Boards)' },
  { id: 'parts-basic', titleId: 'Komponen Dasar & Pasif', titleEn: 'Basic & Passive Parts' },
  { id: 'parts-inputs', titleId: 'Perangkat Input', titleEn: 'Input Devices' },
  { id: 'parts-sensors', titleId: 'Sensor Lingkungan & Gerak', titleEn: 'Sensors' },
  { id: 'parts-displays', titleId: 'Layar & Indikator (Displays)', titleEn: 'Displays & LEDs' },
  { id: 'parts-actuators', titleId: 'Aktuator, Relay & IC', titleEn: 'Actuators, Relays & ICs' },
]

export const WOKWI_DOCS_SECTIONS: DocSection[] = [
  // ===================== GETTING STARTED =====================
  {
    id: 'welcome',
    category: 'getting-started',
    wokwiUrl: 'https://docs.wokwi.com/',
    titleId: 'Pengenalan IoT Simulator',
    titleEn: 'Introduction to IoT Simulator',
    badge: 'Start Here',
    summaryId:
      'IFA Lab IoT Simulator adalah lingkungan simulasi mikrokontroler dan rangkaian elektronik interaktif berbasis standar Wokwi (diagram.json + Arduino C++).',
    summaryEn:
      'IFA Lab IoT Simulator is an interactive microcontroller and electronic circuit simulator following Wokwi standards (diagram.json + Arduino C++).',
    howItWorksId: [
      'Pilih papan mikrokontroler (ESP32-C3, ESP32 DevKit, Arduino Uno/Nano/Mega, Raspberry Pi Pico/Pico W) atau mulai dari misi/preset praktikum.',
      'Tambahkan komponen dari tab Components atau tombol (+) pada kanvas, lalu tarik kabel (wire) antar pin untuk membentuk rangkaian.',
      'Klik komponen di kanvas untuk mengubah properti secara langsung: nilai resistor (Ω & 4 gelang warna), warna LED, sudut potensiometer, jarak ultrasonik, suhu DHT22, gerakan PIR, hingga tekan tombol.',
      'Tekan Start Simulation (Play) untuk menjalankan kode Main.ino, pantau keluaran di Serial Monitor, Serial Plotter, Logic Analyzer, MQTT Broker, dan Web Browser bawaan.',
    ],
    howItWorksEn: [
      'Choose a microcontroller board (ESP32-C3, ESP32 DevKit, Arduino Uno/Nano/Mega, Raspberry Pi Pico/Pico W) or start from a practicum mission/preset.',
      'Add parts from the Components tab or canvas (+) button, then drag wires between pins to build your circuit.',
      'Click any placed component to adjust properties live: resistor value (Ω & 4 color bands), LED color, potentiometer knob, ultrasonic distance, DHT22 temperature, PIR motion, or button press.',
      'Click Start Simulation (Play) to run Main.ino and inspect live outputs via Serial Monitor, Serial Plotter, Logic Analyzer, MQTT Broker, and the built-in Web Browser.',
    ],
    table: {
      headersId: ['Pintasan Keyboard', 'Fungsi di Editor Kanvas'],
      headersEn: ['Keyboard Shortcut', 'Canvas Editor Action'],
      rows: [
        ['R / Shift+R', 'Putar komponen terpilih 90° searah / berlawanan jarum jam'],
        ['Delete / Backspace', 'Hapus komponen atau kabel yang dipilih'],
        ['Ctrl+Z / Ctrl+Y', 'Undo / Redo perubahan rangkaian'],
        ['Ctrl+D', 'Duplikasi komponen terpilih'],
        ['Scroll / + / -', 'Zoom in / Zoom out kanvas rangkaian'],
        ['Spasi + Drag', 'Geser (pan) area kanvas'],
      ],
    },
  },
  {
    id: 'diagram-json',
    category: 'getting-started',
    wokwiUrl: 'https://docs.wokwi.com/diagram-format',
    titleId: 'Format diagram.json & Diagram Editor',
    titleEn: 'diagram.json Format & Diagram Editor',
    badge: 'Schema v1',
    summaryId:
      'Setiap rangkaian di IoT Simulator disimpan dan disinkronkan dua arah dengan file diagram.json mengikuti spesifikasi Wokwi version 1.',
    summaryEn:
      'Every circuit in the IoT Simulator is stored and synchronized bidirectionally with diagram.json following the Wokwi version 1 specification.',
    howItWorksId: [
      'Properti `parts` berisi daftar objek komponen: `type` (mis. `wokwi-led`, `wokwi-resistor`), `id` unik, posisi `top` & `left`, rotasi `rotate` (kelipatan 90°), dan `attrs`.',
      'Properti `connections` adalah daftar tuple `[pinSumber, pinTujuan, warnaKabel, [waypoints]]`, misalnya `["esp:GPIO2", "r1:1", "green", ["v0"]]`.',
      'Anda dapat mengedit file `diagram.json` secara langsung pada tab diagram.json, atau menyusun secara visual di kanvas — keduanya selalu sinkron otomatis.',
    ],
    howItWorksEn: [
      'The `parts` array lists placed parts: `type` (e.g., `wokwi-led`, `wokwi-resistor`), unique `id`, `top` & `left` coordinates, `rotate` (90° steps), and `attrs`.',
      'The `connections` array holds wire tuples `[fromPin, toPin, wireColor, [waypoints]]`, e.g., `["esp:GPIO2", "r1:1", "green", ["v0"]]`.',
      'You can edit `diagram.json` directly in the diagram.json tab or wire visually on the canvas — both stay automatically synchronized.',
    ],
    diagramSnippet: `{
  "version": 1,
  "author": "IFA Lab Student",
  "editor": "wokwi",
  "parts": [
    { "type": "board-esp32-c3-devkitm-1", "id": "esp", "top": 0, "left": 0, "attrs": {} },
    { "type": "wokwi-resistor", "id": "r1", "top": 120, "left": 240, "attrs": { "value": "220" } },
    { "type": "wokwi-led", "id": "led1", "top": 90, "left": 370, "attrs": { "color": "red" } }
  ],
  "connections": [
    ["esp:GPIO2", "r1:1", "green", ["v0"]],
    ["r1:2", "led1:A", "green", ["v0"]],
    ["led1:C", "esp:GND.1", "black", ["v0"]]
  ]
}`,
  },

  // ===================== GUIDES & CIRCUIT PHYSICS =====================
  {
    id: 'circuit-physics',
    category: 'guides',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-resistor',
    titleId: 'Hukum Ohm, Kecerahan LED & Interaksi Rangkaian',
    titleEn: "Ohm's Law, LED Brightness & Circuit Physics",
    badge: 'Physics Engine',
    summaryId:
      'Simulator menghitung jalur listrik dan resistansi seri secara nyata menggunakan Hukum Ohm sehingga nilai resistor, posisi sakelar, relay, dan potensiometer langsung memengaruhi komponen terhubung.',
    summaryEn:
      "The simulator solves electrical paths and cumulative series resistance using Ohm's Law so resistor values, switches, relays, and potentiometers directly affect connected loads.",
    howItWorksId: [
      'Hukum Ohm pada LED: Arus yang mengalir adalah I = (V_sumber − V_f) / R_total. Semakin besar nilai resistor (Ω), arus (mA) semakin kecil dan cahaya LED semakin redup secara halus.',
      'Resistor seri dapat dipasang di sisi Anoda (+) maupun sisi Katoda (−) LED, atau keduanya (nilai hambatan seri dijumlahkan). Tanpa resistor atau jika R < 47Ω, LED menampilkan peringatan OVERCURRENT.',
      'Sakelar (Pushbutton, Slide Switch, DIP Switch) dan kontak Relay (COM↔NO/NC) menghantarkan listrik secara fisik: rangkaian 5V → Tombol → Resistor → LED → GND menyala langsung saat tombol ditekan.',
      'Potensiometer dan Slide Potentiometer bekerja baik sebagai pembagi tegangan ADC (`analogRead`) maupun rheostat seri untuk meredupkan LED saat kenop diputar.',
      'Breadboard menghubungkan 5 lubang vertikal tiap kolom (a–e dan f–j) serta rel daya horizontal (+ dan −) tanpa menambah resistansi.',
    ],
    howItWorksEn: [
      "Ohm's Law on LEDs: Current is I = (V_supply − V_f) / R_total. Larger resistance (Ω) reduces current (mA) and smoothly dims LED luminance and halo glow.",
      'Series resistors work on either the Anode (+) leg, Cathode (−) leg, or both (series resistances add up). Missing resistor or R < 47Ω triggers an OVERCURRENT warning.',
      'Switches (Pushbutton, Slide Switch, DIP Switch) and Relay contacts (COM↔NO/NC) physically conduct current: wiring 5V → Button → Resistor → LED → GND lights the LED directly on press.',
      'Potentiometers and Slide Potentiometers work both as ADC voltage dividers (`analogRead`) and inline series dimmers when wired between power and an LED.',
      'Breadboards connect 5-hole vertical strips (a–e and f–j) and horizontal power rails (+ / −) with 0Ω trace resistance.',
    ],
    table: {
      headersId: ['Nilai Resistor (R)', 'Arus @ 3.3V (LED Merah)', 'Arus @ 5V (LED Merah)', 'Kecerahan Visual LED'],
      headersEn: ['Resistor Value (R)', 'Current @ 3.3V (Red LED)', 'Current @ 5V (Red LED)', 'Visual LED Brightness'],
      rows: [
        ['Tanpa Resistor / < 47Ω', '> 30 mA (! Bahaya)', '> 60 mA (! Bahaya)', '100% + Peringatan ! OVERCURRENT'],
        ['220 Ω (Rekomendasi)', '~6.6 mA', '~14.3 mA', '100% — Terang penuh & aman'],
        ['330 Ω', '~4.4 mA', '~9.5 mA', '~80% — Terang nyaman'],
        ['470 Ω', '~3.1 mA', '~6.7 mA', '~65% — Sedang-terang'],
        ['1 kΩ', '~1.45 mA', '~3.15 mA', '~42% — Mulai redup jelas'],
        ['4.7 kΩ', '~0.31 mA', '~0.67 mA', '~17% — Redup'],
        ['10 kΩ', '~0.15 mA', '~0.32 mA', '~11% — Sangat redup'],
        ['100 kΩ', '~15 µA', '~32 µA', '~3% — Nyaris padam'],
        ['1 MΩ', '~1.5 µA', '~3.2 µA', '0% — Padam'],
      ],
    },
  },
  {
    id: 'serial-monitor',
    category: 'guides',
    wokwiUrl: 'https://docs.wokwi.com/guides/serial-monitor',
    titleId: 'Serial Monitor & Serial Plotter',
    titleEn: 'Serial Monitor & Serial Plotter',
    badge: 'Debugging',
    summaryId:
      'Gunakan Serial Monitor untuk mencetak log debug, menerima perintah teks dari pengguna, dan memvisualisasikan grafik telemetri sensor secara real-time di Serial Plotter.',
    summaryEn:
      'Use Serial Monitor to print debug logs, send interactive text commands, and plot real-time sensor waveforms in the Serial Plotter.',
    howItWorksId: [
      'Panggil `Serial.begin(115200)` (atau `9600` pada Arduino Uno) di dalam `setup()`.',
      'Keluaran `Serial.println("Temp: 28.4 Hum: 62")` secara otomatis dideteksi oleh tab Serial Plotter sebagai grafik deret waktu `Temp` dan `Hum`.',
      'Ketik teks pada kotak input Serial Monitor dan tekan Enter untuk mengirim data yang bisa dibaca sketch dengan `Serial.available()` dan `Serial.readString()`.',
    ],
    howItWorksEn: [
      'Call `Serial.begin(115200)` (or `9600` on Arduino Uno) inside `setup()`.',
      'Outputs formatted as `key: value` (e.g., `Serial.println("Temp: 28.4 Hum: 62")`) are automatically graphed in the Serial Plotter tab.',
      'Type text in the Serial Monitor TX bar to feed `Serial.available()` and `Serial.readString()` live.',
    ],
    codeSnippet: `void setup() {
  Serial.begin(115200);
  Serial.println("System booted!");
}

void loop() {
  int val = analogRead(34);
  Serial.println("ADC: " + String(val));
  delay(500);
}`,
  },
  {
    id: 'logic-analyzer',
    category: 'guides',
    wokwiUrl: 'https://docs.wokwi.com/guides/logic-analyzer',
    titleId: 'Logic Analyzer & Ekspor VCD',
    titleEn: 'Logic Analyzer & VCD Export',
    badge: 'Timing',
    summaryId:
      'Pantau perubahan sinyal digital HIGH/LOW pada banyak pin GPIO secara bersamaan dan ekspor ke format VCD (Value Change Dump) untuk analisis gelombang.',
    summaryEn:
      'Inspect digital HIGH/LOW transitions across multiple GPIO channels simultaneously and export VCD (Value Change Dump) traces.',
    howItWorksId: [
      'Saat simulasi berjalan, setiap perubahan status pin GPIO terekam pada tab Logic Analyzer.',
      'Gunakan Logic Analyzer untuk memeriksa duty cycle PWM (`analogWrite`), pulsa `tone()`, respons tombol, dan sinkronisasi antar board multi-MCU.',
      'Klik tombol Export VCD untuk mengunduh rekaman sinyal standar yang bisa dibuka di PulseView / GTKWave.',
    ],
    howItWorksEn: [
      'While simulation runs, digital transitions across GPIO channels are captured in the Logic Analyzer tab.',
      'Verify PWM duty cycles (`analogWrite`), `tone()` pulses, button transitions, and multi-MCU communication.',
      'Export standard `.vcd` waveforms compatible with PulseView and GTKWave.',
    ],
  },
  {
    id: 'esp32-wifi',
    category: 'guides',
    wokwiUrl: 'https://docs.wokwi.com/guides/esp32-wifi',
    titleId: 'Simulasi Wi-Fi ESP32, Web Server & MQTT TLS',
    titleEn: 'ESP32 Wi-Fi Simulation, Web Server & MQTT TLS',
    badge: 'Networking',
    summaryId:
      'ESP32, ESP32-C3, dan Raspberry Pi Pico W mendukung akses Wi-Fi virtual (`Wokwi-GUEST`), Web Server HTTP lokal yang dapat diuji lewat komponen Web Browser, serta publikasi telemetri MQTT/MQTTS.',
    summaryEn:
      'ESP32, ESP32-C3, and Raspberry Pi Pico W support virtual Wi-Fi (`Wokwi-GUEST`), an HTTP Web Server testable via the canvas Web Browser part, and MQTT/MQTTS telemetry.',
    howItWorksId: [
      'Hubungkan ke AP virtual dengan `WiFi.begin("Wokwi-GUEST", "")` — board otomatis memperoleh IP lokal virtual `10.13.37.2`.',
      'Daftarkan route HTTP menggunakan `server.on("/", handleRoot)` dan `server.begin()`, lalu tambahkan komponen `Web Browser` di kanvas atau buka tab Browser di Terminal untuk menguji endpoint `/`, `/api/sensors`, dan tombol kendali.',
      'Untuk keamanan IoT, gunakan protokol terenkripsi `mqtts://broker.weblab.local:8883` pada `mqtt.begin(...)` alih-alih `mqtt://` plaintext.',
    ],
    howItWorksEn: [
      'Connect to the virtual AP via `WiFi.begin("Wokwi-GUEST", "")` — the board receives virtual IP `10.13.37.2`.',
      'Register HTTP handlers with `server.on("/", handleRoot)` and `server.begin()`, then open the Web Browser component/tab to test routes and live sensor dashboards.',
      'For secure IoT telemetry, prefer encrypted `mqtts://` over plaintext `mqtt://` in `mqtt.begin(...)`.',
    ],
    codeSnippet: `#include <WiFi.h>
#include <WebServer.h>

void handleRoot() {
  server.send(200, "text/html", "<h1>ESP32 Live</h1><p>Temp: {{TEMP}} C</p>");
}

void setup() {
  Serial.begin(115200);
  WiFi.begin("Wokwi-GUEST", "");
  server.on("/", handleRoot);
  server.begin();
}

void loop() {
  server.handleClient();
  delay(250);
}`,
  },
  {
    id: 'libraries',
    category: 'guides',
    wokwiUrl: 'https://docs.wokwi.com/guides/libraries',
    titleId: 'Pustaka (Libraries) & Proyek Multi-File',
    titleEn: 'Libraries & Multi-File Projects',
    badge: 'Arduino C++',
    summaryId:
      'Simulator mendukung pustaka populer ekosistem Arduino/Wokwi serta pembuatan tab file tambahan (.h, .cpp, .html, .css, .js) yang tersinkronisasi dengan Main.ino.',
    summaryEn:
      'Supports popular Arduino/Wokwi libraries along with multi-file tabs (.h, .cpp, .html, .css, .js) synchronized with Main.ino.',
    howItWorksId: [
      'Buka tab `Libraries` untuk melihat dan menyisipkan header siap pakai (`DHT.h`, `LiquidCrystal_I2C.h`, `Servo.h`, `Adafruit_SSD1306.h`, `Adafruit_NeoPixel.h`, `PubSubClient.h`, `Keypad.h`, `MPU6050.h`).',
      'Gunakan menu dropdown file di sebelah tab `Terminal` untuk menambah file header `.h` lokal (mis. `config.h`) dan panggil dengan `#include "config.h"`.',
      'Anda juga dapat membuat file `index.html` untuk menyajikan halaman web kustom langsung dari WebServer ESP32 dengan template variabel seperti `{{TEMP}}`, `{{HUMIDITY}}`, `{{LED_STATE}}`.',
    ],
    howItWorksEn: [
      'Open the `Libraries` tab to browse and insert ready-to-use headers (`DHT.h`, `LiquidCrystal_I2C.h`, `Servo.h`, `Adafruit_SSD1306.h`, `Adafruit_NeoPixel.h`, `PubSubClient.h`, `Keypad.h`, `MPU6050.h`).',
      'Use the file menu next to the `Terminal` tab to add custom `.h` headers and include them via `#include "config.h"`.',
      'Add an `index.html` file to serve custom dashboards from ESP32 WebServer using live template placeholders like `{{TEMP}}`, `{{HUMIDITY}}`, and `{{LED_STATE}}`.',
    ],
  },

  // ===================== BOARDS =====================
  {
    id: 'boards-overview',
    category: 'boards',
    wokwiUrl: 'https://docs.wokwi.com/guides/esp32',
    titleId: 'Referensi Papan Mikrokontroler',
    titleEn: 'Microcontroller Boards Reference',
    badge: '7 Boards',
    summaryId:
      'Perbandingan tegangan logika, resolusi ADC, konektivitas nirkabel, dan pin LED bawaan untuk seluruh papan mikrokontroler yang didukung di simulator.',
    summaryEn:
      'Logic voltage, ADC resolution, wireless capabilities, and built-in LED GPIO reference across all supported microcontroller boards.',
    howItWorksId: [
      'Perhatikan perbedaan tegangan logika: ESP32 / ESP32-C3 / Raspberry Pi Pico bekerja pada **3.3V** (ADC 12-bit: 0–4095), sedangkan Arduino Uno / Nano / Mega bekerja pada **5V** (ADC 10-bit: 0–1023).',
      'Jangan menghubungkan rel 5V langsung ke pin GPIO 3.3V pada ESP32 atau Pico — pemeriksa keamanan rangkaian akan menampilkan peringatan Over-Voltage.',
      'Anda juga dapat menempatkan beberapa papan MCU sekaligus pada satu kanvas untuk simulasi komunikasi antar-node (UART TX/RX atau sinyal GPIO).',
    ],
    howItWorksEn: [
      'Mind logic levels: ESP32 / ESP32-C3 / Raspberry Pi Pico run at **3.3V** (12-bit ADC: 0–4095), while Arduino Uno / Nano / Mega run at **5V** (10-bit ADC: 0–1023).',
      'Never connect a 5V rail directly to a 3.3V GPIO pin on ESP32/Pico — the safety analyzer flags 5V Over-Voltage errors.',
      'You can also place multiple MCU boards on the same canvas to simulate peer-to-peer UART or GPIO signaling.',
    ],
    table: {
      headersId: ['Board', 'Arsitektur', 'Tegangan', 'Clock', 'Wi-Fi / BLE', 'ADC', 'LED Bawaan'],
      headersEn: ['Board', 'Architecture', 'Logic V', 'Clock', 'Wi-Fi / BLE', 'ADC', 'Built-in LED'],
      rows: [
        ['ESP32-C3 DevKitM-1', 'RISC-V 32-bit', '3.3V', '160 MHz', 'Wi-Fi + BLE 5', '0–4095', 'GPIO 8'],
        ['ESP32 DevKit v1', 'Xtensa Dual-Core', '3.3V', '240 MHz', 'Wi-Fi + BT', '0–4095', 'GPIO 2'],
        ['Arduino Uno R3', 'AVR ATmega328P', '5V', '16 MHz', '—', '0–1023', 'D13'],
        ['Arduino Nano', 'AVR ATmega328P', '5V', '16 MHz', '—', '0–1023', 'D13'],
        ['Arduino Mega 2560', 'AVR ATmega2560', '5V', '16 MHz', '—', '0–1023', 'D13'],
        ['Raspberry Pi Pico W', 'RP2040 Dual ARM', '3.3V', '133 MHz', 'Wi-Fi + BLE', '0–4095', 'GP25'],
        ['Raspberry Pi Pico', 'RP2040 Dual ARM', '3.3V', '133 MHz', '—', '0–4095', 'GP25'],
      ],
    },
  },

  // ===================== PARTS: BASIC & PASSIVES =====================
  {
    id: 'part-led',
    category: 'parts-basic',
    wokwiType: 'wokwi-led',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-led',
    titleId: 'LED (5mm Standard LED)',
    titleEn: 'LED (5mm Standard LED)',
    badge: 'wokwi-led',
    summaryId:
      'Light-Emitting Diode 5mm standar. Kecerahan cahaya bergantung langsung pada sinyal digital/PWM serta nilai resistor pembatas arus seri (Hukum Ohm).',
    summaryEn:
      'Standard 5mm Light-Emitting Diode. Luminance scales continuously with digital/PWM duty cycle and series current-limiting resistance (Ohm\'s Law).',
    howItWorksId: [
      'Hubungkan pin Anoda (`A` / kaki panjang `+`) ke GPIO atau VCC melalui resistor seri (disarankan 220Ω–330Ω), dan pin Katoda (`K` / `C` / kaki pendek `−`) ke GND.',
      'Resistor juga boleh dipasang di sisi Katoda antara `K` dan `GND` — arus yang mengalir sama sesuai rangkaian seri.',
      'Ubah nilai resistor menjadi 1kΩ, 4.7kΩ, atau 10kΩ saat simulasi berjalan untuk melihat cahaya LED meredup secara langsung bersama pembacaan arus (mA).',
      'Jika kutub terbalik (reverse bias), LED tidak akan menyala. Gunakan opsi `flip` di pengaturan LED untuk membalik posisi kaki secara horizontal.',
    ],
    howItWorksEn: [
      'Connect Anode (`A` / `+`) to a GPIO or VCC through a series resistor (recommended 220Ω–330Ω), and Cathode (`K` / `C` / `−`) to GND.',
      'The resistor may be placed on either the Anode side or Cathode side — series current is identical.',
      'Change the resistor value to 1kΩ, 4.7kΩ, or 10kΩ during simulation to watch LED glow dim smoothly alongside live current (mA).',
      'Reverse-biased LEDs stay off. Use the `flip` toggle in the LED inspector to mirror pins horizontally.',
    ],
    pins: [
      { pin: 'A (+)', name: 'Anode', descId: 'Kutub positif LED (sambungkan ke GPIO/VCC lewat resistor)', descEn: 'Positive terminal (connect to GPIO/VCC via resistor)' },
      { pin: 'K / C (−)', name: 'Cathode', descId: 'Kutub negatif LED (sambungkan ke GND)', descEn: 'Negative terminal (connect to GND)' },
    ],
    attrs: [
      { attr: 'color', defaultVal: '"red"', descId: 'Warna LED: red, green, blue, yellow, orange, purple, cyan, white', descEn: 'LED color: red, green, blue, yellow, orange, purple, cyan, white' },
      { attr: 'flip', defaultVal: 'false', descId: 'Membalik posisi pin Anoda dan Katoda secara horizontal', descEn: 'Flips Anode and Cathode pin positions horizontally' },
    ],
    codeSnippet: `#define LED_PIN 2

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}`,
  },
  {
    id: 'part-rgb-led',
    category: 'parts-basic',
    wokwiType: 'wokwi-rgb-led',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-rgb-led',
    titleId: 'RGB LED (Common Cathode / Anode)',
    titleEn: 'RGB LED (Common Cathode / Anode)',
    badge: 'wokwi-rgb-led',
    summaryId:
      'LED multi-warna dengan kanal Merah (R), Hijau (G), dan Biru (B) yang dapat dicampur menggunakan sinyal PWM (`analogWrite`).',
    summaryEn:
      'Multi-color LED combining Red (R), Green (G), and Blue (B) channels mixed via PWM (`analogWrite`).',
    howItWorksId: [
      'Mode bawaan adalah Common Cathode (`common: "cathode"`): sambungkan pin `GND` ke GND, lalu kendalikan pin `R`, `G`, `B` dengan `analogWrite(pin, 0..255)` melalui resistor seri.',
      'Pada mode Common Anode (`common: "anode"`), sambungkan pin common ke VCC (`3V3`/`5V`); sinyal LOW menyalakan kanal warna (logika terbalik).',
    ],
    howItWorksEn: [
      'Default mode is Common Cathode (`common: "cathode"`): wire `GND` to ground and drive `R`, `G`, `B` with `analogWrite(pin, 0..255)` via series resistors.',
      'In Common Anode mode (`common: "anode"`), connect common to VCC (`3V3`/`5V`); LOW duty lights each channel.',
    ],
    pins: [
      { pin: 'R', name: 'Red', descId: 'Kanal LED merah (PWM)', descEn: 'Red LED channel (PWM)' },
      { pin: 'GND', name: 'Common', descId: 'Common Cathode (GND) atau Common Anode (VCC)', descEn: 'Common Cathode (GND) or Common Anode (VCC)' },
      { pin: 'G', name: 'Green', descId: 'Kanal LED hijau (PWM)', descEn: 'Green LED channel (PWM)' },
      { pin: 'B', name: 'Blue', descId: 'Kanal LED biru (PWM)', descEn: 'Blue LED channel (PWM)' },
    ],
    attrs: [
      { attr: 'common', defaultVal: '"cathode"', descId: '"cathode" atau "anode"', descEn: '"cathode" or "anode"' },
    ],
    codeSnippet: `void setup() {
  pinMode(9, OUTPUT); pinMode(10, OUTPUT); pinMode(11, OUTPUT);
}
void loop() {
  analogWrite(9, 255); analogWrite(10, 60); analogWrite(11, 0);
  delay(600);
  analogWrite(9, 0); analogWrite(10, 180); analogWrite(11, 255);
  delay(600);
}`,
  },
  {
    id: 'part-resistor',
    category: 'parts-basic',
    wokwiType: 'wokwi-resistor',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-resistor',
    titleId: 'Resistor (4 Gelang Warna)',
    titleEn: 'Resistor (4-Band Axial)',
    badge: 'wokwi-resistor',
    summaryId:
      'Komponen pasif pembatas arus dan pembagi tegangan dengan kode 4 gelang warna dinamis. Tidak memiliki polaritas.',
    summaryEn:
      'Passive current-limiting and pull-up/down resistor with live 4-band color code. Non-polarized.',
    howItWorksId: [
      'Klik resistor di kanvas untuk mengubah nilai hambatan melalui input angka Ohm langsung, tombol cepat (47Ω – 1MΩ), atau memilih 3 gelang warna secara interaktif.',
      'Saat terpasang seri dengan LED (baik di sisi Anoda maupun Katoda), mengubah nilai hambatan langsung memperbarui arus (mA) dan kecerahan cahaya LED secara real-time.',
      'Memasang beberapa resistor secara seri akan menjumlahkan total hambatannya (R_total = R1 + R2).',
    ],
    howItWorksEn: [
      'Click any resistor on the canvas to adjust resistance via direct Ohm input, quick value buttons (47Ω – 1MΩ), or interactive 4-band color swatches.',
      'When wired in series with an LED (Anode or Cathode side), changing resistance immediately updates current (mA) and visible LED brightness.',
      'Multiple resistors in series automatically sum their total resistance (R_total = R1 + R2).',
    ],
    pins: [
      { pin: 'P1 / 1', name: 'Terminal 1', descId: 'Kaki pertama resistor (non-polar)', descEn: 'First terminal (non-polarized)' },
      { pin: 'P2 / 2', name: 'Terminal 2', descId: 'Kaki kedua resistor (non-polar)', descEn: 'Second terminal (non-polarized)' },
    ],
    attrs: [
      { attr: 'value', defaultVal: '"220"', descId: 'Nilai hambatan dalam Ohm (mis. "220", "1000", "10000")', descEn: 'Resistance in Ohms (e.g., "220", "1000", "10000")' },
    ],
  },
  {
    id: 'part-breadboard',
    category: 'parts-basic',
    wokwiType: 'wokwi-breadboard',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-breadboard',
    titleId: 'Breadboard (Mini 170 / Half 400 / Full 830)',
    titleEn: 'Breadboard (Mini 170 / Half 400 / Full 830)',
    badge: 'Passive Bus',
    summaryId:
      'Papan proyek tanpa solder dengan jalur terminal vertikal 5 lubang dan rel daya horizontal merah (+) & biru (−).',
    summaryEn:
      'Solderless prototyping board with 5-hole vertical terminal strips and horizontal red (+) & blue (−) power rails.',
    howItWorksId: [
      'Setiap kolom pada baris `a–e` saling terhubung secara internal, demikian pula `f–j` di bawah parit tengah (DIP trench). Baris `a–e` terpisah secara elektris dari `f–j`.',
      'Pada Breadboard Half (400-pt) dan Full (830-pt), rel daya atas dan bawah menghubungkan semua lubang di garis `+` (merah) dan garis `−` (biru) secara horizontal.',
    ],
    howItWorksEn: [
      'Each column in rows `a–e` is internally connected, and rows `f–j` form a separate 5-hole strip across the center trench.',
      'Half (400-pt) and Full (830-pt) breadboards include horizontal top and bottom `+` (red) and `−` (blue) power rails.',
    ],
  },

  // ===================== PARTS: INPUT DEVICES =====================
  {
    id: 'part-pushbutton',
    category: 'parts-inputs',
    wokwiType: 'wokwi-pushbutton',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-pushbutton',
    titleId: 'Pushbutton (Tombol Taktil)',
    titleEn: 'Pushbutton (Tactile Switch)',
    badge: 'wokwi-pushbutton',
    summaryId:
      'Sakelar tekan sesaat (momentary) dengan opsi kunci tahan (LOCK) dan pintasan keyboard. Menghubungkan kontak secara fisik saat ditekan.',
    summaryEn:
      'Momentary tactile switch with optional latch lock and keyboard shortcut. Physically closes contacts when pressed.',
    howItWorksId: [
      'Mode aktif-LOW standar Arduino: hubungkan `OUT` ke pin GPIO dengan `pinMode(pin, INPUT_PULLUP)` dan `GND` ke GND board. Saat ditekan `digitalRead()` bernilai `LOW (0)`, saat dilepas `HIGH (1)`.',
      'Mode aktif-HIGH / rangkaian langsung: hubungkan satu kaki ke `3V3`/`5V` dan kaki lain ke resistor+LED atau pin GPIO — arus mengalir langsung saat tombol ditekan.',
      'Klik sudut kecil kanan atas tombol di kanvas untuk mengaktifkan mode `LOCK` (tahan otomatis tanpa perlu menahan mouse).',
    ],
    howItWorksEn: [
      'Standard active-LOW Arduino wiring: connect `OUT` to a GPIO with `pinMode(pin, INPUT_PULLUP)` and `GND` to ground. Pressed reads `LOW (0)`, released reads `HIGH (1)`.',
      'Active-HIGH / direct hardware switch: wire one side to `3V3`/`5V` and the other to a resistor+LED or GPIO — conducts physically when pressed.',
      'Click the mini latch corner on the button to toggle `LOCK` hands-free hold.',
    ],
    pins: [
      { pin: 'OUT', name: 'Signal / 1', descId: 'Terminal sakelar 1 (hubungkan ke GPIO atau beban)', descEn: 'Switch terminal 1 (connect to GPIO or load)' },
      { pin: 'GND', name: 'Ground / 2', descId: 'Terminal sakelar 2 (hubungkan ke GND atau VCC)', descEn: 'Switch terminal 2 (connect to GND or VCC)' },
    ],
    attrs: [
      { attr: 'color', defaultVal: '"red"', descId: 'Warna tutup tombol (red, green, blue, yellow, white, black, grey)', descEn: 'Cap color (red, green, blue, yellow, white, black, grey)' },
      { attr: 'bounce', defaultVal: 'true', descId: 'Simulasi contact bounce mekanis (set false untuk menonaktifkan)', descEn: 'Simulates mechanical contact bounce' },
      { attr: 'key', defaultVal: '""', descId: 'Tombol keyboard pintasan untuk menekan tombol saat simulasi', descEn: 'Keyboard shortcut key to press button during simulation' },
    ],
    codeSnippet: `#define BTN_PIN 4
#define LED_PIN 2

void setup() {
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  if (digitalRead(BTN_PIN) == LOW) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(80);
}`,
  },
  {
    id: 'part-slide-switch',
    category: 'parts-inputs',
    wokwiType: 'wokwi-slide-switch',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-slide-switch',
    titleId: 'Slide Switch (SPDT)',
    titleEn: 'Slide Switch (SPDT)',
    badge: 'wokwi-slide-switch',
    summaryId:
      'Sakelar geser 3-pin Single-Pole Double-Throw yang menghubungkan pin tengah `COM (2)` ke pin kiri `1` (posisi OFF) atau pin kanan `3` (posisi ON).',
    summaryEn:
      '3-pin Single-Pole Double-Throw slide switch routing center `COM (2)` to left terminal `1` (OFF) or right terminal `3` (ON).',
    howItWorksId: [
      'Klik sakelar langsung di kanvas untuk menggeser tuas antara posisi kiri (OFF) dan kanan (ON).',
      'Bekerja secara elektris baik untuk memilih jalur daya/beban maupun memberi sinyal HIGH/LOW ke pin `digitalRead()`.',
    ],
    howItWorksEn: [
      'Click the switch directly on the canvas to toggle between left (OFF) and right (ON).',
      'Conducts physically between `COM (2)` and `1` or `3`, supporting both load switching and GPIO `digitalRead()`.',
    ],
    pins: [
      { pin: '1', name: 'Left / VCC', descId: 'Terhubung ke COM saat tuas di kiri (OFF)', descEn: 'Connected to COM when handle is left (OFF)' },
      { pin: '2', name: 'COM', descId: 'Pin tengah (Common)', descEn: 'Center Common pin' },
      { pin: '3', name: 'Right / GND', descId: 'Terhubung ke COM saat tuas di kanan (ON)', descEn: 'Connected to COM when handle is right (ON)' },
    ],
  },
  {
    id: 'part-potentiometer',
    category: 'parts-inputs',
    wokwiType: 'wokwi-potentiometer',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-potentiometer',
    titleId: 'Potentiometer & Slide Potentiometer',
    titleEn: 'Potentiometer & Slide Potentiometer',
    badge: '10kΩ Analog',
    summaryId:
      'Resistor variabel 10 kΩ (putar atau geser) untuk menghasilkan tegangan analog yang dibaca oleh pin ADC (`analogRead`) atau meredupkan LED secara langsung.',
    summaryEn:
      '10 kΩ rotary or linear variable resistor providing analog voltage for `analogRead()` or direct inline LED dimming.',
    howItWorksId: [
      'Hubungkan `VCC` ke 3V3/5V, `GND` ke GND, dan `SIG` (wiper) ke pin ADC mikrokontroler.',
      'Seret kenop atau slider di kanvas (0%–100%) untuk mengubah nilai `analogRead()` (0–4095 di ESP32/Pico, 0–1023 di Arduino Uno/Mega).',
      'Dapat juga dipasang sebagai rheostat seri (`VCC`/`SIG`) ke LED untuk melihat dimming analog langsung tanpa kode PWM.',
    ],
    howItWorksEn: [
      'Wire `VCC` to 3V3/5V, `GND` to ground, and `SIG` (wiper) to an ADC pin.',
      'Drag the knob or slider (0%–100%) to vary `analogRead()` (0–4095 on ESP32/Pico, 0–1023 on Arduino Uno/Mega).',
      'Can also act as an inline series rheostat (`VCC`↔`SIG`) to dim an LED directly.',
    ],
    pins: [
      { pin: 'VCC', name: 'Supply', descId: 'Ujung atas resistor 10kΩ (hubungkan ke 3V3 / 5V)', descEn: 'Top terminal of 10kΩ track (3V3 / 5V)' },
      { pin: 'SIG', name: 'Wiper / Output', descId: 'Keluaran sinyal analog ke pin ADC', descEn: 'Analog wiper output to ADC pin' },
      { pin: 'GND', name: 'Ground', descId: 'Ujung bawah resistor 10kΩ (hubungkan ke GND)', descEn: 'Bottom terminal of 10kΩ track (GND)' },
    ],
    codeSnippet: `void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
}
void loop() {
  int raw = analogRead(4);
  int pwm = map(raw, 0, 4095, 0, 255);
  analogWrite(2, pwm);
  Serial.println("Pot: " + String(raw) + " PWM: " + String(pwm));
  delay(150);
}`,
  },
  {
    id: 'part-inputs-extra',
    category: 'parts-inputs',
    wokwiType: 'wokwi-analog-joystick',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-analog-joystick',
    titleId: 'Joystick, Keypad 4×4, Rotary Encoder, DIP Switch & IR',
    titleEn: 'Joystick, 4×4 Keypad, Rotary Encoder, DIP Switch & IR',
    badge: 'Multi-Input',
    summaryId:
      'Kumpulan perangkat masukan lanjutan untuk kendali 2-sumbu, masukan PIN, navigasi menu, konfigurasi biner, dan kendali jarak jauh inframerah.',
    summaryEn:
      'Advanced input modules for 2-axis analog control, PIN entry, rotary menu navigation, binary DIP settings, and NEC infrared remote control.',
    howItWorksId: [
      'Analog Joystick (`HORZ`, `VERT`, `SEL`): geser stik pada kanvas; pin `HORZ` membaca sumbu X dan `VERT` membaca sumbu Y secara terpisah lewat `analogRead()`.',
      'Keypad 4×4 (`keypad.getKey()`): klik tombol `0–9`, `A–D`, `*`, `#` di kanvas untuk mengirim karakter tombol terbaru ke firmware.',
      'Rotary Encoder KY-040: gunakan tombol putar ↺ / ↻ dan tombol tekan `SW` (`digitalRead`).',
      'DIP Switch 8: klik masing-masing tuas bit untuk mengubah status `IN1`–`IN3` secara independen.',
      'IR Remote + IR Receiver: klik tombol remote untuk mengirim kode hex NEC 38kHz.',
    ],
    howItWorksEn: [
      'Analog Joystick (`HORZ`, `VERT`, `SEL`): drag stick on canvas; `HORZ` reads X axis and `VERT` reads Y axis separately via `analogRead()`.',
      '4×4 Keypad (`keypad.getKey()`): press keys `0–9`, `A–D`, `*`, `#` on canvas to stream keystrokes to firmware.',
      'KY-040 Rotary Encoder: use ↺ / ↻ step buttons and `SW` press (`digitalRead`).',
      '8-Way DIP Switch: toggle individual switches to drive `IN1`–`IN3` bits.',
      'IR Remote + IR Receiver: click remote keys to transmit 38kHz NEC codes.',
    ],
  },

  // ===================== PARTS: SENSORS =====================
  {
    id: 'part-dht22',
    category: 'parts-sensors',
    wokwiType: 'wokwi-dht22',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-dht22',
    titleId: 'DHT22 (Sensor Suhu & Kelembapan)',
    titleEn: 'DHT22 (Temperature & Humidity Sensor)',
    badge: 'wokwi-dht22',
    summaryId:
      'Sensor digital presisi untuk mengukur suhu lingkungan (0–55°C) dan kelembapan relatif (10–95% RH) melalui satu pin data.',
    summaryEn:
      'Digital environmental sensor measuring ambient temperature (0–55°C) and relative humidity (10–95% RH) over a single data pin.',
    howItWorksId: [
      'Sambungkan `VCC` ke 3V3/5V, `DATA (SDA)` ke pin GPIO, dan `GND` ke GND.',
      'Geser dua slider langsung pada badan sensor DHT22 di kanvas untuk mengubah suhu (°C) dan kelembapan (%) saat simulasi berjalan.',
      'Baca nilainya di sketch menggunakan `dht.readTemperature()` dan `dht.readHumidity()`.',
    ],
    howItWorksEn: [
      'Connect `VCC` to 3V3/5V, `DATA (SDA)` to a GPIO pin, and `GND` to ground.',
      'Drag the two sliders directly on the DHT22 body on canvas to vary temperature (°C) and humidity (%) live.',
      'Read values in code using `dht.readTemperature()` and `dht.readHumidity()`.',
    ],
    pins: [
      { pin: 'VCC', name: 'Supply', descId: 'Catu daya 3.3V–5V', descEn: '3.3V–5V supply' },
      { pin: 'DATA', name: 'SDA', descId: 'Pin data digital ke GPIO', descEn: 'Digital data pin to GPIO' },
      { pin: 'GND', name: 'Ground', descId: 'Ground referensi', descEn: 'Reference ground' },
    ],
    codeSnippet: `#include <DHT.h>

void setup() {
  Serial.begin(115200);
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  Serial.println("Temp: " + String(t) + " Hum: " + String(h));
  delay(1000);
}`,
  },
  {
    id: 'part-hcsr04',
    category: 'parts-sensors',
    wokwiType: 'wokwi-hc-sr04',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-hc-sr04',
    titleId: 'HC-SR04 (Sensor Jarak Ultrasonik)',
    titleEn: 'HC-SR04 (Ultrasonic Distance Sensor)',
    badge: 'wokwi-hc-sr04',
    summaryId:
      'Sensor jarak ultrasonik 2–400 cm yang menggunakan pin `TRIG` dan `ECHO` untuk mengukur jarak objek.',
    summaryEn:
      'Ultrasonic ranging sensor (2–400 cm) using `TRIG` and `ECHO` pins to measure distance to an object.',
    howItWorksId: [
      'Sambungkan `VCC` (5V/3.3V), `TRIG` ke GPIO output, `ECHO` ke GPIO input, dan `GND` ke GND.',
      'Geser slider jarak (cm) pada modul HC-SR04 di kanvas untuk menyimulasikan objek mendekat atau menjauh.',
      'Gunakan fungsi helper `ultrasonicRead(TRIG_PIN)` pada sketch untuk memperoleh jarak dalam sentimeter secara langsung.',
    ],
    howItWorksEn: [
      'Connect `VCC`, `TRIG` to a GPIO pin, `ECHO` to a GPIO pin, and `GND` to ground.',
      'Slide the distance control (cm) on the HC-SR04 part to move the simulated obstacle.',
      'Call `ultrasonicRead(TRIG_PIN)` in your sketch to retrieve distance in centimeters.',
    ],
    pins: [
      { pin: 'VCC', name: 'Supply', descId: 'Catu daya 5V (atau 3.3V)', descEn: '5V (or 3.3V) supply' },
      { pin: 'TRIG', name: 'Trigger', descId: 'Pin pemicu pulsa ultrasonik', descEn: 'Ultrasonic pulse trigger pin' },
      { pin: 'ECHO', name: 'Echo', descId: 'Pin pantulan gema', descEn: 'Echo return pulse pin' },
      { pin: 'GND', name: 'Ground', descId: 'Ground', descEn: 'Ground' },
    ],
    codeSnippet: `#define TRIG_PIN 5

void setup() {
  Serial.begin(115200);
}

void loop() {
  int cm = ultrasonicRead(TRIG_PIN);
  Serial.println("Dist: " + String(cm));
  delay(400);
}`,
  },
  {
    id: 'part-sensors-other',
    category: 'parts-sensors',
    wokwiType: 'wokwi-photoresistor-sensor',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-photoresistor-sensor',
    titleId: 'LDR, PIR, MQ2 Gas, NTC, MPU6050, BMP180, HX711, RFID & RTC',
    titleEn: 'LDR, PIR, MQ2 Gas, NTC, MPU6050, BMP180, HX711, RFID & RTC',
    badge: '10 Sensors',
    summaryId:
      'Referensi cepat sensor cahaya, gerak, gas, suhu analog, IMU 6-sumbu, barometer, timbangan load cell, RFID RC522, dan jam RTC DS1307.',
    summaryEn:
      'Quick reference for light, motion, gas, analog temperature, 6-axis IMU, barometer, load cell scale, RFID RC522, and DS1307 real-time clock.',
    howItWorksId: [
      'Photoresistor LDR (`wokwi-photoresistor-sensor`): slider Lux (50–1000 lx) dihitung memakai kurva gamma Wokwi (`RL10`, `gamma`) pada `analogRead()`.',
      'PIR Motion Sensor (`wokwi-pir-motion-sensor`): klik tombol `PICU PIR` di kanvas untuk mengubah `OUT` menjadi HIGH (`digitalRead() == 1`).',
      'MQ2 Gas Sensor (`wokwi-gas-sensor`): slider PPM (50–2500 ppm) terbaca analog di pin `AO` dan digital ambang batas (≥ 600 ppm) di pin `DO`.',
      'NTC Thermistor (`wokwi-ntc-temperature-sensor`): slider suhu (-10..85°C) menggunakan persamaan Beta (`BETA = 3950`) pada `analogRead()`.',
      'MPU6050 (`mpu.readTilt()`), BMP180 (`bmp.readPressure()`), HX711 (`hx711.readKg()`), DS1307 (`rtc.readTime()`), dan RFID RC522 (tombol Tap RFID) dapat dikendalikan langsung dari kanvas/inspector.',
    ],
    howItWorksEn: [
      'LDR Photoresistor (`wokwi-photoresistor-sensor`): Lux slider (50–1000 lx) follows the Wokwi gamma curve (`RL10`, `gamma`) on `analogRead()`.',
      'PIR Motion Sensor (`wokwi-pir-motion-sensor`): click the canvas trigger button to drive `OUT` HIGH (`digitalRead() == 1`).',
      'MQ2 Gas Sensor (`wokwi-gas-sensor`): PPM slider (50–2500 ppm) outputs analog on `AO` and threshold digital (≥ 600 ppm) on `DO`.',
      'NTC Thermistor (`wokwi-ntc-temperature-sensor`): temperature slider (-10..85°C) uses the Wokwi Beta equation (`BETA = 3950`).',
      'MPU6050 (`mpu.readTilt()`), BMP180 (`bmp.readPressure()`), HX711 (`hx711.readKg()`), DS1307 (`rtc.readTime()`), and RFID RC522 (Tap RFID button) are all interactive on canvas.',
    ],
  },

  // ===================== PARTS: DISPLAYS =====================
  {
    id: 'part-lcd',
    category: 'parts-displays',
    wokwiType: 'wokwi-lcd1602',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-lcd1602',
    titleId: 'LCD 16×2 & LCD 20×4 (I2C)',
    titleEn: 'LCD 16×2 & LCD 20×4 (I2C)',
    badge: 'I2C 0x27',
    summaryId:
      'Layar karakter alfanumerik 16×2 dan 20×4 dengan antarmuka I2C (SDA/SCL), pilihan warna latar hijau/biru, dan kontrol kursor baris.',
    summaryEn:
      '16×2 and 20×4 alphanumeric character LCDs with I2C backpack (SDA/SCL), green/blue backlight options, and row cursor control.',
    howItWorksId: [
      'Sambungkan `VCC`, `GND`, `SDA`, dan `SCL` ke pin I2C mikrokontroler.',
      'Gunakan `lcd.clear()`, `lcd.setCursor(col, row)`, dan `lcd.print("Teks")` untuk memperbarui isi layar secara langsung.',
      'Klik LCD di kanvas untuk mengganti warna backlight (`green` / `blue`) atau alamat I2C (`0x27`).',
    ],
    howItWorksEn: [
      'Wire `VCC`, `GND`, `SDA`, and `SCL` to the board I2C pins.',
      'Call `lcd.clear()`, `lcd.setCursor(col, row)`, and `lcd.print("Text")` to update screen rows live.',
      'Click the LCD to customize backlight color (`green` / `blue`) and I2C address (`0x27`).',
    ],
    pins: [
      { pin: 'GND', name: 'Ground', descId: 'Ground', descEn: 'Ground' },
      { pin: 'VCC', name: 'Supply', descId: 'Catu daya 5V / 3.3V', descEn: '5V / 3.3V supply' },
      { pin: 'SDA', name: 'I2C Data', descId: 'Pin SDA board (A4 di Uno, GPIO21 di ESP32)', descEn: 'Board SDA pin (A4 on Uno, GPIO21 on ESP32)' },
      { pin: 'SCL', name: 'I2C Clock', descId: 'Pin SCL board (A5 di Uno, GPIO22 di ESP32)', descEn: 'Board SCL pin (A5 on Uno, GPIO22 on ESP32)' },
    ],
    codeSnippet: `#include <LiquidCrystal_I2C.h>

void setup() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("IFA Lab Ready");
  lcd.setCursor(0, 1);
  lcd.print("Temp: 27.5 C");
}
void loop() { delay(500); }`,
  },
  {
    id: 'part-oled',
    category: 'parts-displays',
    wokwiType: 'board-ssd1306',
    wokwiUrl: 'https://docs.wokwi.com/parts/board-ssd1306',
    titleId: 'OLED SSD1306 (128×64 I2C)',
    titleEn: 'OLED SSD1306 (128×64 I2C)',
    badge: 'board-ssd1306',
    summaryId:
      'Layar grafis OLED monokrom 128×64 piksel berbasis kontroler SSD1306 dengan antarmuka I2C (alamat default 0x3C).',
    summaryEn:
      '128×64 monochrome OLED graphic display powered by SSD1306 over I2C (default address 0x3C).',
    howItWorksId: [
      'Inisialisasi dengan `oled.begin()`, bersihkan buffer dengan `oled.clear()`, tulis teks lewat `oled.println(...)` atau grafik batang `oled.progressBar(pct)`, lalu tampilkan dengan `oled.display()`.',
    ],
    howItWorksEn: [
      'Initialize with `oled.begin()`, clear with `oled.clear()`, draw lines via `oled.println(...)` or `oled.progressBar(pct)`, and flush with `oled.display()`.',
    ],
    pins: [
      { pin: 'GND', name: 'Ground', descId: 'Ground', descEn: 'Ground' },
      { pin: 'VCC', name: 'Supply', descId: '3.3V / 5V', descEn: '3.3V / 5V' },
      { pin: 'SCL', name: 'I2C Clock', descId: 'Garis clock I2C', descEn: 'I2C clock line' },
      { pin: 'SDA', name: 'I2C Data', descId: 'Garis data I2C', descEn: 'I2C data line' },
    ],
    codeSnippet: `void setup() {
  oled.begin();
}
void loop() {
  oled.clear();
  oled.println("ESP32 Monitor");
  oled.progressBar(75);
  oled.display();
  delay(500);
}`,
  },
  {
    id: 'part-displays-other',
    category: 'parts-displays',
    wokwiType: 'wokwi-neopixel',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-neopixel',
    titleId: '7-Segment, LED Bar Graph, MAX7219 Matrix & NeoPixel WS2812',
    titleEn: '7-Segment, LED Bar Graph, MAX7219 Matrix & NeoPixel WS2812',
    badge: 'Visual Outputs',
    summaryId:
      'Indikator numerik, level meter 10-segmen berbasis PWM/resistor, matriks LED 8×8 SPI, serta rangkaian RGB addressable WS2812.',
    summaryEn:
      'Numeric 7-segment indicators, PWM/resistor-responsive 10-segment bar graph, 8×8 SPI dot matrix, and addressable WS2812 NeoPixels.',
    howItWorksId: [
      '7-Segment & TM1637 4-Digit: tampilkan angka/teks lewat `sevenSeg.print("42")` atau `tm1637.showNumber(1234)`.',
      'LED Bar Graph (`wokwi-led-bar-graph`): jumlah segmen menyala mengikuti duty PWM dan nilai resistor seri pada pin `IN` + `GND`.',
      'MAX7219 8×8 Matrix: ubah pola visual dengan `matrix.setPattern("smile", frame)` (`tunnel`, `alert`, `smile`, `heart`).',
      'NeoPixel Ring / Strip / Single: hubungkan `5V`, `GND`, dan `DIN` untuk animasi RGB WS2812.',
    ],
    howItWorksEn: [
      '7-Segment & 4-Digit TM1637: print numbers/text via `sevenSeg.print("42")` or `tm1637.showNumber(1234)`.',
      'LED Bar Graph (`wokwi-led-bar-graph`): lit bar count tracks PWM duty and series resistance across `IN` and `GND`.',
      'MAX7219 8×8 Matrix: render patterns with `matrix.setPattern("smile", frame)` (`tunnel`, `alert`, `smile`, `heart`).',
      'NeoPixel Ring / Strip / Single: wire `5V`, `GND`, and `DIN` for addressable WS2812 RGB output.',
    ],
  },

  // ===================== PARTS: ACTUATORS & RELAYS =====================
  {
    id: 'part-servo',
    category: 'parts-actuators',
    wokwiType: 'wokwi-servo',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-servo',
    titleId: 'Servo Motor (SG90 0°–180°)',
    titleEn: 'Servo Motor (SG90 0°–180°)',
    badge: 'wokwi-servo',
    summaryId:
      'Motor servo mikro berputar presisi antara 0° hingga 180° dikendalikan melalui sinyal PWM (`Servo.attach()` dan `Servo.write()`).',
    summaryEn:
      'Micro servo motor rotating smoothly between 0° and 180° controlled via PWM (`Servo.attach()` and `Servo.write()`).',
    howItWorksId: [
      'Hubungkan pin `PWM` ke GPIO, `VCC` ke 5V/3.3V, dan `GND` ke GND.',
      'Panggil `myServo.attach(pin)` di `setup()`, lalu gerakkan sudutnya dengan `myServo.write(0..180)` di `loop()`.',
      'Klik servo di kanvas untuk mengganti bentuk horn (`single`, `double`, `cross`) dan warna horn sesuai spesifikasi Wokwi.',
    ],
    howItWorksEn: [
      'Connect `PWM` to a GPIO pin, `VCC` to 5V/3.3V, and `GND` to ground.',
      'Call `myServo.attach(pin)` in `setup()` and command angles via `myServo.write(0..180)` in `loop()`.',
      'Click the servo to customize horn style (`single`, `double`, `cross`) and horn color.',
    ],
    pins: [
      { pin: 'PWM', name: 'Signal', descId: 'Sinyal kendali PWM dari GPIO', descEn: 'PWM control signal from GPIO' },
      { pin: 'VCC', name: 'V+', descId: 'Catu daya 5V', descEn: '5V supply' },
      { pin: 'GND', name: 'Ground', descId: 'Ground', descEn: 'Ground' },
    ],
    codeSnippet: `#include <Servo.h>
Servo gate;

void setup() {
  gate.attach(2);
}
void loop() {
  gate.write(0);   delay(800);
  gate.write(90);  delay(800);
  gate.write(180); delay(800);
}`,
  },
  {
    id: 'part-buzzer',
    category: 'parts-actuators',
    wokwiType: 'wokwi-buzzer',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-buzzer',
    titleId: 'Piezo Buzzer (Audio tone)',
    titleEn: 'Piezo Buzzer (Audio tone)',
    badge: 'wokwi-buzzer',
    summaryId:
      'Buzzer piezoelektrik dengan keluaran suara Web Audio nyata dan indikator frekuensi visual untuk alarm maupun melodi.',
    summaryEn:
      'Piezoelectric buzzer with live Web Audio output and visual frequency ring for alarms and melodies.',
    howItWorksId: [
      'Hubungkan `POS (+)` ke pin GPIO dan `GND (−)` ke GND.',
      'Bunyikan nada dengan `tone(pin, frekuensiHz, durasiMs)` dan hentikan dengan `noTone(pin)`.',
      'Pastikan tombol Audio pada toolbar kanvas aktif agar suara buzzer terdengar di speaker perangkat Anda.',
    ],
    howItWorksEn: [
      'Connect `POS (+)` to a GPIO pin and `GND (−)` to ground.',
      'Generate tones with `tone(pin, freqHz, durationMs)` and stop with `noTone(pin)`.',
      'Keep the canvas Audio toggle enabled to hear live synthesized piezo tones.',
    ],
    pins: [
      { pin: 'POS (+)', name: 'Positive', descId: 'Masukan sinyal `tone()` / GPIO', descEn: '`tone()` / GPIO signal input' },
      { pin: 'GND (−)', name: 'Negative', descId: 'Hubungkan ke GND', descEn: 'Connect to GND' },
    ],
    codeSnippet: `#define BUZZ_PIN 7
void setup() { pinMode(BUZZ_PIN, OUTPUT); }
void loop() {
  tone(BUZZ_PIN, 1400, 250);
  delay(600);
  noTone(BUZZ_PIN);
}`,
  },
  {
    id: 'part-relay',
    category: 'parts-actuators',
    wokwiType: 'wokwi-relay-module',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-relay-module',
    titleId: 'Relay Module (5V · COM / NO / NC)',
    titleEn: 'Relay Module (5V · COM / NO / NC)',
    badge: 'wokwi-relay-module',
    summaryId:
      'Sakelar elektromagnetik yang memungkinkan sinyal logika rendah dari MCU memutus-sambung jalur beban terpisah lewat terminal `COM`, `NO`, dan `NC`.',
    summaryEn:
      'Electromagnetic relay allowing low-power MCU signals to switch separate load circuits across `COM`, `NO`, and `NC` contacts.',
    howItWorksId: [
      'Sisi kendali (bawah): sambungkan `VCC`, `GND`, dan `IN` ke GPIO output.',
      'Sisi beban (atas): saat relay OFF, `COM` tersambung ke `NC` (Normally Closed). Saat relay ON (`IN = HIGH` pada mode NPN), `COM` berpindah tersambung ke `NO` (Normally Open)!',
      'Coba rangkai: `5V → Relay COM`, `Relay NO → Resistor 220Ω → LED → GND` untuk menguji sakelar beban nyata lewat relay.',
    ],
    howItWorksEn: [
      'Control side (bottom): connect `VCC`, `GND`, and `IN` to a digital OUTPUT pin.',
      'Load side (top): when OFF, `COM` connects to `NC` (Normally Closed). When energized (`IN = HIGH` in NPN mode), `COM` switches to `NO` (Normally Open)!',
      'Try wiring `5V → Relay COM`, `Relay NO → 220Ω Resistor → LED → GND` to switch an actual LED load via the relay.',
    ],
    pins: [
      { pin: 'VCC', name: 'Coil VCC', descId: 'Catu daya modul relay', descEn: 'Relay module supply' },
      { pin: 'IN', name: 'Control Input', descId: 'Sinyal kontrol dari GPIO', descEn: 'GPIO control trigger' },
      { pin: 'GND', name: 'Ground', descId: 'Ground modul', descEn: 'Module ground' },
      { pin: 'NC', name: 'Normally Closed', descId: 'Terhubung ke COM saat relay mati (OFF)', descEn: 'Connected to COM when relay is OFF' },
      { pin: 'COM', name: 'Common', descId: 'Terminal umum sakelar beban', descEn: 'Common load contact' },
      { pin: 'NO', name: 'Normally Open', descId: 'Terhubung ke COM saat relay aktif (ON)', descEn: 'Connected to COM when relay is ON' },
    ],
    attrs: [
      { attr: 'transistor', defaultVal: '"npn"', descId: '"npn" (aktif-HIGH) atau "pnp" (aktif-LOW)', descEn: '"npn" (active-HIGH) or "pnp" (active-LOW)' },
    ],
  },
  {
    id: 'part-actuators-extra',
    category: 'parts-actuators',
    wokwiType: 'wokwi-stepper-motor',
    wokwiUrl: 'https://docs.wokwi.com/parts/wokwi-stepper-motor',
    titleId: 'Stepper Motor, Driver A4988, Shift Register 74HC595/165 & microSD',
    titleEn: 'Stepper Motor, A4988 Driver, 74HC595/165 Shift Registers & microSD',
    badge: 'Extended ICs',
    summaryId:
      'Komponen aktuator presisi dan ekspansi I/O digital untuk proyek mekatronika, penyimpanan data logger, dan perluasan pin GPIO.',
    summaryEn:
      'Precision motion actuators, GPIO expansion shift registers, and microSD storage modules for advanced embedded labs.',
    howItWorksId: [
      'Stepper Motor + Driver A4988: hubungkan STEP & DIR dari MCU ke A4988 dan koil A+/A-/B+/B- ke motor stepper.',
      '74HC595 (SIPO) & 74HC165 (PISO): memperluas 3 pin GPIO (DS/SHCP/STCP) menjadi 8 keluaran/masukan paralel.',
      'microSD Card Module: penyimpanan data logger SPI (`CS`, `SCK`, `MOSI`, `MISO`) untuk perekaman telemetri lokal.',
    ],
    howItWorksEn: [
      'Stepper Motor + A4988 Driver: wire STEP & DIR from MCU to A4988 and coils to the bipolar stepper.',
      '74HC595 (SIPO) & 74HC165 (PISO): expand 3 GPIO pins into 8 parallel outputs or inputs.',
      'microSD Card Module: SPI storage (`CS`, `SCK`, `MOSI`, `MISO`) for local telemetry logging.',
    ],
  },
]
