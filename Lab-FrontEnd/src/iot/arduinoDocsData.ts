export type DocCategoryId =
  | 'arduino-ide'
  | 'guides'
  | 'boards'
  | 'parts-basic'
  | 'parts-inputs'
  | 'parts-sensors'
  | 'parts-displays'
  | 'parts-actuators'

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
  partCode?: string
  refUrl: string
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
  { id: 'arduino-ide', titleId: 'Acuan Arduino IDE & Sintaks', titleEn: 'Arduino IDE & Syntax Reference' },
  { id: 'guides', titleId: 'Panduan & Fisika Rangkaian', titleEn: 'Circuit Physics & Guides' },
  { id: 'boards', titleId: 'Mikrokontroler (Boards)', titleEn: 'Microcontrollers (Boards)' },
  { id: 'parts-basic', titleId: 'Komponen Dasar & Pasif', titleEn: 'Basic & Passive Parts' },
  { id: 'parts-inputs', titleId: 'Perangkat Input', titleEn: 'Input Devices' },
  { id: 'parts-sensors', titleId: 'Sensor Lingkungan & Gerak', titleEn: 'Sensors' },
  { id: 'parts-displays', titleId: 'Layar & Indikator (Displays)', titleEn: 'Displays & LEDs' },
  { id: 'parts-actuators', titleId: 'Aktuator, Relay & IC', titleEn: 'Actuators, Relays & ICs' },
]

