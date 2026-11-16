use super::*;

fn esp32_nodes() -> Vec<TrustNode> {
    vec![
        TrustNode {
            id: "mcu",
            label: "ESP32-C3 DevKit",
            zone: "RISC-V 3.3V",
            role: "Eksekusi sketch C++, GPIO/ADC/PWM, dan kontrol periferal",
        },
        TrustNode {
            id: "circuit",
            label: "Sirkuit & Breadboard",
            zone: "Hardware Virtual",
            role: "LED, resistor pembatas arus, sensor & aktuator di kanvas",
        },
        TrustNode {
            id: "telemetry",
            label: "Serial Monitor / Plotter",
            zone: "Telemetri",
            role: "Log UART 115200 baud, grafik gelombang & bus Wi-Fi/MQTT",
        },
    ]
}

fn esp32_edges() -> Vec<TrustEdge> {
    vec![
        TrustEdge {
            from: "mcu",
            to: "circuit",
            label: "Sinyal GPIO / PWM / I2C (3.3V)",
            crosses_boundary: true,
        },
        TrustEdge {
            from: "circuit",
            to: "mcu",
            label: "Input tombol / bacaan ADC sensor",
            crosses_boundary: true,
        },
        TrustEdge {
            from: "mcu",
            to: "telemetry",
            label: "Serial.println & MQTT payload",
            crosses_boundary: false,
        },
    ]
}

fn build_esp32_levels(
    prefix: &'static str,
    vuln_label: &'static str,
    secure_label: &'static str,
    target_patch_id: &'static str,
) -> Vec<LevelSpec> {
    vec![
        LevelSpec {
            level: LevelId::Easy,
            title: "Level 1 · Perakitan Dasar",
            scenario: "Rangkai komponen pada kanvas dan uji sketsa Arduino C++ dasar.",
            initial_control: "Validasi wiring dan mode pin dasar.",
            pahami_prompt: "Apa hal utama yang harus dipastikan saat merangkai periferal ke pin ESP32-C3?",
            hypothesis_options: vec![
                "Setiap pin GPIO dan jalur daya (3V3/GND) tersambung benar dengan resistor pengaman",
                "Menghubungkan 5V langsung ke GND untuk menaikkan arus",
                "Mengabaikan mode pinMode() sebelum memanggil digitalWrite()",
            ],
            correct_hypothesis: 0,
            probe_instruction: "Jalankan simulasi pada ESP32 Simulator dan amati keluaran Serial serta komponen.",
            diagnosis_options: vec![vuln_label, secure_label],
            correct_diagnosis: 0,
            target_patch_id,
            expected_baseline: "Komponen merespons sesuai sketsa",
            expected_exploit: "Proteksi rangkaian & logika terverifikasi",
        },
        LevelSpec {
            level: LevelId::Medium,
            title: "Level 2 · Validasi Pembacaan",
            scenario: "Tambahkan penyaringan pembacaan atau debounce serta pembatasan batas aman.",
            initial_control: "Filtering dasar dan pengecekan rentang.",
            pahami_prompt: "Mengapa firmware mikrokontroler perlu memvalidasi rentang sensor sebelum menggerakkan aktuator?",
            hypothesis_options: vec![
                "Mencegah noise atau kondisi kabel lepas memicu aktuator tanpa kendali",
                "Agar ukuran binary firmware menjadi lebih besar",
                "Supaya Serial Monitor tidak menampilkan angka",
            ],
            correct_hypothesis: 0,
            probe_instruction: "Ubah slider sensor di kanvas lalu amati Serial Plotter.",
            diagnosis_options: vec![
                "Sensor perlu validasi rentang & ambang batas yang aman",
                "Semua pin analog dibiarkan floating tanpa grounding",
            ],
            correct_diagnosis: 0,
            target_patch_id,
            expected_baseline: "Grafik Serial Plotter stabil",
            expected_exploit: "Out-of-range tertangani di firmware",
        },
        LevelSpec {
            level: LevelId::Hard,
            title: "Level 3 · Integrasi & Diagnostik",
            scenario: "Integrasikan aktuator/display dengan pemantauan kondisi hardware real-time.",
            initial_control: "Deteksi korsleting dan kesesuaian logika 3.3V.",
            pahami_prompt: "Apa risiko menghubungkan sumber 5V ke pin GPIO ESP32-C3 yang berlogika 3.3V?",
            hypothesis_options: vec![
                "Tegangan berlebih merusak pin GPIO ESP32-C3 sehingga wajib memakai level 3.3V",
                "Clock CPU otomatis meningkat menjadi 5 GHz",
                "LED onboard berubah warna menjadi biru",
            ],
            correct_hypothesis: 0,
            probe_instruction: "Uji koneksi VCC, GND, resistor, dan sinyal PWM/I2C.",
            diagnosis_options: vec![
                secure_label,
                "Semua komponen boleh dirangkai tanpa resistor atau GND",
            ],
            correct_diagnosis: 0,
            target_patch_id,
            expected_baseline: "Semua pin beroperasi dalam batas 3.3V",
            expected_exploit: "Peringatan hardware 0 error",
        },
        LevelSpec {
            level: LevelId::Impossible,
            title: format_level_ref(prefix),
            scenario: "Mode referensi aman dengan proteksi rangkaian, firmware tervalidasi, dan telemetri bersih.",
            initial_control: "Referensi aman aktif.",
            pahami_prompt: "Arsitektur referensi memastikan keselamatan elektrikal sekaligus keamanan komunikasi IoT.",
            hypothesis_options: vec![
                "Kombinasi rangkaian aman 3.3V + validasi firmware + enkripsi telemetri",
                "Menonaktifkan seluruh log Serial",
                "Menyalakan seluruh GPIO secara acak",
            ],
            correct_hypothesis: 0,
            probe_instruction: "Verifikasi mode referensi pada seluruh pengujian.",
            diagnosis_options: vec![secure_label, vuln_label],
            correct_diagnosis: 0,
            target_patch_id,
            expected_baseline: "Sistem stabil dan aman",
            expected_exploit: "Tidak ada celah atau korsleting",
        },
    ]
}

