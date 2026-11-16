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
        x: 310,
        y: 190,
        label: 'R1 (220Ω)',
        ohms: 220,
        props: {},
      },
      {
        id: 'led-1',
        kind: 'led',
        x: 450,
        y: 155,
        label: 'LED Status',
        color: 'green',
        props: {},
      },
    ],
    wires: [
      { id: 'w-gpio2-res', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'res-1', pinId: 'P1' }, color: '#10b981' },
      { id: 'w-res-led', from: { nodeId: 'res-1', pinId: 'P2' }, to: { nodeId: 'led-1', pinId: 'A' }, color: '#f59e0b' },
      { id: 'w-led-gnd', from: { nodeId: 'led-1', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
    ],
  },
  {
    id: 'esp32-c3-button',
    board: 'esp32-c3',
    titleId: 'ESP32-C3 · Pushbutton Input & LED Interaktif',
    titleEn: 'ESP32-C3 · Interactive Pushbutton & LED',
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
    board: 'esp32-c3',
    titleId: 'ESP32-C3 · Potensiometer ADC 12-bit → Servo PWM',
    titleEn: 'ESP32-C3 · 12-bit ADC Potentiometer → Servo PWM',
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
]