export const ARDUINO_IDE_DOCS_SECTIONS: DocSection[] = [
  // ===================== ARDUINO IDE & SYNTAX REFERENCE =====================
  {
    id: 'arduino-ide-overview',
    category: 'arduino-ide',
    refUrl: 'https://docs.arduino.cc/software/ide/',
    titleId: 'Pengenalan Arduino IDE & Alur Kerja Sketch',
    titleEn: 'Arduino IDE Overview & Sketch Workflow',
    badge: 'Arduino IDE 2',
    summaryId:
      'IoT Lab IFA mengacu pada lingkungan dan standar pemrograman Arduino IDE 2 (sketch .ino berbasis C/C++, Board Manager, Library Manager, Serial Monitor, dan Serial Plotter).',
    summaryEn:
      'IFA IoT Lab follows the Arduino IDE 2 programming model (.ino C/C++ sketches, Board selection, Library Manager, integrated Serial Monitor, and Serial Plotter).',
    howItWorksId: [
      'Program yang ditulis untuk mikrokontroler disebut **sketch** dengan file utama `Main.ino` (format standar Arduino IDE).',
      'Editor kode di IoT Lab dilengkapi **Autocomplete**, **Parameter Hints**, **Auto Formatter**, dan pemeriksa sintaks (`lintArduinoCpp`) layaknya Arduino IDE 2.',
      'Pilih papan mikrokontroler (Arduino Uno/Nano/Mega, ESP32, ESP32-C3, atau Raspberry Pi Pico/Pico W), susun rangkaian di kanvas, lalu tekan **Start Simulation** untuk memverifikasi dan menjalankan sketch.',
      'Gunakan panel **Serial Monitor** terintegrasi untuk log teks/input UART serta **Serial Plotter** untuk memantau grafik sinyal sensor secara real-time.',
    ],
    howItWorksEn: [
      'Programs written for microcontrollers are called **sketches**, anchored by `Main.ino` following the Arduino IDE convention.',
      'The code editor provides **Autocomplete**, **Parameter Hints**, **Auto Formatter**, and live syntax diagnostics modeled after Arduino IDE 2.',
      'Select your target board (Arduino Uno/Nano/Mega, ESP32, ESP32-C3, or Raspberry Pi Pico/Pico W), wire components on the canvas, and press **Start Simulation** to verify and run.',
      'Inspect live UART logs/commands in the integrated **Serial Monitor** and plot real-time sensor streams in the **Serial Plotter**.',
    ],
    table: {
      headersId: ['Fitur Arduino IDE 2', 'Padanan di IFA IoT Lab', 'Kegunaan'],
      headersEn: ['Arduino IDE 2 Feature', 'IFA IoT Lab Equivalent', 'Purpose'],
      rows: [
        ['Sketch (.ino) & Tabs', 'Editor Main.ino + tab .h / .cpp', 'Menulis firmware C/C++ modular dalam satu proyek'],
        ['Verify / Upload', 'Linter Sintaks + Start Simulation', 'Memeriksa tanda ; / kurung / deklarasi lalu menjalankan VM'],
        ['Board Selector', 'Pemilih Board (7 MCU)', 'Menentukan level tegangan (5V vs 3.3V), pinout, & resolusi ADC'],
        ['Library Manager', 'Tab Libraries', 'Menyisipkan header pustaka standar (#include <...>)'],
        ['Serial Monitor', 'Tab Terminal / Serial Monitor', 'Mencetak Serial.print/println dan mengirim input TX'],
        ['Serial Plotter', 'Tab Serial Plotter', 'Memvisualisasikan nilai numerik sensor sebagai grafik real-time'],
      ],
    },
  },
  {
    id: 'arduino-structure-syntax',
    category: 'arduino-ide',
    refUrl: 'https://docs.arduino.cc/language-reference/',
    titleId: 'Struktur Sketch, Sintaks & Kontrol Alur',
    titleEn: 'Sketch Structure, Syntax & Control Flow',
    badge: 'Structure',
    summaryId:
      'Setiap sketch Arduino IDE memiliki dua fungsi wajib yaitu `setup()` dan `loop()`, dilengkapi direktif praprosesor, aturan sintaks C++, percabangan, dan perulangan.',
    summaryEn:
      'Every Arduino IDE sketch requires `setup()` and `loop()`, combined with preprocessor directives, C++ syntax rules, conditionals, and loops.',
    howItWorksId: [
      '`void setup()` dipanggil **satu kali** saat mikrokontroler menyala atau di-reset: dipakai untuk `pinMode()`, `Serial.begin()`, dan inisialisasi library.',
      '`void loop()` dipanggil **berulang terus-menerus** setelah `setup()` selesai untuk membaca sensor, memproses logika, dan mengendalikan aktuator.',
      'Setiap pernyataan diakhiri titik koma `;`, blok kode dibungkus kurung kurawal `{ ... }`, komentar satu baris memakai `//`, dan komentar multi-baris memakai `/* ... */`.',
      'Direktif praprosesor `#include <Library.h>` menyertakan pustaka dan `#define NAMA nilai` mendefinisikan makro konstanta (tanpa titik koma di akhir baris).',
    ],
    howItWorksEn: [
      '`void setup()` runs **once** on boot or reset for `pinMode()`, `Serial.begin()`, and library initialization.',
      '`void loop()` runs **repeatedly** after `setup()` to read sensors, evaluate logic, and drive actuators.',
      'Statements end with `;`, blocks use `{ ... }`, single-line comments use `//`, and block comments use `/* ... */`.',
      'Preprocessor `#include <Library.h>` loads libraries and `#define NAME value` creates macro constants (no trailing semicolon).',
    ],
    table: {
      headersId: ['Elemen Sintaks', 'Bentuk Penulisan', 'Keterangan'],
      headersEn: ['Syntax Element', 'Form', 'Description'],
      rows: [
        ['Sketch Lifecycle', 'void setup() { ... } / void loop() { ... }', 'Dua fungsi inti wajib pada setiap sketch Arduino IDE'],
        ['Preprocessor', '#include <DHT.h> / #define LED_PIN 2', 'Menyertakan pustaka atau membuat konstanta makro pin'],
        ['Percabangan if', 'if (cond) { ... } else if (c2) { ... } else { ... }', 'Menjalankan blok kode berdasarkan kondisi boolean'],
        ['Percabangan switch', 'switch (mode) { case 1: ... break; default: ... }', 'Memilih satu dari beberapa cabang nilai diskrit'],
        ['Perulangan for', 'for (int i = 0; i < 10; i++) { ... }', 'Mengulang blok kode sejumlah iterasi tertentu'],
        ['Perulangan while', 'while (cond) { ... } / do { ... } while (cond);', 'Mengulang selama kondisi bernilai true'],
        ['Kontrol Lompatan', 'break; / continue; / return val;', 'Menghentikan loop, loncat iterasi, atau kembali dari fungsi'],
      ],
    },
    codeSnippet: `#define LED_PIN 2
#define BTN_PIN 4

int blinkCount = 0;

void toggleLed(bool on) {
  digitalWrite(LED_PIN, on ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BTN_PIN, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(BTN_PIN) == LOW) {
    for (int i = 0; i < 3; i++) {
      toggleLed(true);
      delay(150);
      toggleLed(false);
      delay(150);
    }
    blinkCount++;
    Serial.println("Pressed: " + String(blinkCount));
  }
  delay(80);
}`,
  },
  {
    id: 'arduino-variables-types',
    category: 'arduino-ide',
    refUrl: 'https://docs.arduino.cc/language-reference/',
    titleId: 'Tipe Data, Variabel, Konstanta & Operator',
    titleEn: 'Data Types, Variables, Constants & Operators',
    badge: 'Variables',
    summaryId:
      'Referensi tipe data standar Arduino C++, qualifier ruang lingkup, konstanta bawaan Arduino IDE, serta operator aritmetika, logika, dan bitwise.',
    summaryEn:
      'Reference for Arduino C++ data types, scope qualifiers, built-in Arduino IDE constants, and arithmetic, logical, and bitwise operators.',
    howItWorksId: [
      'Gunakan `const int` atau `#define` untuk nomor pin agar tidak berubah selama program berjalan.',
      'Gunakan `unsigned long` saat menyimpan nilai dari `millis()` atau `micros()` agar tidak cepat overflow.',
      'Konstanta logika pin: `HIGH` (3.3V/5V) dan `LOW` (0V/GND); mode pin: `INPUT`, `OUTPUT`, dan `INPUT_PULLUP` (resistor pull-up internal aktif, tombol ditekan terbaca `LOW`).',
      'Operator pembanding (`==`, `!=`, `<`, `<=`, `>`, `>=`) berbeda dengan penugasan (`=`). Gabungkan syarat dengan `&&` (AND), `||` (OR), dan `!` (NOT).',
    ],
    howItWorksEn: [
      'Use `const int` or `#define` for pin assignments so they remain read-only throughout execution.',
      'Always store `millis()` and `micros()` timestamps in `unsigned long` to prevent early overflow.',
      'Pin logic constants: `HIGH` (3.3V/5V) and `LOW` (0V/GND); pin modes: `INPUT`, `OUTPUT`, and `INPUT_PULLUP` (internal pull-up enabled; pressed reads `LOW`).',
      'Distinguish equality (`==`, `!=`) from assignment (`=`), and combine boolean conditions with `&&`, `||`, and `!`.',
    ],
    table: {
      headersId: ['Tipe / Kategori', 'Contoh', 'Rentang / Fungsi'],
      headersEn: ['Type / Category', 'Example', 'Range / Usage'],
      rows: [
        ['bool / boolean', 'bool ready = true;', 'Nilai kebenaran true atau false (1 byte)'],
        ['byte / uint8_t', 'uint8_t pwm = 255;', 'Bilangan bulat tak bertanda 0 s.d. 255 (8-bit)'],
        ['int', 'int temp = -5;', 'Bilangan bulat bertanda (16-bit AVR / 32-bit ESP32)'],
        ['unsigned long', 'unsigned long prevMs = 0;', 'Bilangan bulat positif 32-bit (wajib untuk millis())'],
        ['float / double', 'float celcius = 27.4;', 'Bilangan desimal untuk pembacaan sensor suhu/jarak'],
        ['char / String', 'String msg = "OK";', 'Karakter tunggal (\'A\') atau objek teks dinamis'],
        ['Array', 'int pins[3] = {2, 4, 5};', 'Kumpulan elemen bertipe sama dengan indeks mulai 0'],
        ['Qualifiers', 'const / static / volatile', 'Baca-saja, simpan antar panggilan, atau ubah lewat ISR'],
        ['Operator', '+ - * / % | == != < > | && || ! | & | ^ << >>', 'Aritmetika, perbandingan, logika boolean, & manipulasi bit'],
      ],
    },
    codeSnippet: `const uint8_t LED_PINS[3] = {2, 4, 5};
unsigned long lastTick = 0;
const unsigned long INTERVAL_MS = 500;
bool ledState = false;

void setup() {
  for (int i = 0; i < 3; i++) {
    pinMode(LED_PINS[i], OUTPUT);
  }
}

void loop() {
  if (millis() - lastTick >= INTERVAL_MS) {
    lastTick = millis();
    ledState = !ledState;
    digitalWrite(LED_PINS[0], ledState ? HIGH : LOW);
  }
  delay(20);
}`,
  },
  {
    id: 'arduino-io-time-math',
    category: 'arduino-ide',
    refUrl: 'https://docs.arduino.cc/language-reference/',
    titleId: 'Fungsi Digital I/O, Analog/PWM, Waktu & Matematika',
    titleEn: 'Digital I/O, Analog/PWM, Time & Math Functions',
    badge: 'Functions',
    summaryId:
      'Fungsi inti Arduino IDE yang didukung penuh di IoT Lab untuk kendali GPIO, pembacaan ADC, PWM, nada audio, pengukuran pulsa, timer, dan pemetaan skala.',
    summaryEn:
      'Core Arduino IDE functions supported in IFA IoT Lab for GPIO control, ADC reading, PWM output, audio tones, pulse measurement, timing, and math scaling.',
    howItWorksId: [
      'Digital I/O: panggil `pinMode(pin, mode)` di `setup()`, lalu gunakan `digitalWrite(pin, HIGH/LOW)` untuk menulis keluaran dan `digitalRead(pin)` untuk membaca masukan.',
      'Analog & PWM: `analogRead(pin)` mengembalikan `0–1023` (10-bit di Arduino Uno/Nano/Mega) atau `0–4095` (12-bit di ESP32/ESP32-C3/Pico); `analogWrite(pin, 0..255)` mengatur duty cycle PWM.',
      'Waktu: gunakan `delay(ms)` untuk jeda sederhana atau pola non-blocking dengan `millis()` agar tombol dan sensor tetap responsif.',
      'Matematika & Utilitas: gunakan `map(val, fromLow, fromHigh, toLow, toHigh)` untuk konversi rentang (mis. ADC ke sudut servo 0–180° atau PWM 0–255) dan `constrain(x, a, b)` untuk membatasi nilai.',
    ],
    howItWorksEn: [
      'Digital I/O: configure with `pinMode(pin, mode)` in `setup()`, then drive outputs with `digitalWrite(pin, HIGH/LOW)` and read inputs with `digitalRead(pin)`.',
      'Analog & PWM: `analogRead(pin)` returns `0–1023` (10-bit AVR) or `0–4095` (12-bit ESP32/Pico); `analogWrite(pin, 0..255)` outputs a PWM duty cycle.',
      'Timing: use `delay(ms)` for simple pauses or non-blocking `millis()` scheduling to keep buttons and sensors responsive.',
      'Math & Utilities: rescale values with `map(val, fromLow, fromHigh, toLow, toHigh)` (e.g., ADC to 0–180° servo or 0–255 PWM) and clamp with `constrain(x, a, b)`.',
    ],
    table: {
      headersId: ['Fungsi Arduino IDE', 'Parameter', 'Kegunaan'],
      headersEn: ['Arduino IDE Function', 'Parameters', 'Description'],
      rows: [
        ['pinMode()', '(pin, INPUT | OUTPUT | INPUT_PULLUP)', 'Mengatur arah dan mode pull-up internal pin GPIO'],
        ['digitalWrite()', '(pin, HIGH | LOW)', 'Mengirim sinyal logika HIGH (3.3V/5V) atau LOW (0V)'],
        ['digitalRead()', '(pin) -> int', 'Membaca logika pin digital (HIGH = 1, LOW = 0)'],
        ['analogRead()', '(pin) -> int', 'Membaca tegangan ADC (0–1023 AVR / 0–4095 ESP32 & Pico)'],
        ['analogWrite()', '(pin, value 0..255)', 'Menghasilkan sinyal PWM (dimming LED / level bar)'],
        ['tone() / noTone()', '(pin, freqHz[, ms]) / (pin)', 'Membunyikan dan menghentikan nada pada Piezo Buzzer'],
        ['pulseIn()', '(pin, HIGH | LOW[, timeout])', 'Mengukur lebar pulsa dalam mikrodetik (µs)'],
        ['shiftOut()', '(dataPin, clockPin, bitOrder, val)', 'Menggeser 8-bit data serial ke IC seperti 74HC595'],
        ['delay() / delayMicroseconds()', '(ms) / (us)', 'Menjeda eksekusi program dalam milidetik / mikrodetik'],
        ['millis() / micros()', '() -> unsigned long', 'Waktu berjalan sejak board aktif (untuk timer non-blocking)'],
        ['map() / constrain()', '(v, fL, fH, tL, tH) / (x, a, b)', 'Memetakan rentang skala nilai dan membatasi rentang [a, b]'],
      ],
    },
    codeSnippet: `const int POT_PIN = 4;
const int LED_PIN = 2;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int raw = analogRead(POT_PIN);
  int pwm = constrain(map(raw, 0, 4095, 0, 255), 0, 255);
  analogWrite(LED_PIN, pwm);
  Serial.println("ADC: " + String(raw) + " PWM: " + String(pwm));
  delay(150);
}`,
  },
  {
    id: 'arduino-serial-comms',
    category: 'arduino-ide',
    refUrl: 'https://docs.arduino.cc/software/ide-v2/tutorials/ide-v2-serial-monitor/',
    titleId: 'Serial Monitor, Serial Plotter & UART',
    titleEn: 'Serial Monitor, Serial Plotter & UART',
    badge: 'Serial API',
    summaryId:
      'Gunakan objek `Serial` standar Arduino IDE untuk mencetak log debug, menerima perintah interaktif melalui UART, dan memvisualisasikan grafik sensor real-time di Serial Plotter.',
    summaryEn:
      'Use the standard Arduino IDE `Serial` interface to print debug logs, receive interactive UART commands, and graph real-time telemetry in the Serial Plotter.',
    howItWorksId: [
      'Inisialisasi port serial di `setup()` dengan `Serial.begin(115200)` (ESP32/Pico) atau `Serial.begin(9600)` (Arduino Uno/Nano/Mega).',
      '`Serial.print(val)` mencetak tanpa pindah baris, sedangkan `Serial.println(val)` otomatis menambahkan baris baru (newline).',
      'Format pasangan label-nilai seperti `Serial.println("Temp: 28.4 Hum: 62")` otomatis dibaca oleh **Serial Plotter** menjadi kurva grafik multi-kanal.',
      'Cek masukan dari kotak input Serial Monitor dengan `if (Serial.available() > 0)` lalu baca teksnya dengan `Serial.readString()` atau 1 byte dengan `Serial.read()`.',
    ],
    howItWorksEn: [
      'Initialize UART in `setup()` via `Serial.begin(115200)` (ESP32/Pico) or `Serial.begin(9600)` (Arduino Uno/Nano/Mega).',
      '`Serial.print(val)` writes inline while `Serial.println(val)` appends a newline.',
      'Printing `Label: value` pairs (e.g., `Serial.println("Temp: 28.4 Hum: 62")`) feeds multi-series waveforms directly to the **Serial Plotter**.',
      'Poll incoming user commands with `if (Serial.available() > 0)` and consume input via `Serial.readString()` or `Serial.read()`.',
    ],
    table: {
      headersId: ['Method Serial', 'Kegunaan'],
      headersEn: ['Serial Method', 'Purpose'],
      rows: [
        ['Serial.begin(baud)', 'Mengaktifkan UART pada baud rate 9600 atau 115200'],
        ['Serial.print(data)', 'Mencetak teks/angka ke Serial Monitor tanpa newline'],
        ['Serial.println(data)', 'Mencetak teks/angka diikuti newline (tampil per baris & di Plotter)'],
        ['Serial.available()', 'Mengembalikan jumlah byte pesan yang menunggu di buffer RX'],
        ['Serial.readString() / read()', 'Membaca seluruh teks atau 1 karakter dari input Serial Monitor'],
      ],
    },
    codeSnippet: `void setup() {
  Serial.begin(115200);
  Serial.println("Arduino IDE Serial Ready");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readString();
    Serial.println("Echo: " + cmd);
  }
  int adc = analogRead(34);
  Serial.println("ADC: " + String(adc));
  delay(500);
}`,
  },
  {
    id: 'arduino-libraries-files',
    category: 'arduino-ide',
    refUrl: 'https://docs.arduino.cc/software/ide-v2/tutorials/installing-libraries/',
    titleId: 'Library Manager & Proyek Multi-File (.ino, .h, .cpp)',
    titleEn: 'Library Manager & Multi-File Sketches (.ino, .h, .cpp)',
    badge: 'Libraries',
    summaryId:
      'Cara menyertakan pustaka populer ekosistem Arduino IDE lewat `#include <...>` serta membagi kode ke beberapa tab file header `.h`, `.cpp`, dan aset web.',
    summaryEn:
      'Include popular Arduino IDE ecosystem libraries with `#include <...>` and organize larger sketches across `.h`, `.cpp`, and web asset tabs.',
    howItWorksId: [
      'Buka tab **Libraries** di panel editor untuk menelusuri dan menyisipkan `#include` pustaka standar Arduino IDE dan ESP32.',
      'Gunakan menu file di samping tab editor untuk membuat header lokal seperti `config.h` atau modul `sensors.cpp`, lalu panggil dengan `#include "config.h"`.',
      'Untuk proyek web IoT pada ESP32/Pico W, Anda juga dapat menambahkan tab `index.html`, `style.css`, atau `app.js` dengan placeholder dinamis seperti `{{TEMP}}`, `{{HUMIDITY}}`, dan `{{LED_STATE}}`.',
    ],
    howItWorksEn: [
      'Open the **Libraries** tab in the editor pane to search and insert standard Arduino IDE and ESP32 `#include` headers.',
      'Use the file menu to add local `.h` headers (e.g., `config.h`) or `.cpp` modules and include them with `#include "config.h"`.',
      'For ESP32/Pico W web projects, add `index.html`, `style.css`, or `app.js` tabs with live placeholders like `{{TEMP}}`, `{{HUMIDITY}}`, and `{{LED_STATE}}`.',
    ],
    table: {
      headersId: ['Header Library', 'Komponen / Fungsi'],
      headersEn: ['Library Header', 'Component / Purpose'],
      rows: [
        ['#include <Wire.h>', 'Komunikasi bus I2C (SDA/SCL) untuk LCD, OLED, sensor'],
        ['#include <Servo.h> / <ESP32Servo.h>', 'Kendali sudut Motor Servo SG90 (0°–180°) via PWM'],
        ['#include <DHT.h>', 'Pembacaan suhu & kelembapan sensor DHT22/DHT11'],
        ['#include <LiquidCrystal_I2C.h>', 'Tampilan karakter LCD 16×2 dan 20×4 melalui I2C'],
        ['#include <Adafruit_SSD1306.h>', 'Layar grafis OLED 128×64 SSD1306 I2C'],
        ['#include <Adafruit_NeoPixel.h>', 'Kontrol LED RGB addressable WS2812 / NeoPixel'],
        ['#include <WiFi.h> & <WebServer.h>', 'Koneksi Wi-Fi & HTTP WebServer lokal di ESP32/Pico W'],
        ['#include <PubSubClient.h>', 'Publikasi/langganan telemetri MQTT & MQTTS (TLS)'],
        ['#include <Keypad.h> / <MPU6050.h>', 'Keypad matriks 4×4 & sensor IMU 6-sumbu MPU6050'],
      ],
    },
  },

  // ===================== GUIDES & CIRCUIT PHYSICS =====================
  {
    id: 'circuit-physics',
    category: 'guides',
    refUrl: 'https://docs.arduino.cc/learn/electronics/ohms-law/',
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
    id: 'esp32-wifi',
    category: 'guides',
    refUrl: 'https://docs.arduino.cc/libraries/wifi/',
    titleId: 'Simulasi Wi-Fi ESP32, Web Server & MQTT TLS',
    titleEn: 'ESP32 Wi-Fi Simulation, Web Server & MQTT TLS',
    badge: 'Networking',
    summaryId:
      'ESP32, ESP32-C3, dan Raspberry Pi Pico W mendukung simulasi Wi-Fi, Web Server HTTP lokal yang dapat diuji lewat komponen Web Browser, serta publikasi telemetri MQTT/MQTTS.',
    summaryEn:
      'ESP32, ESP32-C3, and Raspberry Pi Pico W support virtual Wi-Fi, an HTTP Web Server testable via the canvas Web Browser part, and MQTT/MQTTS telemetry.',
    howItWorksId: [
      'Hubungkan ke jaringan Wi-Fi simulasi dengan `WiFi.begin("IFA-Lab-WiFi", "")` — board otomatis memperoleh alamat IP lokal virtual yang dapat dibaca lewat `WiFi.localIP()`.',
      'Daftarkan route HTTP menggunakan `server.on("/", handleRoot)` dan `server.begin()`, lalu tambahkan komponen `Web Browser` di kanvas atau buka tab Browser di Terminal untuk menguji endpoint `/`, `/api/sensors`, dan tombol kendali.',
      'Untuk keamanan IoT, gunakan protokol terenkripsi `mqtts://broker.weblab.local:8883` pada `mqtt.begin(...)` alih-alih `mqtt://` plaintext.',
    ],
    howItWorksEn: [
      'Connect to the simulated Wi-Fi AP via `WiFi.begin("IFA-Lab-WiFi", "")` — the board receives a virtual IP readable via `WiFi.localIP()`.',
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
  WiFi.begin("IFA-Lab-WiFi", "");
  server.on("/", handleRoot);
  server.begin();
}

void loop() {
  server.handleClient();
  delay(250);
}`,
  },
  {
    id: 'logic-analyzer',
    category: 'guides',
    refUrl: 'https://docs.arduino.cc/software/ide/',
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
    id: 'diagram-json',
    category: 'guides',
    refUrl: 'https://docs.arduino.cc/software/ide/',
    titleId: 'Pintasan Kanvas & Format diagram.json',
    titleEn: 'Canvas Shortcuts & diagram.json Schema',
    badge: 'Circuit Editor',
    summaryId:
      'Setiap rangkaian di IoT Simulator dapat disusun secara visual di kanvas maupun diedit langsung dalam format JSON (`diagram.json`) yang selalu sinkron dua arah.',
    summaryEn:
      'Every circuit in the IoT Simulator can be wired visually on the canvas or edited directly in bidirectional `diagram.json` schema format.',
    howItWorksId: [
      'Properti `parts` menyimpan daftar komponen (`type`, `id` unik, posisi `top` & `left`, sudut `rotate`, dan `attrs`).',
      'Properti `connections` menyimpan daftar kabel `[pinSumber, pinTujuan, warnaKabel, [waypoints]]`, misalnya `["esp:GPIO2", "r1:1", "green", ["v0"]]`.',
      'Gunakan pintasan keyboard di kanvas untuk mempercepat perakitan dan inspeksi rangkaian.',
    ],
    howItWorksEn: [
      'The `parts` array stores placed components (`type`, unique `id`, `top` & `left` coordinates, `rotate` angle, and `attrs`).',
      'The `connections` array holds wire tuples `[fromPin, toPin, wireColor, [waypoints]]`, e.g., `["esp:GPIO2", "r1:1", "green", ["v0"]]`.',
      'Use canvas keyboard shortcuts to speed up wiring and circuit layout.',
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

  // ===================== BOARDS =====================
  {
    id: 'boards-overview',
    category: 'boards',
    refUrl: 'https://docs.arduino.cc/hardware/',
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
    partCode: 'LED-5MM',
    refUrl: 'https://docs.arduino.cc/built-in-examples/basics/Blink/',
    titleId: 'LED (5mm Standard LED)',
    titleEn: 'LED (5mm Standard LED)',
    badge: 'Output Digital',
    summaryId:
      'Light-Emitting Diode 5mm standar. Kecerahan cahaya bergantung langsung pada sinyal digital/PWM serta nilai resistor pembatas arus seri (Hukum Ohm).',
    summaryEn:
      "Standard 5mm Light-Emitting Diode. Luminance scales continuously with digital/PWM duty cycle and series current-limiting resistance (Ohm's Law).",
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
    partCode: 'RGB-LED',
    refUrl: 'https://docs.arduino.cc/language-reference/en/functions/analog-io/analogWrite/',
    titleId: 'RGB LED (Common Cathode / Anode)',
    titleEn: 'RGB LED (Common Cathode / Anode)',
    badge: 'PWM RGB',
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
    partCode: 'RES-4BAND',
    refUrl: 'https://docs.arduino.cc/learn/electronics/ohms-law/',
    titleId: 'Resistor (4 Gelang Warna)',
    titleEn: 'Resistor (4-Band Axial)',
    badge: 'Passive',
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
    partCode: 'BREADBOARD',
    refUrl: 'https://docs.arduino.cc/learn/electronics/breadboards/',
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
    partCode: 'BTN-TACTILE',
    refUrl: 'https://docs.arduino.cc/built-in-examples/digital/InputPullupSerial/',
    titleId: 'Pushbutton (Tombol Taktil)',
    titleEn: 'Pushbutton (Tactile Switch)',
    badge: 'Digital Input',
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
    partCode: 'SWITCH-SPDT',
    refUrl: 'https://docs.arduino.cc/language-reference/en/functions/digital-io/digitalread/',
    titleId: 'Slide Switch (SPDT)',
    titleEn: 'Slide Switch (SPDT)',
    badge: 'Switch',
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
    partCode: 'POT-10K',
    refUrl: 'https://docs.arduino.cc/built-in-examples/basics/AnalogReadSerial/',
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
    partCode: 'MULTI-INPUT',
    refUrl: 'https://docs.arduino.cc/language-reference/',
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
    partCode: 'DHT22',
    refUrl: 'https://docs.arduino.cc/libraries/dht-sensor-library/',
    titleId: 'DHT22 (Sensor Suhu & Kelembapan)',
    titleEn: 'DHT22 (Temperature & Humidity Sensor)',
    badge: 'DHT.h',
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
    partCode: 'HC-SR04',
    refUrl: 'https://docs.arduino.cc/language-reference/en/functions/advanced-io/pulseIn/',
    titleId: 'HC-SR04 (Sensor Jarak Ultrasonik)',
    titleEn: 'HC-SR04 (Ultrasonic Distance Sensor)',
    badge: 'Ultrasonic',
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
    partCode: 'SENSORS',
    refUrl: 'https://docs.arduino.cc/language-reference/en/functions/analog-io/analogRead/',
    titleId: 'LDR, PIR, MQ2 Gas, NTC, MPU6050, BMP180, HX711, RFID & RTC',
    titleEn: 'LDR, PIR, MQ2 Gas, NTC, MPU6050, BMP180, HX711, RFID & RTC',
    badge: '10 Sensors',
    summaryId:
      'Referensi cepat sensor cahaya, gerak, gas, suhu analog, IMU 6-sumbu, barometer, timbangan load cell, RFID RC522, dan jam RTC DS1307.',
    summaryEn:
      'Quick reference for light, motion, gas, analog temperature, 6-axis IMU, barometer, load cell scale, RFID RC522, and DS1307 real-time clock.',
    howItWorksId: [
      'Photoresistor LDR: slider Lux (50–1000 lx) dihitung memakai kurva resistansi gamma (`RL10`, `gamma`) pada `analogRead()`.',
      'PIR Motion Sensor: klik tombol `PICU PIR` di kanvas untuk mengubah `OUT` menjadi HIGH (`digitalRead() == 1`).',
      'MQ2 Gas Sensor: slider PPM (50–2500 ppm) terbaca analog di pin `AO` dan digital ambang batas (≥ 600 ppm) di pin `DO`.',
      'NTC Thermistor: slider suhu (-10..85°C) menggunakan persamaan Steinhart-Hart / Beta (`BETA = 3950`) pada `analogRead()`.',
      'MPU6050 (`mpu.readTilt()`), BMP180 (`bmp.readPressure()`), HX711 (`hx711.readKg()`), DS1307 (`rtc.readTime()`), dan RFID RC522 (tombol Tap RFID) dapat dikendalikan langsung dari kanvas/inspector.',
    ],
    howItWorksEn: [
      'LDR Photoresistor: Lux slider (50–1000 lx) follows the gamma resistance curve (`RL10`, `gamma`) on `analogRead()`.',
      'PIR Motion Sensor: click the canvas trigger button to drive `OUT` HIGH (`digitalRead() == 1`).',
      'MQ2 Gas Sensor: PPM slider (50–2500 ppm) outputs analog on `AO` and threshold digital (≥ 600 ppm) on `DO`.',
      'NTC Thermistor: temperature slider (-10..85°C) uses the Beta equation (`BETA = 3950`) on `analogRead()`.',
      'MPU6050 (`mpu.readTilt()`), BMP180 (`bmp.readPressure()`), HX711 (`hx711.readKg()`), DS1307 (`rtc.readTime()`), and RFID RC522 (Tap RFID button) are all interactive on canvas.',
    ],
  },

  // ===================== PARTS: DISPLAYS =====================
  {
    id: 'part-lcd',
    category: 'parts-displays',
    partCode: 'LCD-I2C',
    refUrl: 'https://docs.arduino.cc/libraries/liquidcrystal-i2c/',
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
    partCode: 'OLED-SSD1306',
    refUrl: 'https://docs.arduino.cc/libraries/adafruit-ssd1306/',
    titleId: 'OLED SSD1306 (128×64 I2C)',
    titleEn: 'OLED SSD1306 (128×64 I2C)',
    badge: 'I2C 0x3C',
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
    partCode: 'VISUAL-OUT',
    refUrl: 'https://docs.arduino.cc/libraries/adafruit-neopixel/',
    titleId: '7-Segment, LED Bar Graph, MAX7219 Matrix & NeoPixel WS2812',
    titleEn: '7-Segment, LED Bar Graph, MAX7219 Matrix & NeoPixel WS2812',
    badge: 'Visual Outputs',
    summaryId:
      'Indikator numerik, level meter 10-segmen berbasis PWM/resistor, matriks LED 8×8 SPI, serta rangkaian RGB addressable WS2812.',
    summaryEn:
      'Numeric 7-segment indicators, PWM/resistor-responsive 10-segment bar graph, 8×8 SPI dot matrix, and addressable WS2812 NeoPixels.',
    howItWorksId: [
      '7-Segment & TM1637 4-Digit: tampilkan angka/teks lewat `sevenSeg.print("42")` atau `tm1637.showNumber(1234)`.',
      'LED Bar Graph: jumlah segmen menyala mengikuti duty PWM dan nilai resistor seri pada pin `IN` + `GND`.',
      'MAX7219 8×8 Matrix: ubah pola visual dengan `matrix.setPattern("smile", frame)` (`tunnel`, `alert`, `smile`, `heart`).',
      'NeoPixel Ring / Strip / Single: hubungkan `5V`, `GND`, dan `DIN` untuk animasi RGB WS2812.',
    ],
    howItWorksEn: [
      '7-Segment & 4-Digit TM1637: print numbers/text via `sevenSeg.print("42")` or `tm1637.showNumber(1234)`.',
      'LED Bar Graph: lit bar count tracks PWM duty and series resistance across `IN` and `GND`.',
      'MAX7219 8×8 Matrix: render patterns with `matrix.setPattern("smile", frame)` (`tunnel`, `alert`, `smile`, `heart`).',
      'NeoPixel Ring / Strip / Single: wire `5V`, `GND`, and `DIN` for addressable WS2812 RGB output.',
    ],
  },

  // ===================== PARTS: ACTUATORS & RELAYS =====================
  {
    id: 'part-servo',
    category: 'parts-actuators',
    partCode: 'SERVO-SG90',
    refUrl: 'https://docs.arduino.cc/libraries/servo/',
    titleId: 'Servo Motor (SG90 0°–180°)',
    titleEn: 'Servo Motor (SG90 0°–180°)',
    badge: 'Servo.h',
    summaryId:
      'Motor servo mikro berputar presisi antara 0° hingga 180° dikendalikan melalui sinyal PWM (`Servo.attach()` dan `Servo.write()`).',
    summaryEn:
      'Micro servo motor rotating smoothly between 0° and 180° controlled via PWM (`Servo.attach()` and `Servo.write()`).',
    howItWorksId: [
      'Hubungkan pin `PWM` ke GPIO, `VCC` ke 5V/3.3V, dan `GND` ke GND.',
      'Panggil `myServo.attach(pin)` di `setup()`, lalu gerakkan sudutnya dengan `myServo.write(0..180)` di `loop()`.',
      'Klik servo di kanvas untuk mengganti bentuk horn (`single`, `double`, `cross`) dan warna horn.',
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
    partCode: 'BUZZER-PIEZO',
    refUrl: 'https://docs.arduino.cc/language-reference/en/functions/advanced-io/tone/',
    titleId: 'Piezo Buzzer (Audio tone)',
    titleEn: 'Piezo Buzzer (Audio tone)',
    badge: 'tone()',
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
    partCode: 'RELAY-5V',
    refUrl: 'https://docs.arduino.cc/language-reference/en/functions/digital-io/digitalwrite/',
    titleId: 'Relay Module (5V · COM / NO / NC)',
    titleEn: 'Relay Module (5V · COM / NO / NC)',
    badge: 'Relay Switch',
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
    partCode: 'EXTENDED-ICS',
    refUrl: 'https://docs.arduino.cc/libraries/stepper/',
    titleId: 'Stepper Motor, Driver A4988, Shift Register 74HC595/165 & microSD',
    titleEn: 'Stepper Motor, A4988 Driver, 74HC595/165 Shift Registers & microSD',
    badge: 'Extended ICs',
    summaryId:
      'Komponen aktuator presisi dan ekspansi I/O digital untuk proyek mekatronika, penyimpanan data logger, dan perluasan pin GPIO.',
    summaryEn:
      'Precision motion actuators, GPIO expansion shift registers, and microSD storage modules for advanced embedded labs.',
    howItWorksId: [
      'Stepper Motor + Driver A4988: hubungkan STEP & DIR dari MCU ke A4988 dan koil A+/A-/B+/B- ke motor stepper.',
      '74HC595 (SIPO) & 74HC165 (PISO): memperluas 3 pin GPIO (DS/SHCP/STCP) menjadi 8 keluaran/masukan paralel dengan `shiftOut()`.',
      'microSD Card Module: penyimpanan data logger SPI (`CS`, `SCK`, `MOSI`, `MISO`) untuk perekaman telemetri lokal.',
    ],
    howItWorksEn: [
      'Stepper Motor + A4988 Driver: wire STEP & DIR from MCU to A4988 and coils to the bipolar stepper.',
      '74HC595 (SIPO) & 74HC165 (PISO): expand 3 GPIO pins into 8 parallel outputs or inputs with `shiftOut()`.',
      'microSD Card Module: SPI storage (`CS`, `SCK`, `MOSI`, `MISO`) for local telemetry logging.',
    ],
  },
]