fn format_level_ref(prefix: &str) -> &'static str {
    match prefix {
        "gpio" => "Level 4 · Referensi GPIO Aman",
        "ultra" => "Level 4 · Referensi Aktuator Presisi",
        "dht" => "Level 4 · Referensi Telemetri OLED",
        _ => "Level 4 · Referensi MQTT TLS Aman",
    }
}

pub(super) fn lab_iot_esp32_gpio() -> LabDefinition {
    LabDefinition {
        id: "iot-esp32-gpio",
        track: "iot",
        owasp_code: None,
        title: "ESP32-C3: Kontrol GPIO, LED & Proteksi Resistor",
        subtitle: "Rangkai LED, resistor 220Ω, dan pushbutton pada logika 3.3V ESP32-C3",
        objective: "Menguasai konfigurasi pinMode/digitalWrite/digitalRead serta pencegahan arus berlebih dan short-circuit.",
        context: "Modul praktikum perangkat keras virtual dengan board ESP32-C3, komponen snap-to-grid, Serial Monitor, dan inspektor tegangan GPIO 3.3V.",
        cwe_id: "CWE-665",
        wstg_ref: "IOT-HW-01",
        asvs_ref: "IoTSVS HW-1",
        estimated_minutes: 15,
        prerequisite: "Tidak ada",
        fixture_actors: vec!["esp32-c3", "GPIO2", "GPIO4"],
        trust_nodes: esp32_nodes(),
        trust_edges: esp32_edges(),
        hints: [
            "Pastikan LED dihubungkan seri melalui resistor 220Ω ke GPIO2 dan katoda ke GND.",
            "Hindari menghubungkan pin 3V3 atau 5V langsung ke GND karena memicu short-circuit.",
            "Gunakan Serial.println() untuk memantau perubahan status HIGH/LOW secara real-time.",
        ],
        patch_options: vec![
            PatchOption {
                id: "vulnerable",
                label: "Keluaran GPIO tanpa resistor pembatas arus",
                summary: "Mengalirkan pin langsung tanpa pembatas arus atau proteksi input.",
                is_secure: false,
                feedback: "LED berisiko over-current dan pin rentan short-circuit.",
            },
            PatchOption {
                id: "safe-gpio-resistor",
                label: "Gunakan resistor 220Ω seri & validasi logika 3.3V",
                summary: "Membatasi arus LED dengan resistor dan menyinkronkan INPUT_PULLUP/GND dengan aman.",
                is_secure: true,
                feedback: "Rangkaian LED dan pushbutton aman dalam batas arus 3.3V ESP32-C3.",
            },
        ],
        code_stacks: vec![
            CodeStackComparison {
                stack: "Arduino C++ (ESP32-C3)",
                language: "cpp",
                is_primary: true,
                vulnerable_code: "void loop() {\n  digitalWrite(2, HIGH); // Tanpa resistor & tanpa logika kontrol\n}",
                fixed_code: "pinMode(2, OUTPUT);\npinMode(4, INPUT_PULLUP);\nint pressed = (digitalRead(4) == LOW);\ndigitalWrite(2, pressed ? HIGH : LOW);",
                cause_line: 2,
                fix_line: 4,
                explanation: "Konfigurasi pin eksplisit serta pembatasan arus melalui resistor mencegah kerusakan GPIO 3.3V.",
                doc_url: "https://docs.espressif.com/projects/arduino-esp32/",
            },
            CodeStackComparison {
                stack: "Wiring Checklist",
                language: "text",
                is_primary: false,
                vulnerable_code: "GPIO2 -> LED Anode (Direct without 220Ω resistor)",
                fixed_code: "GPIO2 -> Resistor 220Ω -> LED Anode -> LED Cathode -> GND",
                cause_line: 1,
                fix_line: 1,
                explanation: "Resistor 220Ω menjaga arus LED sekitar ~6–10 mA pada tegangan 3.3V.",
                doc_url: "https://docs.espressif.com/projects/arduino-esp32/",
            },
        ],
        levels: build_esp32_levels(
            "gpio",
            "Rangkaian LED langsung tanpa resistor / pin belum dikonfigurasi",
            "Gunakan resistor 220Ω seri dan konfigurasi pinMode yang tepat pada logika 3.3V",
            "safe-gpio-resistor",
        ),
        reflection: ReflectionSpec {
            root_cause_prompt: "Mengapa pin GPIO ESP32 memerlukan resistor seri saat menyalakan LED?",
            evidence_prompt: "Catat hasil pembacaan GPIO dan peringatan rangkaian sebelum vs sesudah memakai resistor 220Ω.",
            transfer_question: "Apa yang terjadi jika komponen 5V dihubungkan langsung ke GPIO ESP32-C3 tanpa level shifter?",
            official_summary: "Proteksi elektrikal dasar meliputi pembatasan arus dengan resistor seri, koneksi GND bersama, dan kepatuhan tegangan 3.3V.",
            key_takeaways: vec![
                "Selalu pasang resistor 220Ω–1kΩ secara seri pada LED.",
                "ESP32-C3 bekerja pada level logika 3.3V.",
                "Jangan pernah menghubungkan pin daya langsung ke GND.",
            ],
        },
    }
}

