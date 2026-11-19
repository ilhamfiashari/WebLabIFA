import type { IotMissionSpec, IotPresetTemplate } from './types'

export const IOT_PRESETS: IotPresetTemplate[] = [
  {
    id: 'esp32-c3-blink',
    missionId: 'iot-esp32-gpio',
    board: 'esp32-c3',
    titleId: 'Misi 1 · ESP32-C3 LED Blink & Resistor 220Ω',
    titleEn: 'Mission 1 · ESP32-C3 LED Blink & 220Ω Resistor',
    badge: 'ESP32-C3 · GPIO',
    summaryId: 'Kendali LED pada GPIO2 melalui resistor 220Ω dengan pemantauan Serial Monitor.',
    summaryEn: 'Control an LED on GPIO2 through a 220Ω resistor with Serial Monitor output.',
    code: `// ESP32-C3 Blink + Resistor Pengaman 220 Ohm
#define LED_PIN 2

int counter = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("ESP32-C3 GPIO Siap!");
}

void loop() {
  counter = counter + 1;
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED_STATE:1");
  delay(600);

  digitalWrite(LED_PIN, LOW);
  Serial.println("LED_STATE:0");
  delay(600);
}`,
    components: [
      {
        id: 'res-1',
        kind: 'resistor',
        x: 340,
        y: 205,
        label: 'R1 (220Ω)',
        ohms: 220,
        props: {},
      },
      {
        id: 'led-1',
        kind: 'led',
        x: 495,
        y: 165,
        label: 'LED Status',
        color: 'green',
        props: {},
      },
    ],
    wires: [
      { id: 'w-gpio2-res', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'res-1', pinId: 'P1' }, color: '#10b981' },
      { id: 'w-res-led', from: { nodeId: 'res-1', pinId: 'P2' }, to: { nodeId: 'led-1', pinId: 'A' }, color: '#f59e0b' },
      { id: 'w-led-gnd', from: { nodeId: 'led-1', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'esp32-c3-blank',
    board: 'esp32-c3',
    titleId: 'Blank Canvas · Proyek Baru Kosong',
    titleEn: 'Blank Canvas · Empty Project',
    badge: 'Blank Canvas · Bebas',
    summaryId: 'Mulai rangkaian dari kanvas kosong tanpa komponen awal untuk proyek mandiri atau multi-file.',
    summaryEn: 'Start wiring from an empty canvas with zero pre-placed parts for custom or multi-file projects.',
    code: `// Blank Canvas · Proyek IoT Baru
void setup() {
  Serial.begin(115200);
  Serial.println("Blank Canvas Siap!");
}

void loop() {
  delay(500);
}`,
    components: [],
    wires: [],
  },
  {
    id: 'esp32-c3-button',
    missionId: 'iot-esp32-button-pullup',
    board: 'esp32-c3',
    titleId: 'Misi 5 · Pushbutton Pull-Up & LED Interaktif',
    titleEn: 'Mission 5 · Pushbutton Pull-Up & Interactive LED',
    badge: 'ESP32-C3 · Input',
    summaryId: 'Klik tombol pada kanvas untuk menyalakan LED melalui GPIO4 dan GPIO2.',
    summaryEn: 'Press the tactile pushbutton on canvas to light the LED via GPIO4 and GPIO2.',
    code: `#define BTN_PIN 4
#define LED_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("Tekan Pushbutton di kanvas...");
}

void loop() {
  int btn = digitalRead(BTN_PIN);
  if (btn == LOW) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("Button: PRESSED -> LED ON");
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(200);
}`,
    components: [
      { id: 'btn-1', kind: 'pushbutton', x: 310, y: 265, label: 'Tombol A', props: { pressed: false } },
      { id: 'res-1', kind: 'resistor', x: 310, y: 160, label: 'R1 (220Ω)', ohms: 220, props: {} },
      { id: 'led-1', kind: 'led', x: 455, y: 125, label: 'LED Aksi', color: 'blue', props: {} },
    ],
    wires: [
      { id: 'w-1', from: { nodeId: 'board', pinId: 'GPIO4' }, to: { nodeId: 'btn-1', pinId: 'OUT' }, color: '#3b82f6' },
      { id: 'w-2', from: { nodeId: 'btn-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-3', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'res-1', pinId: 'P1' }, color: '#10b981' },
      { id: 'w-4', from: { nodeId: 'res-1', pinId: 'P2' }, to: { nodeId: 'led-1', pinId: 'A' }, color: '#f59e0b' },
      { id: 'w-5', from: { nodeId: 'led-1', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
    ],
  },
  {
    id: 'esp32-c3-ultrasonic',
    missionId: 'iot-esp32-ultrasonic',
    board: 'esp32-c3',
    titleId: 'Misi 2 · Sensor Jarak HC-SR04 + Buzzer + Servo',
    titleEn: 'Mission 2 · HC-SR04 Ultrasonic + Buzzer + Servo',
    badge: 'ESP32-C3 · Sensor & PWM',
    summaryId: 'Geser slider jarak HC-SR04 (< 25 cm) untuk membunyikan buzzer dan membuka servo 90°.',
    summaryEn: 'Slide HC-SR04 distance (< 25 cm) to sound the buzzer and rotate the servo to 90°.',
    code: `#include <ESP32Servo.h>
#define TRIG_PIN 5
#define ECHO_PIN 6
#define BUZZ_PIN 7
#define SERVO_PIN 2

Servo gateServo;

void setup() {
  Serial.begin(115200);
  pinMode(BUZZ_PIN, OUTPUT);
  gateServo.attach(SERVO_PIN);
  gateServo.write(0);
  Serial.println("HC-SR04 Ultrasonic Alert Ready");
}

void loop() {
  float cm = ultrasonicRead(TRIG_PIN, ECHO_PIN);
  Serial.println("distance_cm:" + String(cm));
  if (cm >= 2 && cm < 25) {
    tone(BUZZ_PIN, 1200);
    gateServo.write(90);
    Serial.println("ALERT: Objek dekat -> Gate 90 deg");
  } else {
    noTone(BUZZ_PIN);
    gateServo.write(0);
  }
  delay(350);
}`,
    components: [
      { id: 'ultra-1', kind: 'hc-sr04', x: 350, y: 100, label: 'HC-SR04', props: { distanceCm: 48 } },
      { id: 'servo-1', kind: 'servo', x: 525, y: 120, label: 'Gerbang SG90', props: {} },
      { id: 'buzz-1', kind: 'buzzer', x: 390, y: 270, label: 'Alarm Piezo', props: {} },
    ],
    wires: [
      { id: 'w-u-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'ultra-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-u-trig', from: { nodeId: 'board', pinId: 'GPIO5' }, to: { nodeId: 'ultra-1', pinId: 'TRIG' }, color: '#10b981' },
      { id: 'w-u-echo', from: { nodeId: 'board', pinId: 'GPIO6' }, to: { nodeId: 'ultra-1', pinId: 'ECHO' }, color: '#f59e0b' },
      { id: 'w-u-gnd', from: { nodeId: 'ultra-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'w-s-pwm', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'servo-1', pinId: 'PWM' }, color: '#3b82f6' },
      { id: 'w-s-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'servo-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-s-gnd', from: { nodeId: 'servo-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'w-b-pos', from: { nodeId: 'board', pinId: 'GPIO7' }, to: { nodeId: 'buzz-1', pinId: 'POS' }, color: '#8b5cf6' },
      { id: 'w-b-gnd', from: { nodeId: 'buzz-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'esp32-c3-dht-oled',
    missionId: 'iot-esp32-dht-oled',
    board: 'esp32-c3',
    titleId: 'Misi 3 · DHT22 + OLED SSD1306 & Serial Plotter',
    titleEn: 'Mission 3 · DHT22 + OLED SSD1306 & Serial Plotter',
    badge: 'ESP32-C3 · I2C Display',
    summaryId: 'Tampilkan pembacaan suhu & kelembapan DHT22 pada OLED 128x64 I2C dan Serial Plotter.',
    summaryEn: 'Render live DHT22 temperature & humidity to I2C 128x64 OLED and Serial Plotter.',
    code: `#include <DHT.h>
#include <Adafruit_SSD1306.h>
#define DHT_PIN 3

void setup() {
  Serial.begin(115200);
  oled.begin();
  Serial.println("DHT22 + OLED SSD1306 Started");
}

void loop() {
  float temp = dht.readTemperature(DHT_PIN);
  float hum = dht.readHumidity(DHT_PIN);
  Serial.println("temp:" + String(temp) + ",hum:" + String(hum));

  oled.clear();
  oled.setCursor(0, 0);
  oled.println("ESP32 ENV MONITOR");
  oled.println("Temp: " + String(temp) + " C");
  oled.println("Hum : " + String(hum) + " %");
  oled.println(temp > 34 ? "STATUS: PANAS" : "STATUS: NORMAL");
  oled.display();
  delay(450);
}`,
    components: [
      { id: 'dht-1', kind: 'dht22', x: 325, y: 110, label: 'DHT22 Sensor', props: { tempC: 28, humidity: 62 } },
      { id: 'oled-1', kind: 'oled-ssd1306', x: 475, y: 120, label: 'OLED 128×64', props: {} },
    ],
    wires: [
      { id: 'w-d-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'dht-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-d-dat', from: { nodeId: 'board', pinId: 'GPIO3' }, to: { nodeId: 'dht-1', pinId: 'DATA' }, color: '#10b981' },
      { id: 'w-d-gnd', from: { nodeId: 'dht-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-o-gnd', from: { nodeId: 'oled-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'w-o-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'oled-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-o-scl', from: { nodeId: 'board', pinId: 'GPIO9' }, to: { nodeId: 'oled-1', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'w-o-sda', from: { nodeId: 'board', pinId: 'GPIO8' }, to: { nodeId: 'oled-1', pinId: 'SDA' }, color: '#f59e0b' },
    ],
  },
  {
    id: 'esp32-c3-servo-pot',
    missionId: 'iot-esp32-adc-servo',
    board: 'esp32-c3',
    titleId: 'Misi 6 · Potensiometer ADC 12-bit → Servo PWM',
    titleEn: 'Mission 6 · 12-bit ADC Potentiometer → Servo PWM',
    badge: 'ESP32-C3 · ADC/PWM',
    summaryId: 'Putar potensiometer untuk membaca ADC 0..4095 dan menggerakkan sudut Servo 0..180°.',
    summaryEn: 'Rotate the potentiometer to read 0..4095 ADC and sweep the Servo from 0..180°.',
    code: `#include <ESP32Servo.h>
#define POT_PIN 0
#define SERVO_PIN 2

Servo arm;

void setup() {
  Serial.begin(115200);
  arm.attach(SERVO_PIN);
}

void loop() {
  int adc = analogRead(POT_PIN);
  int angle = map(adc, 0, 4095, 0, 180);
  arm.write(angle);
  Serial.println("adc:" + String(adc) + ",angle:" + String(angle));
  delay(250);
}`,
    components: [
      { id: 'pot-1', kind: 'potentiometer', x: 325, y: 125, label: 'Pot 10kΩ', props: { potPct: 45 } },
      { id: 'servo-1', kind: 'servo', x: 480, y: 125, label: 'Servo SG90', props: {} },
    ],
    wires: [
      { id: 'w-p-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'pot-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-p-sig', from: { nodeId: 'board', pinId: 'GPIO0' }, to: { nodeId: 'pot-1', pinId: 'SIG' }, color: '#8b5cf6' },
      { id: 'w-p-gnd', from: { nodeId: 'pot-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-s-pwm', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'servo-1', pinId: 'PWM' }, color: '#3b82f6' },
      { id: 'w-s-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'servo-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-s-gnd', from: { nodeId: 'servo-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'esp32-c3-mqtt-tls',
    missionId: 'iot-esp32-mqtt',
    board: 'esp32-c3',
    titleId: 'Misi 4 · ESP32-C3 Wi-Fi Telemetri & MQTT TLS',
    titleEn: 'Mission 4 · ESP32-C3 Wi-Fi Telemetry & MQTT TLS',
    badge: 'ESP32-C3 · Wi-Fi/MQTT',
    summaryId: 'Kirim pembacaan sensor cahaya LDR ke broker MQTT terenkripsi (mqtts://8883).',
    summaryEn: 'Publish LDR light sensor readings over encrypted MQTT TLS (mqtts://8883).',
    code: `#include <WiFi.h>
#define LDR_PIN 1
#define LED_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  WiFi.begin("WebLab-IoT", "itera-lab-2026");
  mqtt.begin("mqtts://broker.weblab.local:8883", true);
}

void loop() {
  int lightVal = analogRead(LDR_PIN);
  if (lightVal < 1500) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  Serial.println("lux_adc:" + String(lightVal));
  mqtt.publish("ifalab/esp32/light", "{\\"adc\\":" + String(lightVal) + "}");
  delay(550);
}`,
    components: [
      { id: 'ldr-1', kind: 'ldr', x: 320, y: 120, label: 'LDR Lux', props: { lux: 420 } },
      { id: 'res-1', kind: 'resistor', x: 325, y: 260, label: 'R1 (220Ω)', ohms: 220, props: {} },
      { id: 'led-1', kind: 'led', x: 475, y: 225, label: 'Lampu Auto', color: 'yellow', props: {} },
    ],
    wires: [
      { id: 'w-l-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'ldr-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-l-ao', from: { nodeId: 'board', pinId: 'GPIO1' }, to: { nodeId: 'ldr-1', pinId: 'AO' }, color: '#8b5cf6' },
      { id: 'w-l-gnd', from: { nodeId: 'ldr-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-r-p1', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'res-1', pinId: 'P1' }, color: '#10b981' },
      { id: 'w-r-p2', from: { nodeId: 'res-1', pinId: 'P2' }, to: { nodeId: 'led-1', pinId: 'A' }, color: '#f59e0b' },
      { id: 'w-led-k', from: { nodeId: 'led-1', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
    ],
  },
  {
    id: 'uno-blink',
    board: 'arduino-uno',
    titleId: 'Arduino Uno R3 · Lampu Lalu Lintas RGB',
    titleEn: 'Arduino Uno R3 · RGB Status Signal',
    badge: 'Arduino Uno · 5V',
    summaryId: 'Kontrol RGB LED 5V di Arduino Uno R3 lewat pin PWM D9, D10, dan D11.',
    summaryEn: 'Drive a 5V common-cathode RGB LED using PWM pins D9, D10, and D11 on Arduino Uno.',
    code: `void setup() {
  Serial.begin(9600);
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(11, OUTPUT);
}

void loop() {
  analogWrite(9, 255); analogWrite(10, 40); analogWrite(11, 0);
  Serial.println("Color: MERAH");
  delay(500);
  analogWrite(9, 0); analogWrite(10, 220); analogWrite(11, 90);
  Serial.println("Color: HIJAU");
  delay(500);
  analogWrite(9, 40); analogWrite(10, 120); analogWrite(11, 255);
  Serial.println("Color: BIRU");
  delay(500);
}`,
    components: [
      { id: 'res-1', kind: 'resistor', x: 325, y: 150, label: 'R1 (220Ω)', ohms: 220, props: {} },
      { id: 'rgb-1', kind: 'rgb-led', x: 465, y: 135, label: 'RGB LED', props: {} },
    ],
    wires: [
      { id: 'w-u1', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'res-1', pinId: 'P1' }, color: '#ef4444' },
      { id: 'w-u2', from: { nodeId: 'res-1', pinId: 'P2' }, to: { nodeId: 'rgb-1', pinId: 'R' }, color: '#ef4444' },
      { id: 'w-u3', from: { nodeId: 'board', pinId: 'D10' }, to: { nodeId: 'rgb-1', pinId: 'G' }, color: '#10b981' },
      { id: 'w-u4', from: { nodeId: 'board', pinId: 'D11' }, to: { nodeId: 'rgb-1', pinId: 'B' }, color: '#3b82f6' },
      { id: 'w-u5', from: { nodeId: 'rgb-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'pico-pir-lcd',
    board: 'pico-w',
    titleId: 'Raspberry Pi Pico W · PIR Motion + LCD 16×2',
    titleEn: 'Raspberry Pi Pico W · PIR Motion + LCD 16×2',
    badge: 'Pi Pico W · RP2040',
    summaryId: 'Deteksi gerakan sensor PIR di kanvas dan tampilkan statusnya pada LCD 16×2 I2C.',
    summaryEn: 'Trigger motion on the PIR sensor and show security alerts on the 16×2 I2C LCD.',
    code: `#define PIR_PIN 16
#define RELAY_PIN 15

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  lcd.setCursor(0, 0);
  lcd.print("Pico W Security");
}

void loop() {
  int m = digitalRead(PIR_PIN);
  lcd.setCursor(0, 1);
  if (m == HIGH) {
    digitalWrite(RELAY_PIN, HIGH);
    lcd.print("MOTION DETECTED!");
    Serial.println("PIR: MOTION=1");
  } else {
    digitalWrite(RELAY_PIN, LOW);
    lcd.print("Status: Aman    ");
    Serial.println("PIR: MOTION=0");
  }
  delay(350);
}`,
    components: [
      { id: 'pir-1', kind: 'pir', x: 325, y: 110, label: 'PIR Sensor', props: { motion: false } },
      { id: 'lcd-1', kind: 'lcd-1602', x: 465, y: 110, label: 'LCD 16×2', props: {} },
      { id: 'rel-1', kind: 'relay', x: 350, y: 255, label: 'Relay Pintu', props: {} },
    ],
    wires: [
      { id: 'w-pw1', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'pir-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-pw2', from: { nodeId: 'board', pinId: 'GP16' }, to: { nodeId: 'pir-1', pinId: 'OUT' }, color: '#f59e0b' },
      { id: 'w-pw3', from: { nodeId: 'pir-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'w-pw4', from: { nodeId: 'board', pinId: 'GP4' }, to: { nodeId: 'lcd-1', pinId: 'SDA' }, color: '#10b981' },
      { id: 'w-pw5', from: { nodeId: 'board', pinId: 'GP5' }, to: { nodeId: 'lcd-1', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'w-pw6', from: { nodeId: 'board', pinId: 'GP15' }, to: { nodeId: 'rel-1', pinId: 'IN' }, color: '#8b5cf6' },
    ],
  },
  {
    id: 'multi-mcu-bridge',
    board: 'esp32-c3',
    titleId: 'Multi-MCU · ESP32-C3 + Arduino Uno (Komunikasi 2 Board)',
    titleEn: 'Multi-MCU · ESP32-C3 + Arduino Uno (2-Board Link)',
    badge: 'Multi-MCU · 2 Boards',
    summaryId: 'Simulasi 2 mikrokontroler dalam 1 kanvas: ESP32-C3 mengirim sinyal GPIO2 ke D4 Arduino Uno untuk menyalakan LED node kedua.',
    summaryEn: 'Simulate 2 microcontrollers on one canvas: ESP32-C3 sends GPIO2 signal to Arduino Uno D4 to drive the secondary node LED.',
    code: `// MCU 1: ESP32-C3 (Sender / Master)
#define TX_SIG_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(TX_SIG_PIN, OUTPUT);
  Serial.println("Master ESP32-C3 Siap");
}

void loop() {
  digitalWrite(TX_SIG_PIN, HIGH);
  Serial.println("TX -> HIGH (Relay/Node Active)");
  delay(650);

  digitalWrite(TX_SIG_PIN, LOW);
  Serial.println("TX -> LOW");
  delay(650);
}`,
    components: [
      {
        id: 'mcu-2',
        kind: 'mcu',
        boardId: 'arduino-uno',
        x: 315,
        y: 76,
        label: 'Arduino Uno #2',
        props: {
          sketchCode: `// MCU 2: Arduino Uno (Receiver / Node)
#define RX_PIN 4
#define LED_NODE 8

void setup() {
  Serial.begin(115200);
  pinMode(RX_PIN, INPUT);
  pinMode(LED_NODE, OUTPUT);
  Serial.println("Node Arduino Uno Siap");
}

void loop() {
  int sig = digitalRead(RX_PIN);
  if (sig == HIGH) {
    digitalWrite(LED_NODE, HIGH);
    Serial.println("RX=HIGH -> LED Node ON");
  } else {
    digitalWrite(LED_NODE, LOW);
    Serial.println("RX=LOW -> LED Node OFF");
  }
  delay(650);
}`,
        },
      },
      { id: 'res-m1', kind: 'resistor', x: 560, y: 155, label: 'R1 (220Ω)', ohms: 220, props: {} },
      { id: 'led-m2', kind: 'led', x: 695, y: 118, label: 'LED Node #2', color: 'cyan', props: {} },
    ],
    wires: [
      { id: 'w-mcu-link', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'mcu-2', pinId: 'D4' }, color: '#10b981' },
      { id: 'w-mcu-gnd', from: { nodeId: 'board', pinId: 'GND1' }, to: { nodeId: 'mcu-2', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-uno-res', from: { nodeId: 'mcu-2', pinId: 'D8' }, to: { nodeId: 'res-m1', pinId: 'P1' }, color: '#3b82f6' },
      { id: 'w-res-led2', from: { nodeId: 'res-m1', pinId: 'P2' }, to: { nodeId: 'led-m2', pinId: 'A' }, color: '#f59e0b' },
      { id: 'w-led2-gnd', from: { nodeId: 'led-m2', pinId: 'K' }, to: { nodeId: 'mcu-2', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'esp32-c3-pir-alarm',
    missionId: 'iot-esp32-pir-alarm',
    board: 'esp32-c3',
    titleId: 'Misi 7 · Deteksi Gerak PIR + Buzzer & Relay Kunci',
    titleEn: 'Mission 7 · PIR Motion + Buzzer & Lock Relay',
    badge: 'ESP32-C3 · Keamanan Fisik',
    summaryId: 'Aktifkan sakelar gerak PIR untuk memicu alarm buzzer 1400Hz dan mengunci relay pengaman.',
    summaryEn: 'Trigger PIR motion sensor to sound the 1400Hz buzzer alarm and activate the lock relay.',
    code: `#define PIR_PIN 4
#define RELAY_PIN 5
#define BUZZ_PIN 7

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZ_PIN, OUTPUT);
  Serial.println("Sistem Keamanan PIR Siap");
}

void loop() {
  int motion = digitalRead(PIR_PIN);
  if (motion == HIGH) {
    digitalWrite(RELAY_PIN, HIGH);
    tone(BUZZ_PIN, 1400);
    Serial.println("INTRUDER_DETECTED: Relay ON + Buzzer 1400Hz");
  } else {
    digitalWrite(RELAY_PIN, LOW);
    noTone(BUZZ_PIN);
    Serial.println("AREA_AMAN");
  }
  delay(350);
}`,
    components: [
      { id: 'pir-1', kind: 'pir', x: 315, y: 105, label: 'Sensor PIR', props: { motion: true } },
      { id: 'relay-1', kind: 'relay', x: 470, y: 105, label: 'Relay Kunci', props: {} },
      { id: 'buzz-1', kind: 'buzzer', x: 390, y: 255, label: 'Siren Alarm', props: {} },
    ],
    wires: [
      { id: 'w-pir-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'pir-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-pir-out', from: { nodeId: 'board', pinId: 'GPIO4' }, to: { nodeId: 'pir-1', pinId: 'OUT' }, color: '#10b981' },
      { id: 'w-pir-gnd', from: { nodeId: 'pir-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-rel-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'relay-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-rel-in', from: { nodeId: 'board', pinId: 'GPIO5' }, to: { nodeId: 'relay-1', pinId: 'IN' }, color: '#3b82f6' },
      { id: 'w-rel-gnd', from: { nodeId: 'relay-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-buz-pos', from: { nodeId: 'board', pinId: 'GPIO7' }, to: { nodeId: 'buzz-1', pinId: 'POS' }, color: '#8b5cf6' },
      { id: 'w-buz-gnd', from: { nodeId: 'buzz-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'esp32-c3-lcd-access',
    missionId: 'iot-esp32-lcd-access',
    board: 'esp32-c3',
    titleId: 'Misi 8 · Panel Akses LCD 16x2 I2C & Indikator Status',
    titleEn: 'Mission 8 · I2C 16x2 LCD Access Panel & Indicator',
    badge: 'ESP32-C3 · LCD I2C',
    summaryId: 'Tampilkan status otorisasi pintu pada LCD 16x2 (SDA/SCL) dengan tombol verifikasi.',
    summaryEn: 'Display door access status on I2C 16x2 LCD (SDA/SCL) with tactile button control.',
    code: `#include <LiquidCrystal_I2C.h>
#define BTN_PIN 4
#define LED_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  lcd.init();
  lcd.backlight();
  Serial.println("Panel LCD I2C Aktif");
}

void loop() {
  int pressed = digitalRead(BTN_PIN) == LOW;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("IFA LAB ACCESS");
  lcd.setCursor(0, 1);
  if (pressed) {
    digitalWrite(LED_PIN, HIGH);
    lcd.print("STATUS: TERBUKA");
  } else {
    digitalWrite(LED_PIN, LOW);
    lcd.print("STATUS: TERKUNCI");
  }
  delay(350);
}`,
    components: [
      { id: 'lcd-1', kind: 'lcd-1602', x: 430, y: 95, label: 'LCD 16x2 I2C', props: {} },
      { id: 'btn-1', kind: 'pushbutton', x: 315, y: 245, label: 'Tombol Akses', props: { pressed: false } },
      { id: 'res-1', kind: 'resistor', x: 440, y: 245, label: 'R1 (220Ω)', ohms: 220, props: {} },
      { id: 'led-1', kind: 'led', x: 585, y: 215, label: 'LED Akses', color: 'green', props: {} },
    ],
    wires: [
      { id: 'w-lcd-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'lcd-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-lcd-gnd', from: { nodeId: 'lcd-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'w-lcd-sda', from: { nodeId: 'board', pinId: 'GPIO8' }, to: { nodeId: 'lcd-1', pinId: 'SDA' }, color: '#f59e0b' },
      { id: 'w-lcd-scl', from: { nodeId: 'board', pinId: 'GPIO9' }, to: { nodeId: 'lcd-1', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'w-btn-out', from: { nodeId: 'board', pinId: 'GPIO4' }, to: { nodeId: 'btn-1', pinId: 'OUT' }, color: '#10b981' },
      { id: 'w-btn-gnd', from: { nodeId: 'btn-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-r1', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'res-1', pinId: 'P1' }, color: '#10b981' },
      { id: 'w-r2', from: { nodeId: 'res-1', pinId: 'P2' }, to: { nodeId: 'led-1', pinId: 'A' }, color: '#f59e0b' },
      { id: 'w-lk', from: { nodeId: 'led-1', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'esp32-c3-gas-safety',
    missionId: 'iot-esp32-gas-safety',
    board: 'esp32-c3',
    titleId: 'Misi 9 · Sensor Gas MQ-2, Relay Ventilasi & Buzzer',
    titleEn: 'Mission 9 · MQ-2 Gas Sensor, Fan Relay & Buzzer',
    badge: 'ESP32-C3 · Safety IoT',
    summaryId: 'Baca kadar gas MQ-2 via ADC GPIO0 dan aktifkan Relay kipas serta Buzzer saat melewati ambang.',
    summaryEn: 'Read MQ-2 gas ADC via GPIO0 and trigger exhaust Relay and Buzzer above safe threshold.',
    code: `#define MQ2_PIN 0
#define RELAY_PIN 5
#define BUZZ_PIN 7

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZ_PIN, OUTPUT);
  Serial.println("MQ-2 Gas Monitor Ready");
}

void loop() {
  int gas = analogRead(MQ2_PIN);
  Serial.println("gas_adc:" + String(gas));
  if (gas > 1200) {
    digitalWrite(RELAY_PIN, HIGH);
    tone(BUZZ_PIN, 1800);
  } else {
    digitalWrite(RELAY_PIN, LOW);
    noTone(BUZZ_PIN);
  }
  delay(350);
}`,
    components: [
      { id: 'mq2-1', kind: 'mq2', x: 315, y: 105, label: 'MQ-2 Gas', props: { gasPpm: 900 } },
      { id: 'relay-1', kind: 'relay', x: 485, y: 115, label: 'Relay Exhaust', props: {} },
      { id: 'buzz-1', kind: 'buzzer', x: 410, y: 255, label: 'Buzzer Gas', props: {} },
    ],
    wires: [
      { id: 'w-m-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'mq2-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-m-gnd', from: { nodeId: 'mq2-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-m-ao', from: { nodeId: 'board', pinId: 'GPIO0' }, to: { nodeId: 'mq2-1', pinId: 'AO' }, color: '#8b5cf6' },
      { id: 'w-r-vcc', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'relay-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-r-in', from: { nodeId: 'board', pinId: 'GPIO5' }, to: { nodeId: 'relay-1', pinId: 'IN' }, color: '#10b981' },
      { id: 'w-r-gnd', from: { nodeId: 'relay-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-b-p', from: { nodeId: 'board', pinId: 'GPIO7' }, to: { nodeId: 'buzz-1', pinId: 'POS' }, color: '#f59e0b' },
      { id: 'w-b-g', from: { nodeId: 'buzz-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'esp32-c3-secure-telemetry',
    missionId: 'iot-esp32-secure-telemetry',
    board: 'esp32-c3',
    titleId: 'Misi 10 · Guard Suhu DHT22, Alarm & Telemetri TLS',
    titleEn: 'Mission 10 · DHT22 Thermal Guard, Alarm & TLS Telemetry',
    badge: 'ESP32-C3 · Secure Edge',
    summaryId: 'Gabungkan proteksi termal DHT22 + Buzzer dengan publikasi MQTT TLS tervalidasi.',
    summaryEn: 'Combine DHT22 thermal alert + Buzzer with validated MQTT TLS telemetry.',
    code: `#include <WiFi.h>
#include <DHT.h>
#define DHT_PIN 3
#define BUZZ_PIN 7

void setup() {
  Serial.begin(115200);
  pinMode(BUZZ_PIN, OUTPUT);
  WiFi.begin("WebLab-IoT", "itera-lab-2026");
  mqtt.begin("mqtts://broker.weblab.local:8883", true);
}

void loop() {
  float t = dht.readTemperature(DHT_PIN);
  if (t > 35) {
    tone(BUZZ_PIN, 1000);
  } else {
    noTone(BUZZ_PIN);
  }
  Serial.println("temp:" + String(t));
  mqtt.publish("ifalab/esp32/thermal", "{\\"temp\\":" + String(t) + "}");
  delay(500);
}`,
    components: [
      { id: 'dht-1', kind: 'dht22', x: 325, y: 110, label: 'DHT22 Thermal', props: { tempC: 37, humidity: 58 } },
      { id: 'buzz-1', kind: 'buzzer', x: 485, y: 125, label: 'Alarm Suhu', props: {} },
    ],
    wires: [
      { id: 'w-dv', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'dht-1', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'w-dd', from: { nodeId: 'board', pinId: 'GPIO3' }, to: { nodeId: 'dht-1', pinId: 'DATA' }, color: '#10b981' },
      { id: 'w-dg', from: { nodeId: 'dht-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'w-bp', from: { nodeId: 'board', pinId: 'GPIO7' }, to: { nodeId: 'buzz-1', pinId: 'POS' }, color: '#8b5cf6' },
      { id: 'w-bg', from: { nodeId: 'buzz-1', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  // === 9 Wokwi Showcase Learning Projects (Dosen-Only) ===
  {
    id: 'dosen-wokwi-simon-says',
    dosenOnly: true,
    board: 'arduino-uno',
    titleId: 'Dosen · Simon Says Game + Skor 7-Seg & Buzzer (Wokwi)',
    titleEn: 'Instructor · Simon Says Game + 7-Seg & Buzzer (Wokwi)',
    badge: 'Dosen · Wokwi Game',
    summaryId: 'Tekan tombol warna [1-4] di kanvas untuk memainkan nada buzzer, menyalakan LED, dan menaikkan skor 7-Segment.',
    summaryEn: 'Click colored buttons [1-4] on canvas to sound buzzer notes, light LEDs, and advance the 7-segment score.',
    code: `// Simon Says Interactive (Wokwi #328451800839488084)
int score = 0;

void setup() {
  Serial.begin(115200);
  pinMode(2, INPUT_PULLUP);
  pinMode(4, INPUT_PULLUP);
  pinMode(5, INPUT_PULLUP);
  pinMode(6, INPUT_PULLUP);
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(11, OUTPUT);
  pinMode(13, OUTPUT);
  sevenSeg.print(0);
  Serial.println("Simon Says siap! Tekan tombol 1-4 di kanvas.");
}

void loop() {
  int b1 = digitalRead(2);
  int b2 = digitalRead(4);
  int b3 = digitalRead(5);
  int b4 = digitalRead(6);

  if (b1 == LOW) {
    digitalWrite(9, HIGH);
    tone(13, 262);
    score = score + 1;
    sevenSeg.print(score);
    Serial.println("MERAH (C4 262Hz) | Skor:" + String(score));
  } else if (b2 == LOW) {
    digitalWrite(10, HIGH);
    tone(13, 330);
    score = score + 1;
    sevenSeg.print(score);
    Serial.println("HIJAU (E4 330Hz) | Skor:" + String(score));
  } else if (b3 == LOW) {
    digitalWrite(11, HIGH);
    tone(13, 392);
    score = score + 1;
    sevenSeg.print(score);
    Serial.println("BIRU (G4 392Hz) | Skor:" + String(score));
  } else if (b4 == LOW) {
    digitalWrite(9, HIGH);
    digitalWrite(10, HIGH);
    tone(13, 523);
    score = score + 1;
    sevenSeg.print(score);
    Serial.println("KUNING (C5 523Hz) | Skor:" + String(score));
  } else {
    digitalWrite(9, LOW);
    digitalWrite(10, LOW);
    digitalWrite(11, LOW);
    noTone(13);
  }
  delay(220);
}`,
    components: [
      { id: 'btn-r', kind: 'pushbutton', x: 380, y: 30, label: 'Merah [1]', color: 'red', props: { shortcutKey: '1' } },
      { id: 'btn-g', kind: 'pushbutton', x: 470, y: 30, label: 'Hijau [2]', color: 'green', props: { shortcutKey: '2' } },
      { id: 'btn-b', kind: 'pushbutton', x: 560, y: 30, label: 'Biru [3]', color: 'blue', props: { shortcutKey: '3' } },
      { id: 'btn-y', kind: 'pushbutton', x: 650, y: 30, label: 'Kuning [4]', color: 'yellow', props: { shortcutKey: '4' } },
      { id: 'res-s1', kind: 'resistor', x: 380, y: 125, label: 'R1 (220Ω)', ohms: 220, props: {} },
      { id: 'led-r', kind: 'led', x: 490, y: 120, label: 'LED Merah', color: 'red', props: {} },
      { id: 'led-g', kind: 'led', x: 565, y: 120, label: 'LED Hijau', color: 'green', props: {} },
      { id: 'led-b', kind: 'led', x: 640, y: 120, label: 'LED Biru', color: 'blue', props: {} },
      { id: 'seg-score', kind: 'seven-seg', x: 400, y: 245, label: 'Skor Simon', color: 'red', props: {} },
      { id: 'buzz-simon', kind: 'buzzer', x: 535, y: 250, label: 'Piezo Speaker', props: {} },
    ],
    wires: [
      { id: 'ws1', from: { nodeId: 'board', pinId: 'D2' }, to: { nodeId: 'btn-r', pinId: 'OUT' }, color: '#ef4444' },
      { id: 'ws2', from: { nodeId: 'btn-r', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'ws3', from: { nodeId: 'board', pinId: 'D4' }, to: { nodeId: 'btn-g', pinId: 'OUT' }, color: '#22c55e' },
      { id: 'ws4', from: { nodeId: 'btn-g', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'ws5', from: { nodeId: 'board', pinId: 'D5' }, to: { nodeId: 'btn-b', pinId: 'OUT' }, color: '#3b82f6' },
      { id: 'ws6', from: { nodeId: 'btn-b', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'ws7', from: { nodeId: 'board', pinId: 'D6' }, to: { nodeId: 'btn-y', pinId: 'OUT' }, color: '#eab308' },
      { id: 'ws8', from: { nodeId: 'btn-y', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'ws9', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'res-s1', pinId: 'P1' }, color: '#ef4444' },
      { id: 'ws10', from: { nodeId: 'res-s1', pinId: 'P2' }, to: { nodeId: 'led-r', pinId: 'A' }, color: '#ef4444' },
      { id: 'ws11', from: { nodeId: 'led-r', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'ws12', from: { nodeId: 'board', pinId: 'D10' }, to: { nodeId: 'led-g', pinId: 'A' }, color: '#22c55e' },
      { id: 'ws13', from: { nodeId: 'led-g', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'ws14', from: { nodeId: 'board', pinId: 'D11' }, to: { nodeId: 'led-b', pinId: 'A' }, color: '#3b82f6' },
      { id: 'ws15', from: { nodeId: 'led-b', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'ws16', from: { nodeId: 'board', pinId: 'D13' }, to: { nodeId: 'buzz-simon', pinId: 'POS' }, color: '#8b5cf6' },
      { id: 'ws17', from: { nodeId: 'buzz-simon', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'ws18', from: { nodeId: 'board', pinId: 'A4' }, to: { nodeId: 'seg-score', pinId: 'IN' }, color: '#06b6d4' },
      { id: 'ws19', from: { nodeId: 'seg-score', pinId: 'COM' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
    ],
  },
  {
    id: 'dosen-wokwi-pong',
    dosenOnly: true,
    board: 'arduino-uno',
    titleId: 'Dosen · Pong Game OLED SSD1306 + Slider Paddle (Wokwi)',
    titleEn: 'Instructor · Pong Game on OLED SSD1306 + Slide Pot (Wokwi)',
    badge: 'Dosen · Wokwi OLED Game',
    summaryId: 'Geser Slide Potentiometer untuk menggerakkan paddle Pong pada layar OLED SSD1306 dan membunyikan buzzer saat pantulan.',
    summaryEn: 'Slide the potentiometer fader to steer the Pong paddle on OLED SSD1306 with buzzer bounce feedback.',
    code: `// Pong Simulation (Wokwi #348849468083274322)
int score = 0;
int ballX = 1;

void setup() {
  Serial.begin(115200);
  oled.begin();
  pinMode(9, OUTPUT);
  Serial.println("Pong OLED Siap! Geser Slide Potentiometer.");
}

void loop() {
  int adc = analogRead(14);
  int paddle = map(adc, 0, 1023, 0, 100);
  ballX = ballX + 1;

  oled.clear();
  oled.println("PONG ARENA  P:" + String(score));
  oled.println("Ball Pos  : " + String(ballX));
  oled.println("Paddle Y  : " + String(paddle) + "%");
  if (paddle > 65) {
    tone(9, 880);
    score = score + 1;
    oled.println("HIT! +1 Buzzer 880Hz");
    Serial.println("PONG HIT! Score=" + String(score));
  } else if (paddle < 25) {
    tone(9, 440);
    oled.println("BOTTOM BOUNCE 440Hz");
  } else {
    noTone(9);
    oled.println("Geser >65/<25: Bunyi");
  }
  oled.display();
  delay(280);
}`,
    components: [
      { id: 'oled-pong', kind: 'oled-ssd1306', x: 390, y: 70, label: 'OLED Arena', props: {} },
      { id: 'spot-pong', kind: 'slide-pot', x: 390, y: 215, label: 'Paddle Control', props: { potPct: 50 } },
      { id: 'buzz-pong', kind: 'buzzer', x: 560, y: 120, label: 'Buzzer Efek', props: {} },
    ],
    wires: [
      { id: 'wp1', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'oled-pong', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wp2', from: { nodeId: 'board', pinId: 'GND2' }, to: { nodeId: 'oled-pong', pinId: 'GND' }, color: '#1e293b' },
      { id: 'wp3', from: { nodeId: 'board', pinId: 'A4' }, to: { nodeId: 'oled-pong', pinId: 'SDA' }, color: '#f59e0b' },
      { id: 'wp4', from: { nodeId: 'board', pinId: 'A5' }, to: { nodeId: 'oled-pong', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'wp5', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'spot-pong', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wp6', from: { nodeId: 'board', pinId: 'A0' }, to: { nodeId: 'spot-pong', pinId: 'SIG' }, color: '#10b981' },
      { id: 'wp7', from: { nodeId: 'spot-pong', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'wp8', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'buzz-pong', pinId: 'POS' }, color: '#8b5cf6' },
      { id: 'wp9', from: { nodeId: 'buzz-pong', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'dosen-wokwi-mega-tunnel',
    dosenOnly: true,
    board: 'arduino-mega',
    titleId: 'Dosen · Arduino Mega MAX7219 Matrix Tunnel (Wokwi)',
    titleEn: 'Instructor · Arduino Mega MAX7219 Tunnel (Wokwi)',
    badge: 'Dosen · Mega Matrix',
    summaryId: 'Animasi terowongan LED Dot Matrix 8×8 pada Arduino Mega dengan potensiometer pengatur efek & bunyi buzzer.',
    summaryEn: 'MAX7219 8×8 tunnel animation on Arduino Mega with potentiometer control and buzzer tick.',
    code: `// Arduino Mega MAX7219 Tunnel (Wokwi #318864638990090834)
int frame = 0;

void setup() {
  Serial.begin(115200);
  pinMode(9, OUTPUT);
  Serial.println("MAX7219 Tunnel Animation Active!");
}

void loop() {
  int pot = analogRead(54);
  int speedPct = map(pot, 0, 1023, 0, 100);
  frame = frame + 1;
  matrix.setPattern("tunnel", frame);
  if (speedPct > 70) {
    tone(9, 660);
    Serial.println("Tunnel Turbo Mode! Speed=" + String(speedPct) + "%");
  } else {
    noTone(9);
  }
  delay(220);
}`,
    components: [
      { id: 'mat-tun', kind: 'max7219-matrix', x: 430, y: 70, label: 'MAX7219 8×8', color: 'red', props: {} },
      { id: 'pot-tun', kind: 'potentiometer', x: 435, y: 205, label: 'Kecepatan Tunnel', props: { potPct: 45 } },
      { id: 'buzz-tun', kind: 'buzzer', x: 565, y: 115, label: 'Buzzer Turbo', props: {} },
    ],
    wires: [
      { id: 'wt1', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'mat-tun', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wt2', from: { nodeId: 'board', pinId: 'GND2' }, to: { nodeId: 'mat-tun', pinId: 'GND' }, color: '#1e293b' },
      { id: 'wt3', from: { nodeId: 'board', pinId: 'D11' }, to: { nodeId: 'mat-tun', pinId: 'DIN' }, color: '#10b981' },
      { id: 'wt5', from: { nodeId: 'board', pinId: 'D13' }, to: { nodeId: 'mat-tun', pinId: 'CLK' }, color: '#f59e0b' },
      { id: 'wt6', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'pot-tun', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wt7', from: { nodeId: 'board', pinId: 'A0' }, to: { nodeId: 'pot-tun', pinId: 'SIG' }, color: '#8b5cf6' },
      { id: 'wt8', from: { nodeId: 'pot-tun', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'wt9', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'buzz-tun', pinId: 'POS' }, color: '#ec4899' },
      { id: 'wt10', from: { nodeId: 'buzz-tun', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'dosen-wokwi-alarm-clock',
    dosenOnly: true,
    board: 'arduino-uno',
    titleId: 'Dosen · Jam Alarm 7-Segment + RTC DS1307 & Buzzer (Wokwi)',
    titleEn: 'Instructor · Arduino Alarm Clock + RTC DS1307 & Buzzer (Wokwi)',
    badge: 'Dosen · Alarm Clock',
    summaryId: 'Jam digital 4-digit 7-Segment dari RTC DS1307 dengan sakelar Slide Switch untuk mengaktifkan alarm buzzer.',
    summaryEn: '4-digit 7-segment digital clock with DS1307 RTC and slide switch to sound the buzzer alarm.',
    code: `// Arduino Alarm Clock (Wokwi #297787059514376717)
void setup() {
  Serial.begin(115200);
  pinMode(4, INPUT_PULLUP);
  pinMode(9, OUTPUT);
  Serial.println("Jam Alarm DS1307 aktif! Geser Switch untuk test Alarm.");
}

void loop() {
  String t = rtc.readTime();
  int alarmSwitch = digitalRead(4);
  if (alarmSwitch == LOW) {
    tm1637.showNumber("ALRM");
    tone(9, 1480);
    Serial.println("ALARM BUNYI! Waktu RTC: " + t);
  } else {
    tm1637.showNumber(t);
    noTone(9);
    Serial.println("Waktu RTC: " + t);
  }
  delay(450);
}`,
    components: [
      { id: 'seg4-clk', kind: 'seven-seg-4', x: 390, y: 45, label: 'Jam 4-Digit', color: 'green', props: {} },
      { id: 'rtc-clk', kind: 'rtc-ds1307', x: 395, y: 155, label: 'RTC DS1307', props: {} },
      { id: 'sw-alarm', kind: 'slide-switch', x: 545, y: 80, label: 'Sakelar Alarm', props: { latched: false } },
      { id: 'buzz-clk', kind: 'buzzer', x: 550, y: 185, label: 'Buzzer Alarm', props: {} },
    ],
    wires: [
      { id: 'wc1', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'seg4-clk', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wc2', from: { nodeId: 'board', pinId: 'GND2' }, to: { nodeId: 'seg4-clk', pinId: 'GND' }, color: '#1e293b' },
      { id: 'wc3', from: { nodeId: 'board', pinId: 'D2' }, to: { nodeId: 'seg4-clk', pinId: 'CLK' }, color: '#10b981' },
      { id: 'wc4', from: { nodeId: 'board', pinId: 'D5' }, to: { nodeId: 'seg4-clk', pinId: 'DIO' }, color: '#3b82f6' },
      { id: 'wc5', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'rtc-clk', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wc6', from: { nodeId: 'board', pinId: 'GND1' }, to: { nodeId: 'rtc-clk', pinId: 'GND' }, color: '#1e293b' },
      { id: 'wc7', from: { nodeId: 'board', pinId: 'A4' }, to: { nodeId: 'rtc-clk', pinId: 'SDA' }, color: '#f59e0b' },
      { id: 'wc8', from: { nodeId: 'board', pinId: 'A5' }, to: { nodeId: 'rtc-clk', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'wc9', from: { nodeId: 'board', pinId: 'D4' }, to: { nodeId: 'sw-alarm', pinId: '2' }, color: '#8b5cf6' },
      { id: 'wc10', from: { nodeId: 'sw-alarm', pinId: '3' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'wc11', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'buzz-clk', pinId: 'POS' }, color: '#f97316' },
      { id: 'wc12', from: { nodeId: 'buzz-clk', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'dosen-wokwi-calculator',
    dosenOnly: true,
    board: 'arduino-uno',
    titleId: 'Dosen · Kalkulator Keypad 4×4 + LCD 20×4 I2C (Wokwi)',
    titleEn: 'Instructor · Arduino Keypad 4×4 + LCD 20×4 Calculator (Wokwi)',
    badge: 'Dosen · Kalkulator LCD',
    summaryId: 'Klik tombol angka pada Keypad 4×4 untuk mengetik angka ke layar LCD 20×4 disertai bunyi beep buzzer.',
    summaryEn: 'Click keys on the 4×4 Keypad to display live numbers on the 20×4 LCD with buzzer key clicks.',
    code: `// Arduino Keypad Calculator (Wokwi #276825819240727048)
String expr = "";

void setup() {
  Serial.begin(115200);
  pinMode(9, OUTPUT);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("KALKULATOR ARDUINO");
  lcd.setCursor(0, 1);
  lcd.print("Klik Keypad 4x4:");
  Serial.println("Kalkulator siap! Klik Keypad di kanvas.");
}

void loop() {
  String k = keypad.getKey();
  if (k != "") {
    tone(9, 1320);
    if (k == "*") {
      expr = "";
      lcd.setCursor(0, 2);
      lcd.print("Input: [Cleared]    ");
    } else {
      expr = expr + k;
      lcd.setCursor(0, 2);
      lcd.print("Input: " + expr);
      lcd.setCursor(0, 3);
      lcd.print("Last Key: " + k);
    }
    Serial.println("Keypad Press: " + k + " | Buffer=" + expr);
    delay(160);
    noTone(9);
  }
  delay(120);
}`,
    components: [
      { id: 'lcd-calc', kind: 'lcd-20x4', x: 385, y: 40, label: 'LCD 20×4 I2C', props: { lcdBackground: 'blue', lcdTextColor: 'white' } },
      { id: 'kp-calc', kind: 'keypad-4x4', x: 390, y: 170, label: 'Keypad 4×4', props: {} },
      { id: 'buzz-calc', kind: 'buzzer', x: 560, y: 120, label: 'Beep Tombol', props: {} },
    ],
    wires: [
      { id: 'wkc1', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'lcd-calc', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wkc2', from: { nodeId: 'board', pinId: 'GND2' }, to: { nodeId: 'lcd-calc', pinId: 'GND' }, color: '#1e293b' },
      { id: 'wkc3', from: { nodeId: 'board', pinId: 'A4' }, to: { nodeId: 'lcd-calc', pinId: 'SDA' }, color: '#f59e0b' },
      { id: 'wkc4', from: { nodeId: 'board', pinId: 'A5' }, to: { nodeId: 'lcd-calc', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'wkc5', from: { nodeId: 'board', pinId: 'D2' }, to: { nodeId: 'kp-calc', pinId: 'R1' }, color: '#10b981' },
      { id: 'wkc6', from: { nodeId: 'board', pinId: 'D4' }, to: { nodeId: 'kp-calc', pinId: 'R2' }, color: '#22c55e' },
      { id: 'wkc7', from: { nodeId: 'board', pinId: 'D5' }, to: { nodeId: 'kp-calc', pinId: 'C1' }, color: '#3b82f6' },
      { id: 'wkc8', from: { nodeId: 'board', pinId: 'D6' }, to: { nodeId: 'kp-calc', pinId: 'C2' }, color: '#8b5cf6' },
      { id: 'wkc9', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'buzz-calc', pinId: 'POS' }, color: '#ec4899' },
      { id: 'wkc10', from: { nodeId: 'buzz-calc', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'dosen-wokwi-compass',
    dosenOnly: true,
    board: 'arduino-uno',
    titleId: 'Dosen · Kompas 3D OLED + MPU6050 & Potensiometer (Wokwi)',
    titleEn: 'Instructor · 3D Compass OLED + MPU6050 & Potentiometer (Wokwi)',
    badge: 'Dosen · 3D Compass OLED',
    summaryId: 'Atur heading potensiometer (0..359°) & slider kemiringan MPU-6050 untuk menampilkan arah kompas di OLED SSD1306.',
    summaryEn: 'Tune heading knob (0..359°) and MPU-6050 tilt slider to display compass HUD on SSD1306 OLED.',
    code: `// 3D Compass OLED + MPU6050 (Wokwi #385987811439126529)
void setup() {
  Serial.begin(115200);
  oled.begin();
  pinMode(9, OUTPUT);
  Serial.println("Kompas OLED aktif! Putar potensiometer & atur MPU6050.");
}

void loop() {
  int adc = analogRead(14);
  int deg = map(adc, 0, 1023, 0, 359);
  int tilt = mpu.readTilt();

  oled.clear();
  oled.println("COMPASS 3D HUD");
  oled.println("Heading: " + String(deg) + " deg");
  oled.println("Tilt X : " + String(tilt) + " deg");
  if (deg < 25) {
    tone(9, 988);
    oled.println("ARAH   : [UTARA N]");
  } else if (deg < 135) {
    noTone(9);
    oled.println("ARAH   : [TIMUR E]");
  } else if (deg < 235) {
    noTone(9);
    oled.println("ARAH   : [SELATAN S]");
  } else {
    noTone(9);
    oled.println("ARAH   : [BARAT W]");
  }
  oled.display();
  Serial.println("deg:" + String(deg) + ",tilt:" + String(tilt));
  delay(260);
}`,
    components: [
      { id: 'oled-cmp', kind: 'oled-ssd1306', x: 385, y: 40, label: 'OLED Kompas', props: {} },
      { id: 'mpu-cmp', kind: 'mpu6050', x: 545, y: 45, label: 'MPU-6050', props: { tiltDeg: 12 } },
      { id: 'pot-cmp', kind: 'potentiometer', x: 390, y: 180, label: 'Azimuth Knob', props: { potPct: 4 } },
      { id: 'buzz-cmp', kind: 'buzzer', x: 560, y: 190, label: 'Buzzer Utara', props: {} },
    ],
    wires: [
      { id: 'wcp1', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'oled-cmp', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wcp2', from: { nodeId: 'board', pinId: 'GND2' }, to: { nodeId: 'oled-cmp', pinId: 'GND' }, color: '#1e293b' },
      { id: 'wcp3', from: { nodeId: 'board', pinId: 'A4' }, to: { nodeId: 'oled-cmp', pinId: 'SDA' }, color: '#f59e0b' },
      { id: 'wcp4', from: { nodeId: 'board', pinId: 'A5' }, to: { nodeId: 'oled-cmp', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'wcp5', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'mpu-cmp', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wcp6', from: { nodeId: 'board', pinId: 'GND2' }, to: { nodeId: 'mpu-cmp', pinId: 'GND' }, color: '#1e293b' },
      { id: 'wcp7', from: { nodeId: 'board', pinId: 'A4' }, to: { nodeId: 'mpu-cmp', pinId: 'SDA' }, color: '#f59e0b' },
      { id: 'wcp8', from: { nodeId: 'board', pinId: 'A5' }, to: { nodeId: 'mpu-cmp', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'wcp9', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'pot-cmp', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wcp10', from: { nodeId: 'board', pinId: 'A0' }, to: { nodeId: 'pot-cmp', pinId: 'SIG' }, color: '#10b981' },
      { id: 'wcp11', from: { nodeId: 'pot-cmp', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'wcp12', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'buzz-cmp', pinId: 'POS' }, color: '#8b5cf6' },
      { id: 'wcp13', from: { nodeId: 'buzz-cmp', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'dosen-wokwi-matrix-dht',
    dosenOnly: true,
    board: 'arduino-uno',
    titleId: 'Dosen · Matrix Clock + DHT22 & Alarm Suhu (Wokwi)',
    titleEn: 'Instructor · MAX7219 Matrix + DHT22 & Temp Alert (Wokwi)',
    badge: 'Dosen · Matrix + DHT22',
    summaryId: 'Geser suhu DHT22 pada kanvas (> 32°C) untuk mengubah tampilan MAX7219 menjadi ikon peringatan dan membunyikan buzzer.',
    summaryEn: 'Slide DHT22 temperature (> 32°C) on canvas to switch MAX7219 matrix pattern and trigger buzzer alert.',
    code: `// MAX7219 Clock & DHT Sensor (Wokwi #289186888566178317)
void setup() {
  Serial.begin(115200);
  pinMode(9, OUTPUT);
  Serial.println("Monitor Suhu & Matrix aktif!");
}

void loop() {
  float temp = dht.readTemperature(4);
  float hum = dht.readHumidity(4);
  String t = rtc.readTime();
  lcd.setCursor(0, 0);
  lcd.print("Jam " + t + " T:" + String(temp));
  lcd.setCursor(0, 1);
  if (temp > 32) {
    matrix.setPattern("alert", 0);
    tone(9, 1560);
    lcd.print("ALERT SUHU TINGGI");
  } else {
    matrix.setPattern("smile", 0);
    noTone(9);
    lcd.print("Hum: " + String(hum) + "% OK");
  }
  Serial.println("temp:" + String(temp) + ",hum:" + String(hum));
  delay(350);
}`,
    components: [
      { id: 'mat-dht', kind: 'max7219-matrix', x: 385, y: 45, label: 'Matrix 8×8', color: 'green', props: {} },
      { id: 'dht-mat', kind: 'dht22', x: 510, y: 45, label: 'DHT22 Suhu', props: { tempC: 29, humidity: 58 } },
      { id: 'lcd-mat', kind: 'lcd-1602', x: 385, y: 175, label: 'Info RTC+DHT', props: {} },
      { id: 'buzz-dht', kind: 'buzzer', x: 555, y: 185, label: 'Alarm Suhu', props: {} },
    ],
    wires: [
      { id: 'wmd1', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'mat-dht', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wmd2', from: { nodeId: 'board', pinId: 'GND2' }, to: { nodeId: 'mat-dht', pinId: 'GND' }, color: '#1e293b' },
      { id: 'wmd3', from: { nodeId: 'board', pinId: 'D11' }, to: { nodeId: 'mat-dht', pinId: 'DIN' }, color: '#10b981' },
      { id: 'wmd5', from: { nodeId: 'board', pinId: 'D13' }, to: { nodeId: 'mat-dht', pinId: 'CLK' }, color: '#f59e0b' },
      { id: 'wmd6', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'dht-mat', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wmd7', from: { nodeId: 'board', pinId: 'D4' }, to: { nodeId: 'dht-mat', pinId: 'DATA' }, color: '#22c55e' },
      { id: 'wmd8', from: { nodeId: 'dht-mat', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'wmd9', from: { nodeId: 'board', pinId: 'A4' }, to: { nodeId: 'lcd-mat', pinId: 'SDA' }, color: '#f59e0b' },
      { id: 'wmd10', from: { nodeId: 'board', pinId: 'A5' }, to: { nodeId: 'lcd-mat', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'wmd11', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'buzz-dht', pinId: 'POS' }, color: '#8b5cf6' },
      { id: 'wmd12', from: { nodeId: 'buzz-dht', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
    ],
  },
  {
    id: 'dosen-wokwi-progressbar',
    dosenOnly: true,
    board: 'arduino-uno',
    titleId: 'Dosen · U8glib OLED Progress Bar + Potensiometer (Wokwi)',
    titleEn: 'Instructor · U8glib OLED Progress Bar + Potentiometer (Wokwi)',
    badge: 'Dosen · OLED Progress',
    summaryId: 'Putar potensiometer untuk mengisi Progress Bar 0..100% di layar OLED SSD1306 dan bunyikan nada selesai pada 100%.',
    summaryEn: 'Turn potentiometer to drive OLED SSD1306 Progress Bar (0..100%) and trigger completion tone at 100%.',
    code: `// U8glib Progress Bar (Wokwi #333991258811794002)
void setup() {
  Serial.begin(115200);
  oled.begin();
  pinMode(9, OUTPUT);
  Serial.println("Putar Potentiometer untuk atur Progress Bar.");
}

void loop() {
  int adc = analogRead(14);
  int pct = map(adc, 0, 1023, 0, 100);
  oled.clear();
  oled.println("LOADING SYSTEM");
  oled.progressBar(pct);
  if (pct >= 95) {
    tone(9, 1047);
    oled.println("STATUS: COMPLETE!");
  } else {
    noTone(9);
    oled.println("ADC Raw: " + String(adc));
  }
  oled.display();
  Serial.println("progress:" + String(pct));
  delay(220);
}`,
    components: [
      { id: 'oled-prg', kind: 'oled-ssd1306', x: 390, y: 60, label: 'OLED Progress', props: {} },
      { id: 'pot-prg', kind: 'potentiometer', x: 395, y: 195, label: 'Level 0-100%', props: { potPct: 60 } },
      { id: 'buzz-prg', kind: 'buzzer', x: 555, y: 120, label: 'Buzzer Selesai', props: {} },
    ],
    wires: [
      { id: 'wpg1', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'oled-prg', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wpg2', from: { nodeId: 'board', pinId: 'GND2' }, to: { nodeId: 'oled-prg', pinId: 'GND' }, color: '#1e293b' },
      { id: 'wpg3', from: { nodeId: 'board', pinId: 'A4' }, to: { nodeId: 'oled-prg', pinId: 'SDA' }, color: '#f59e0b' },
      { id: 'wpg4', from: { nodeId: 'board', pinId: 'A5' }, to: { nodeId: 'oled-prg', pinId: 'SCL' }, color: '#3b82f6' },
      { id: 'wpg5', from: { nodeId: 'board', pinId: '5V' }, to: { nodeId: 'pot-prg', pinId: 'VCC' }, color: '#ef4444' },
      { id: 'wpg6', from: { nodeId: 'board', pinId: 'A0' }, to: { nodeId: 'pot-prg', pinId: 'SIG' }, color: '#10b981' },
      { id: 'wpg7', from: { nodeId: 'pot-prg', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'wpg8', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'buzz-prg', pinId: 'POS' }, color: '#8b5cf6' },
      { id: 'wpg9', from: { nodeId: 'buzz-prg', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
    ],
  },
  {
    id: 'dosen-wokwi-mini-piano',
    dosenOnly: true,
    board: 'arduino-uno',
    titleId: 'Dosen · Mini Piano 8 Nada + OLED & Buzzer (Wokwi)',
    titleEn: 'Instructor · Mini Piano 8 Keys + OLED & Buzzer (Wokwi)',
    badge: 'Dosen · Mini Piano',
    summaryId: 'Klik tuts piano atau tekan tombol angka keyboard 1–8 saat simulasi berjalan untuk memainkan tangga nada C4–C5 di buzzer.',
    summaryEn: 'Click piano keys or press keyboard keys 1–8 while running to play C4–C5 musical notes on the Piezo Buzzer.',
    code: `// Mini Piano (Wokwi #291958456169005577)
void setup() {
  Serial.begin(115200);
  oled.begin();
  pinMode(2, INPUT_PULLUP);
  pinMode(4, INPUT_PULLUP);
  pinMode(5, INPUT_PULLUP);
  pinMode(6, INPUT_PULLUP);
  pinMode(10, INPUT_PULLUP);
  pinMode(11, INPUT_PULLUP);
  pinMode(13, INPUT_PULLUP);
  pinMode(9, OUTPUT);
  Serial.println("Mini Piano siap! Klik tombol nada atau tekan keyboard 1-7.");
}

void loop() {
  oled.clear();
  oled.println("MINI PIANO 7-NOTE");
  if (digitalRead(2) == LOW) {
    tone(9, 262);
    oled.println("Nada: C4 (Do) 262Hz");
  } else if (digitalRead(4) == LOW) {
    tone(9, 294);
    oled.println("Nada: D4 (Re) 294Hz");
  } else if (digitalRead(5) == LOW) {
    tone(9, 330);
    oled.println("Nada: E4 (Mi) 330Hz");
  } else if (digitalRead(6) == LOW) {
    tone(9, 349);
    oled.println("Nada: F4 (Fa) 349Hz");
  } else if (digitalRead(10) == LOW) {
    tone(9, 392);
    oled.println("Nada: G4 (Sol) 392Hz");
  } else if (digitalRead(11) == LOW) {
    tone(9, 440);
    oled.println("Nada: A4 (La) 440Hz");
  } else if (digitalRead(13) == LOW) {
    tone(9, 494);
    oled.println("Nada: B4 (Si) 494Hz");
  } else {
    noTone(9);
    oled.println("Tekan tuts [1..7]");
  }
  oled.display();
  delay(140);
}`,
    components: [
      { id: 'p-c4', kind: 'pushbutton', x: 360, y: 20, label: 'Do C4 [1]', color: 'red', props: { shortcutKey: '1' } },
      { id: 'p-d4', kind: 'pushbutton', x: 445, y: 20, label: 'Re D4 [2]', color: 'yellow', props: { shortcutKey: '2' } },
      { id: 'p-e4', kind: 'pushbutton', x: 530, y: 20, label: 'Mi E4 [3]', color: 'green', props: { shortcutKey: '3' } },
      { id: 'p-f4', kind: 'pushbutton', x: 615, y: 20, label: 'Fa F4 [4]', color: 'blue', props: { shortcutKey: '4' } },
      { id: 'p-g4', kind: 'pushbutton', x: 360, y: 110, label: 'Sol G4 [5]', color: 'white', props: { shortcutKey: '5' } },
      { id: 'p-a4', kind: 'pushbutton', x: 445, y: 110, label: 'La A4 [6]', color: 'grey', props: { shortcutKey: '6' } },
      { id: 'p-b4', kind: 'pushbutton', x: 530, y: 110, label: 'Si B4 [7]', color: 'black', props: { shortcutKey: '7' } },
      { id: 'oled-pn', kind: 'oled-ssd1306', x: 380, y: 215, label: 'Layar Nada', props: {} },
      { id: 'buzz-pn', kind: 'buzzer', x: 555, y: 225, label: 'Speaker Piano', props: {} },
    ],
    wires: [
      { id: 'wpn1', from: { nodeId: 'board', pinId: 'D2' }, to: { nodeId: 'p-c4', pinId: 'OUT' }, color: '#ef4444' },
      { id: 'wpn2', from: { nodeId: 'p-c4', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'wpn3', from: { nodeId: 'board', pinId: 'D4' }, to: { nodeId: 'p-d4', pinId: 'OUT' }, color: '#eab308' },
      { id: 'wpn4', from: { nodeId: 'p-d4', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'wpn5', from: { nodeId: 'board', pinId: 'D5' }, to: { nodeId: 'p-e4', pinId: 'OUT' }, color: '#22c55e' },
      { id: 'wpn6', from: { nodeId: 'p-e4', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'wpn7', from: { nodeId: 'board', pinId: 'D6' }, to: { nodeId: 'p-f4', pinId: 'OUT' }, color: '#3b82f6' },
      { id: 'wpn8', from: { nodeId: 'p-f4', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'wpn9', from: { nodeId: 'board', pinId: 'D10' }, to: { nodeId: 'p-g4', pinId: 'OUT' }, color: '#06b6d4' },
      { id: 'wpn10', from: { nodeId: 'p-g4', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'wpn11', from: { nodeId: 'board', pinId: 'D11' }, to: { nodeId: 'p-a4', pinId: 'OUT' }, color: '#8b5cf6' },
      { id: 'wpn12', from: { nodeId: 'p-a4', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'wpn13', from: { nodeId: 'board', pinId: 'D13' }, to: { nodeId: 'p-b4', pinId: 'OUT' }, color: '#ec4899' },
      { id: 'wpn14', from: { nodeId: 'p-b4', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
      { id: 'wpn15', from: { nodeId: 'board', pinId: 'D9' }, to: { nodeId: 'buzz-pn', pinId: 'POS' }, color: '#f97316' },
      { id: 'wpn16', from: { nodeId: 'buzz-pn', pinId: 'GND' }, to: { nodeId: 'board', pinId: 'GND2' }, color: '#1e293b' },
      { id: 'wpn17', from: { nodeId: 'board', pinId: 'A4' }, to: { nodeId: 'oled-pn', pinId: 'SDA' }, color: '#f59e0b' },
      { id: 'wpn18', from: { nodeId: 'board', pinId: 'A5' }, to: { nodeId: 'oled-pn', pinId: 'SCL' }, color: '#3b82f6' },
    ],
  },
]

export const IOT_MISSIONS: IotMissionSpec[] = [
  {
    id: 'iot-esp32-gpio',
    presetId: 'esp32-c3-blink',
    titleId: 'Misi 1 · Kontrol GPIO, LED & Proteksi Resistor',
    titleEn: 'Mission 1 · GPIO Control, LED & Resistor Protection',
    xp: 50,
    objectiveId: 'Hubungkan LED dengan resistor pengaman seri ke GPIO ESP32-C3 tanpa short-circuit dan jalankan simulasi.',
    objectiveEn: 'Wire an LED in series with a limiting resistor to ESP32-C3 GPIO with zero short-circuits and run simulation.',
    evaluate: ({ components, wires, sim, loopIterations }) => {
      const hasLed = components.some((c) => c.kind === 'led')
      const hasRes = components.some((c) => c.kind === 'resistor')
      const wiredCount = wires.length >= 2
      const safe = sim.alerts.length === 0
      const ran = loopIterations >= 1 && sim.serialLog.length >= 1
      return [
        { id: 'parts', labelId: 'Ada LED dan Resistor di kanvas', labelEn: 'LED and Resistor placed on canvas', passed: hasLed && hasRes },
        { id: 'wires', labelId: 'Kabel terpasang tanpa korsleting', labelEn: 'Wired without hardware alerts', passed: wiredCount && safe },
        { id: 'run', labelId: 'Simulasi dijalankan & mengirim Serial log', labelEn: 'Simulation ran and emitted Serial output', passed: ran },
      ]
    },
  },
  {
    id: 'iot-esp32-ultrasonic',
    presetId: 'esp32-c3-ultrasonic',
    titleId: 'Misi 2 · Sensor Jarak HC-SR04 + Alarm & Servo',
    titleEn: 'Mission 2 · HC-SR04 Distance + Alarm & Servo',
    xp: 50,
    objectiveId: 'Rangkai HC-SR04, Buzzer, dan Servo pada ESP32-C3 lalu jalankan loop pembacaan jarak.',
    objectiveEn: 'Connect HC-SR04, Buzzer, and Servo to ESP32-C3 and run distance polling.',
    evaluate: ({ components, wires, sim, loopIterations }) => {
      const hasUltra = components.some((c) => c.kind === 'hc-sr04')
      const hasServoOrBuzz = components.some((c) => c.kind === 'servo' || c.kind === 'buzzer')
      const safe = sim.alerts.length === 0 && wires.length >= 4
      const ran = loopIterations >= 1 && sim.plotHistory.length >= 1
      return [
        { id: 'parts', labelId: 'Komponen HC-SR04 & Aktuator terpasang', labelEn: 'HC-SR04 & Actuator mounted', passed: hasUltra && hasServoOrBuzz },
        { id: 'safe', labelId: 'Rangkaian aman (0 peringatan hardware)', labelEn: 'Circuit safe (0 hardware alerts)', passed: safe },
        { id: 'telemetry', labelId: 'Data jarak terbaca di Serial Plotter', labelEn: 'Distance telemetry plotted', passed: ran },
      ]
    },
  },
  {
    id: 'iot-esp32-dht-oled',
    presetId: 'esp32-c3-dht-oled',
    titleId: 'Misi 3 · Monitoring DHT22 + Layar OLED SSD1306',
    titleEn: 'Mission 3 · DHT22 Monitoring + SSD1306 OLED',
    xp: 50,
    objectiveId: 'Tampilkan suhu & kelembapan DHT22 pada layar OLED SSD1306 (SDA/SCL) dan Serial Plotter.',
    objectiveEn: 'Display DHT22 temperature & humidity on the SSD1306 OLED screen and Serial Plotter.',
    evaluate: ({ components, sim, loopIterations }) => {
      const hasDht = components.some((c) => c.kind === 'dht22')
      const oled = components.find((c) => c.kind === 'oled-ssd1306')
      const oledRendered = oled ? (sim.oledLines[oled.id]?.length ?? 0) > 0 : false
      return [
        { id: 'parts', labelId: 'Sensor DHT22 & OLED SSD1306 terpasang', labelEn: 'DHT22 & OLED SSD1306 placed', passed: hasDht && Boolean(oled) },
        { id: 'safe', labelId: 'Koneksi I2C & daya 3.3V bebas alert', labelEn: '3.3V power & I2C clean', passed: sim.alerts.length === 0 },
        { id: 'oled', labelId: 'Layar OLED aktif menampilkan pembacaan', labelEn: 'OLED rendered live readings', passed: oledRendered && loopIterations >= 1 },
      ]
    },
  },
  {
    id: 'iot-esp32-mqtt',
    presetId: 'esp32-c3-mqtt-tls',
    titleId: 'Misi 4 · ESP32 Wi-Fi Telemetri & Keamanan MQTT TLS',
    titleEn: 'Mission 4 · ESP32 Wi-Fi Telemetry & MQTT TLS',
    xp: 50,
    objectiveId: 'Hubungkan ESP32-C3 ke Wi-Fi dan kirim payload sensor ke broker terenkripsi mqtts://.',
    objectiveEn: 'Connect ESP32-C3 to Wi-Fi and publish sensor telemetry over encrypted mqtts://.',
    evaluate: ({ sim }) => {
      const hasMqtt = sim.mqttMessages.length > 0
      const allTls = hasMqtt && sim.mqttMessages.every((m) => m.tls)
      return [
        { id: 'wifi', labelId: 'Wi-Fi ESP32-C3 terhubung', labelEn: 'ESP32-C3 Wi-Fi connected', passed: sim.wifiConnected },
        { id: 'pub', labelId: 'Paket telemetri MQTT terkirim', labelEn: 'MQTT telemetry published', passed: hasMqtt },
        { id: 'tls', labelId: 'Semua paket memakai enkripsi TLS (mqtts://)', labelEn: 'All packets use TLS (mqtts://)', passed: allTls && sim.alerts.length === 0 },
      ]
    },
  },
  {
    id: 'iot-esp32-button-pullup',
    presetId: 'esp32-c3-button',
    titleId: 'Misi 5 · Input Pull-Up Pushbutton & Kendali LED',
    titleEn: 'Mission 5 · Pull-Up Pushbutton & LED Control',
    xp: 50,
    objectiveId: 'Gunakan konfigurasi INPUT_PULLUP untuk Pushbutton serta nyalakan LED dengan resistor 220Ω tanpa alert.',
    objectiveEn: 'Use INPUT_PULLUP for Pushbutton and safely drive LED via 220Ω resistor.',
    evaluate: ({ code, components, wires, sim, loopIterations }) => [
      { id: 'parts', labelId: 'Pushbutton & LED terpasang', labelEn: 'Pushbutton & LED mounted', passed: components.some((c) => c.kind === 'pushbutton') && components.some((c) => c.kind === 'led') },
      { id: 'pullup', labelId: 'Mode INPUT_PULLUP & 4+ kabel aman', labelEn: 'INPUT_PULLUP mode & 4+ safe wires', passed: code.includes('INPUT_PULLUP') && wires.length >= 4 && sim.alerts.length === 0 },
      { id: 'run', labelId: 'Simulasi berjalan bersih', labelEn: 'Clean simulation loop ran', passed: loopIterations >= 1 },
    ],
  },
  {
    id: 'iot-esp32-adc-servo',
    presetId: 'esp32-c3-servo-pot',
    titleId: 'Misi 6 · Kalibrasi ADC Potensiometer & Sudut Servo PWM',
    titleEn: 'Mission 6 · ADC Potentiometer Calibration & Servo PWM',
    xp: 50,
    objectiveId: 'Baca ADC 12-bit Potensiometer via analogRead() lalu konversi sudut Servo via map().',
    objectiveEn: 'Read 12-bit Potentiometer ADC via analogRead() and map angle to Servo PWM.',
    evaluate: ({ code, components, wires, sim, loopIterations }) => [
      { id: 'parts', labelId: 'Potensiometer & Servo terpasang', labelEn: 'Potentiometer & Servo mounted', passed: components.some((c) => c.kind === 'potentiometer') && components.some((c) => c.kind === 'servo') },
      { id: 'adc', labelId: 'Kode analogRead() + map() & kabel lengkap', labelEn: 'analogRead() + map() & complete wiring', passed: code.includes('analogRead') && code.includes('map(') && wires.length >= 4 && sim.alerts.length === 0 },
      { id: 'plot', labelId: 'Data ADC tampil di Serial Plotter', labelEn: 'ADC plotted in Serial Plotter', passed: loopIterations >= 1 && sim.plotHistory.length >= 1 },
    ],
  },
  {
    id: 'iot-esp32-pir-alarm',
    presetId: 'esp32-c3-pir-alarm',
    titleId: 'Misi 7 · Deteksi Gerak PIR + Buzzer & Relay Kunci',
    titleEn: 'Mission 7 · PIR Motion + Buzzer & Lock Relay',
    xp: 60,
    objectiveId: 'Hubungkan sensor PIR dengan aktuator Relay dan alarm Buzzer tanpa pelanggaran tegangan.',
    objectiveEn: 'Wire PIR sensor to Lock Relay and Buzzer alarm with clean voltage levels.',
    evaluate: ({ code, components, wires, sim, loopIterations }) => [
      { id: 'parts', labelId: 'Sensor PIR + Buzzer/Relay terpasang', labelEn: 'PIR sensor + Buzzer/Relay mounted', passed: components.some((c) => c.kind === 'pir') && (components.some((c) => c.kind === 'buzzer') || components.some((c) => c.kind === 'relay')) },
      { id: 'wire', labelId: 'Minimal 5 kabel terpasang aman', labelEn: 'At least 5 safe wires connected', passed: wires.length >= 5 && sim.alerts.length === 0 },
      { id: 'alarm', labelId: 'Log deteksi & tone() berjalan', labelEn: 'Detection log & tone() active', passed: loopIterations >= 1 && code.includes('tone(') && sim.serialLog.length >= 1 },
    ],
  },
  {
    id: 'iot-esp32-lcd-access',
    presetId: 'esp32-c3-lcd-access',
    titleId: 'Misi 8 · Panel Akses LCD 16x2 I2C & Status Pintu',
    titleEn: 'Mission 8 · I2C 16x2 LCD Access Panel & Door Status',
    xp: 60,
    objectiveId: 'Rangkai LCD 16x2 I2C bersama tombol akses serta tampilkan status pintu langsung pada layar LCD.',
    objectiveEn: 'Wire I2C 16x2 LCD with access button and render status text onto LCD.',
    evaluate: ({ components, wires, sim, loopIterations }) => {
      const lcd = components.find((c) => c.kind === 'lcd-1602')
      const rendered = lcd ? (sim.lcdRows[lcd.id]?.length ?? 0) > 0 : false
      return [
        { id: 'parts', labelId: 'LCD 16x2 & Pushbutton/LED terpasang', labelEn: '16x2 LCD & Pushbutton/LED mounted', passed: Boolean(lcd) && (components.some((c) => c.kind === 'pushbutton') || components.some((c) => c.kind === 'led')) },
        { id: 'safe', labelId: 'Wiring I2C bersih (4+ kabel, 0 alert)', labelEn: 'Clean I2C wiring (4+ wires, 0 alerts)', passed: wires.length >= 4 && sim.alerts.length === 0 },
        { id: 'lcd', labelId: 'Layar LCD aktif merender teks status', labelEn: 'LCD screen rendered status lines', passed: rendered && loopIterations >= 1 },
      ]
    },
  },
  {
    id: 'iot-esp32-gas-safety',
    presetId: 'esp32-c3-gas-safety',
    titleId: 'Misi 9 · Sensor Gas MQ-2, Relay Ventilasi & Buzzer',
    titleEn: 'Mission 9 · MQ-2 Gas Sensor, Ventilation Relay & Buzzer',
    xp: 70,
    objectiveId: 'Pantau kadar gas MQ-2 lalu kontrol otomatis Relay kipas dan alarm Buzzer tanpa alert.',
    objectiveEn: 'Monitor MQ-2 gas level to drive ventilation Relay and Buzzer safely.',
    evaluate: ({ code, components, wires, sim, loopIterations }) => [
      { id: 'parts', labelId: 'MQ-2, Relay & Buzzer lengkap di kanvas', labelEn: 'MQ-2, Relay & Buzzer all placed', passed: components.some((c) => c.kind === 'mq2') && components.some((c) => c.kind === 'relay') && components.some((c) => c.kind === 'buzzer') },
      { id: 'wire', labelId: 'Minimal 6 kabel & 0 alert', labelEn: '6+ wires & 0 hardware alerts', passed: wires.length >= 6 && sim.alerts.length === 0 },
      { id: 'run', labelId: 'Firmware analogRead() + telemetri berjalan', labelEn: 'analogRead() & telemetry loop running', passed: loopIterations >= 1 && code.includes('analogRead') && sim.serialLog.length >= 1 },
    ],
  },
  {
    id: 'iot-esp32-secure-telemetry',
    presetId: 'esp32-c3-secure-telemetry',
    titleId: 'Misi 10 · Guard Sensor Suhu, Alarm & Telemetri TLS',
    titleEn: 'Mission 10 · Thermal Guard, Alarm & TLS Telemetry',
    xp: 80,
    objectiveId: 'Integrasikan DHT22, alarm Buzzer, dan komunikasi broker mqtts:// TLS tanpa plaintext mqtt://.',
    objectiveEn: 'Combine DHT22, Buzzer alarm, and encrypted mqtts:// broker without plaintext mqtt://.',
    evaluate: ({ code, components, wires, sim, loopIterations }) => {
      const hasMqtt = sim.mqttMessages.length > 0
      const allTls = hasMqtt && sim.mqttMessages.every((m) => m.tls)
      return [
        { id: 'parts', labelId: 'DHT22 & Buzzer terpasang aman (4+ kabel)', labelEn: 'DHT22 & Buzzer safely wired (4+ wires)', passed: components.some((c) => c.kind === 'dht22') && components.some((c) => c.kind === 'buzzer') && wires.length >= 4 && sim.alerts.length === 0 },
        { id: 'tls', labelId: 'Firmware & paket memakai mqtts:// TLS', labelEn: 'Firmware & packets use mqtts:// TLS', passed: allTls && code.includes('mqtts://') && !code.includes('"mqtt://') },
        { id: 'run', labelId: 'Peringatan suhu & telemetri berjalan', labelEn: 'Thermal alert & telemetry running', passed: loopIterations >= 1 && code.includes('tone(') },
      ]
    },
  },
]