pub(super) fn lab_iot_esp32_ultrasonic() -> LabDefinition {
    LabDefinition {
        id: "iot-esp32-ultrasonic",
        track: "iot",
        owasp_code: None,
        title: "ESP32-C3: Sensor Jarak HC-SR04, Buzzer & Servo",
        subtitle: "Deteksi jarak objek real-time untuk mengaktifkan alarm buzzer dan gerbang servo PWM",
        objective: "Mengintegrasikan sensor ultrasonik HC-SR04, pemfilteran jarak valid, serta aktuasi Buzzer dan Servo SG90.",
        context: "Simulator interaktif menyediakan slider jarak 2–400 cm pada HC-SR04, Buzzer dengan indikator audio/visual, dan lengan Servo SG90 yang berputar langsung.",
        cwe_id: "CWE-20",
        wstg_ref: "IOT-SENS-02",
        asvs_ref: "IoTSVS SENS-2",
        estimated_minutes: 20,
        prerequisite: "iot-esp32-gpio",
        fixture_actors: vec!["HC-SR04", "Buzzer", "SG90"],
        trust_nodes: esp32_nodes(),
        trust_edges: esp32_edges(),
        hints: [
            "Sambungkan TRIG dan ECHO HC-SR04 ke pin GPIO yang terdefinisi pada sketsa.",
            "Gunakan constrain/validasi rentang jarak (2..400 cm) agar nilai timeout tidak menggerakkan servo keliru.",
            "Cek pergerakan sudut Servo SG90 dan Serial Plotter saat slider jarak digeser.",
        ],
        patch_options: vec![
            PatchOption {
                id: "vulnerable",
                label: "Membaca pulse tanpa validasi rentang jarak",
                summary: "Jarak 0 atau >400 cm langsung memicu alarm dan servo ke posisi ekstrem.",
                is_secure: false,
                feedback: "Nilai timeout atau pembacaan di luar spesifikasi memicu alarm palsu.",
            },
            PatchOption {
                id: "safe-distance-clamp",
                label: "Validasi rentang HC-SR04 (2..400 cm) & kontrol PWM halus",
                summary: "Hanya memicu buzzer dan sudut servo saat pembacaan ultrasonik berada pada rentang sah.",
                is_secure: true,
                feedback: "Sensor HC-SR04 stabil mengendalikan buzzer peringatan dan gerbang servo.",
            },
        ],
        code_stacks: vec![
            CodeStackComparison {
                stack: "Arduino C++ (HC-SR04 + Servo)",
                language: "cpp",
                is_primary: true,
                vulnerable_code: "float cm = ultrasonicRead(5, 6);\nservo.write(cm < 30 ? 90 : 0); // Nilai 0/timeout dianggap dekat!",
                fixed_code: "float cm = ultrasonicRead(5, 6);\nif (cm >= 2 && cm <= 400 && cm < 25) { tone(7, 1000); servo.write(90); }\nelse { noTone(7); servo.write(0); }",
                cause_line: 2,
                fix_line: 2,
                explanation: "Pemeriksaan batas minimum 2 cm dan maksimum 400 cm menghindari false-positive saat echo gagal.",
                doc_url: "https://docs.espressif.com/projects/arduino-esp32/",
            },
            CodeStackComparison {
                stack: "Wiring Checklist",
                language: "text",
                is_primary: false,
                vulnerable_code: "HC-SR04 ECHO tanpa GND bersama",
                fixed_code: "TRIG->GPIO5, ECHO->GPIO6, Buzzer->GPIO7, Servo PWM->GPIO2, VCC->3V3, GND->GND",
                cause_line: 1,
                fix_line: 1,
                explanation: "Semua periferal berbagi referensi GND dan jalur PWM terpisah.",
                doc_url: "https://docs.espressif.com/projects/arduino-esp32/",
            },
        ],
        levels: build_esp32_levels(
            "ultra",
            "Sensor tidak memvalidasi pembacaan 0/timeout sehingga aktuator salah aktif",
            "Validasi rentang fisik 2..400 cm sebelum mengaktifkan Buzzer dan Servo PWM",
            "safe-distance-clamp",
        ),
        reflection: ReflectionSpec {
            root_cause_prompt: "Mengapa pembacaan 0 cm pada sensor ultrasonik sering menandakan timeout alih-alih objek menempel?",
            evidence_prompt: "Lampirkan log Serial Monitor saat slider jarak digeser mendekat < 25 cm vs > 100 cm.",
            transfer_question: "Bagaimana menerapkan hysteresis agar buzzer tidak berkedip cepat di ambang tepat 25 cm?",
            official_summary: "Kendali sensor ke aktuator membutuhkan filter rentang fisik dan referensi ground yang konsisten.",
            key_takeaways: vec![
                "Filter pembacaan di luar spesifikasi sensor (2–400 cm untuk HC-SR04).",
                "Pantau sinyal jarak dengan Serial Plotter secara real-time.",
            ],
        },
    }
}

pub(super) fn lab_iot_esp32_dht_oled() -> LabDefinition {
    LabDefinition {
        id: "iot-esp32-dht-oled",
        track: "iot",
        owasp_code: None,
        title: "ESP32-C3: Sensor DHT22, Serial Plotter & OLED SSD1306",
        subtitle: "Pemantauan suhu dan kelembapan real-time ke layar OLED I2C dan grafik gelombang",
        objective: "Membaca sensor DHT22 melalui bus data serta merender informasi ke OLED SSD1306 (128x64) dan Serial Plotter.",
        context: "Kanvas mensimulasikan layar OLED 128x64 piksel nyata beserta grafik Serial Plotter multi-kanal yang berubah seketika saat suhu atau kelembapan DHT22 diubah.",
        cwe_id: "CWE-754",
        wstg_ref: "IOT-DISP-03",
        asvs_ref: "IoTSVS FW-3",
        estimated_minutes: 20,
        prerequisite: "iot-esp32-gpio",
        fixture_actors: vec!["DHT22", "SSD1306", "I2C"],
        trust_nodes: esp32_nodes(),
        trust_edges: esp32_edges(),
        hints: [
            "Sambungkan jalur I2C OLED: SDA -> GPIO8, SCL -> GPIO9, VCC -> 3V3, dan GND -> GND.",
            "Tambahkan pengecekan NaN / batas suhu sebelum mencetak ke OLED agar tampilan tidak rusak.",
            "Cetak format `temp:28.5,hum:65` via Serial.println untuk melihat dua grafik di Serial Plotter.",
        ],
        patch_options: vec![
            PatchOption {
                id: "vulnerable",
                label: "Menulis ke OLED tanpa membersihkan buffer atau memeriksa nilai NaN",
                summary: "Tampilan OLED menumpuk dan pembacaan cacat tampil sebagai anomali.",
                is_secure: false,
                feedback: "Layar OLED menumpuk dan data telemetri tidak valid.",
            },
            PatchOption {
                id: "safe-oled-i2c",
                label: "Pengecekan batas DHT22 + oled.clear() + pemetaan I2C benar",
                summary: "Membersihkan buffer layar tiap siklus, memvalidasi suhu/kelembapan, dan mengirim telemetri terstruktur.",
                is_secure: true,
                feedback: "OLED SSD1306 dan Serial Plotter menampilkan data suhu/kelembapan dengan bersih.",
            },
        ],
        code_stacks: vec![
            CodeStackComparison {
                stack: "Arduino C++ (DHT22 + SSD1306)",
                language: "cpp",
                is_primary: true,
                vulnerable_code: "oled.setCursor(0, 0);\noled.print(dht.readTemperature()); // Buffer lama tidak dibersihkan!",
                fixed_code: "float t = dht.readTemperature();\nfloat h = dht.readHumidity();\noled.clear();\noled.setCursor(0, 0); oled.println(\"ENV MONITOR\");\noled.println(\"Temp: \" + String(t) + \" C\");\noled.display();",
                cause_line: 2,
                fix_line: 3,
                explanation: "Pemanggilan oled.clear() sebelum redraw dan oled.display() menjaga framebuffer tetap terbaca rapi.",
                doc_url: "https://docs.espressif.com/projects/arduino-esp32/",
            },
            CodeStackComparison {
                stack: "I2C Pinout",
                language: "text",
                is_primary: false,
                vulnerable_code: "SDA/SCL tertukar atau tidak terhubung ke bus I2C",
                fixed_code: "OLED SDA -> GPIO8, OLED SCL -> GPIO9, DHT22 DATA -> GPIO3",
                cause_line: 1,
                fix_line: 1,
                explanation: "Bus I2C memerlukan pin SDA dan SCL terhubung pada jalur masing-masing.",
                doc_url: "https://docs.espressif.com/projects/arduino-esp32/",
            },
        ],
        levels: build_esp32_levels(
            "dht",
            "Tampilan OLED tidak di-clear atau jalur I2C SDA/SCL keliru",
            "Konfigurasi pin I2C tepat (SDA/SCL) disertai validasi nilai DHT22 & oled.clear()",
            "safe-oled-i2c",
        ),
        reflection: ReflectionSpec {
            root_cause_prompt: "Mengapa OLED SSD1306 memerlukan `oled.clear()` sebelum menulis frame baru?",
            evidence_prompt: "Jelaskan perubahan grafik Serial Plotter dan isi layar OLED ketika slider suhu DHT22 dinaikkan.",
            transfer_question: "Bagaimana mengatasi alamat I2C ganda jika ada dua sensor I2C pada bus yang sama?",
            official_summary: "Komunikasi sensor-display berbasis I2C membutuhkan wiring SDA/SCL akurat dan pembaruan framebuffer terkontrol.",
            key_takeaways: vec![
                "Selalu hubungkan SDA & SCL I2C sesuai pinout board.",
                "Gunakan Serial Plotter untuk memverifikasi tren data multi-sensor.",
            ],
        },
    }
}

pub(super) fn lab_iot_esp32_mqtt() -> LabDefinition {
    LabDefinition {
        id: "iot-esp32-mqtt",
        track: "iot",
        owasp_code: None,
        title: "ESP32-C3: Wi-Fi Telemetri & Keamanan MQTT TLS",
        subtitle: "Kirim telemetri sensor LDR/Potensiometer ke broker MQTT dengan autentikasi dan TLS",
        objective: "Menghubungkan ESP32-C3 ke Wi-Fi, mempublikasikan payload JSON terukur, dan mengamankan kanal MQTT dengan TLS serta kredensial aman.",
        context: "Tab Wi-Fi & MQTT Bus di bawah simulator menampilkan lalu lintas paket ESP32 secara langsung serta menandai paket plaintext atau kredensial hardcoded yang rentan disadap.",
        cwe_id: "CWE-319",
        wstg_ref: "IOT-NET-04",
        asvs_ref: "IoTSVS COMM-1",
        estimated_minutes: 25,
        prerequisite: "iot-esp32-dht-oled",
        fixture_actors: vec!["ESP32-C3", "WiFi", "MQTT-TLS"],
        trust_nodes: esp32_nodes(),
        trust_edges: esp32_edges(),
        hints: [
            "Sambungkan Potensiometer atau LDR ke pin ADC (misal GPIO0 / GPIO1).",
            "Gunakan topik terstruktur & broker `mqtts://` (TLS) pada panggilan `mqtt.publish()` atau aktifkan TLS.",
            "Pantau tab Wi-Fi & MQTT Bus di dock bawah untuk memastikan paket terkirim terenkripsi.",
        ],
        patch_options: vec![
            PatchOption {
                id: "vulnerable",
                label: "Publikasi MQTT plaintext (port 1883) tanpa autentikasi perangkat",
                summary: "Data telemetri dan token dikirim terbuka di jaringan lokal.",
                is_secure: false,
                feedback: "Lalu lintas MQTT mudah disadap atau dipalsukan pada jaringan nirkabel.",
            },
            PatchOption {
                id: "safe-mqtt-tls",
                label: "Gunakan MQTT over TLS (mqtts://8883) + validasi ADC",
                summary: "Mengenkripsi kanal MQTT serta memastikan payload JSON dikirim secara terukur.",
                is_secure: true,
                feedback: "Telemetri ESP32-C3 terkirim aman melalui kanal terenkripsi TLS.",
            },
        ],
        code_stacks: vec![
            CodeStackComparison {
                stack: "Arduino C++ (ESP32 Wi-Fi + MQTT)",
                language: "cpp",
                is_primary: true,
                vulnerable_code: "WiFi.begin(\"WebLab-IoT\", \"123456\");\nmqtt.publish(\"sensor/raw\", String(analogRead(0))); // Plaintext!",
                fixed_code: "WiFi.begin(\"WebLab-IoT\", \"lab-secure-key\");\nmqtt.begin(\"mqtts://broker.weblab.local:8883\", true);\nmqtt.publish(\"ifalab/esp32/adc\", \"{\\\"adc\\\":\" + String(analogRead(0)) + \"}\");",
                cause_line: 2,
                fix_line: 2,
                explanation: "Koneksi MQTTS (port 8883 dengan verifikasi sertifikat) menjaga kerahasiaan dan integritas telemetri IoT.",
                doc_url: "https://owasp.org/www-project-internet-of-things/",
            },
            CodeStackComparison {
                stack: "Security Checklist",
                language: "text",
                is_primary: false,
                vulnerable_code: "mqtt://1883 plaintext tanpa sertifikat",
                fixed_code: "mqtts://8883 dengan TLS aktif + JSON terstruktur",
                cause_line: 1,
                fix_line: 1,
                explanation: "Transport enkripsi TLS wajib diaktifkan untuk perangkat lapangan.",
                doc_url: "https://owasp.org/www-project-internet-of-things/",
            },
        ],
        levels: build_esp32_levels(
            "mqtt",
            "Kirim MQTT plaintext lewat port 1883 tanpa proteksi kanal TLS",
            "Aktifkan mqtts:// (TLS port 8883) dan pembacaan ADC terukur",
            "safe-mqtt-tls",
        ),
        reflection: ReflectionSpec {
            root_cause_prompt: "Apa bahaya pengiriman data sensor dan perintah kontrol melalui MQTT tanpa TLS?",
            evidence_prompt: "Bandingkan status paket di tab Wi-Fi & MQTT Bus saat memakai `mqtt://` versus `mqtts://`.",
            transfer_question: "Bagaimana mencegah perangkat kloning memakai ClientID yang sama di broker produksi?",
            official_summary: "Node IoT ESP32 harus menggabungkan wiring ADC yang benar dengan enkripsi transport MQTT TLS.",
            key_takeaways: vec![
                "Hindari MQTT plaintext pada jaringan publik/kampus.",
                "Gunakan sertifikat perangkat atau kredensial unik per node ESP32.",
            ],
        },
    }
}
