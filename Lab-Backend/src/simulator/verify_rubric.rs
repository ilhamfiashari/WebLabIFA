use super::*;
use crate::simulator_catalog::LevelId;
use serde_json::Value;

pub fn run_verification(
    lab_id: &str,
    level: LevelId,
    selected_patch: Option<&str>,
    state: &Value,
) -> VerificationReport {
    let patch = effective_patch(lab_id, level, selected_patch);
    let cases = build_verification_cases(lab_id);
    let mut rows = Vec::with_capacity(cases.len());

    for (case_id, cat, scenario, inp_desc, expected, probe, expect_fn) in cases {
        let before = execute_probe(
            lab_id,
            LevelId::Easy,
            Some("vulnerable"),
            &default_state(lab_id, LevelId::Easy),
            &probe,
        );
        let after = execute_probe(lab_id, level, Some(patch), state, &probe);
        let passed = expect_fn(&after);
        rows.push(VerificationRow {
            case_id,
            category: cat.into(),
            scenario,
            input: inp_desc,
            expected,
            before_result: format!(
                "HTTP {} · {}",
                before.response.status,
                summarize(&before.response.body)
            ),
            after_result: format!(
                "HTTP {} · {}",
                after.response.status,
                summarize(&after.response.body)
            ),
            evidence: if passed {
                after
                    .events
                    .first()
                    .map_or_else(|| "Memenuhi ekspektasi".into(), |e| e.detail.clone())
            } else {
                format!(
                    "Belum memenuhi: {}",
                    after
                        .events
                        .first()
                        .map_or("cek kembali patch Anda", |e| e.detail.as_str())
                )
            },
            passed,
        });
    }

    let passed_count = rows.iter().filter(|r| r.passed).count();
    let total_count = rows.len();
    VerificationReport {
        all_passed: passed_count == total_count && total_count > 0,
        passed_count,
        total_count,
        rows,
    }
}

fn summarize(body: &str) -> String {
    let short: String = body.chars().take(72).collect();
    if body.len() > 72 {
        format!("{short}…")
    } else {
        short
    }
}

type CaseTuple = (
    String,
    &'static str,
    String,
    String,
    String,
    ProbeInput,
    fn(&ProbeOutcome) -> bool,
);

fn build_verification_cases(lab_id: &str) -> Vec<CaseTuple> {
    match lab_id {
        "a01-idor" => vec![
            (
                "A01-POS".into(),
                "Positif",
                "Akses pesanan milik sendiri (Rani -> #101)".into(),
                "GET /api/orders/101 (Rani)".into(),
                "200 OK dengan objek Rani".into(),
                ProbeInput {
                    action: "order".into(),
                    actor: "rani".into(),
                    target: "101".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && !o.exploit_proved,
            ),
            (
                "A01-NEG-1".into(),
                "Negatif",
                "Akses lintas akun detail (#102 oleh Rani)".into(),
                "GET /api/orders/102 (Rani)".into(),
                "403 Forbidden tanpa DTO".into(),
                ProbeInput {
                    action: "order".into(),
                    actor: "rani".into(),
                    target: "102".into(),
                    ..Default::default()
                },
                |o| o.response.status == 403 && !o.response.body.contains("Bima"),
            ),
            (
                "A01-NEG-2".into(),
                "Negatif",
                "Akses lintas akun invoice (UUID Bima oleh Rani)".into(),
                "GET /api/invoices/9c4e-102 (Rani)".into(),
                "403 Forbidden di jalur invoice".into(),
                ProbeInput {
                    action: "invoice".into(),
                    actor: "rani".into(),
                    target: "9c4e-102".into(),
                    ..Default::default()
                },
                |o| o.response.status == 403 && !o.response.body.contains("Bima"),
            ),
            (
                "A01-REG".into(),
                "Regresi",
                "Permintaan anonim & objek tidak ada".into(),
                "GET /api/orders/101 (anon)".into(),
                "401 Unauthorized".into(),
                ProbeInput {
                    action: "order".into(),
                    actor: "anon".into(),
                    target: "101".into(),
                    ..Default::default()
                },
                |o| o.response.status == 401,
            ),
        ],
        "a02-misconfig" => vec![
            (
                "A02-POS".into(),
                "Positif",
                "Rute sehat tetap normal".into(),
                "GET /api/health".into(),
                "200 OK".into(),
                ProbeInput {
                    action: "health".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200,
            ),
            (
                "A02-NEG-1".into(),
                "Negatif",
                "Error parsing JSON tidak membocorkan stack trace".into(),
                "POST /api/items/parse".into(),
                "400 generik + correlation_id".into(),
                ProbeInput {
                    action: "parse_error".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved && o.response.body.contains("correlation_id"),
            ),
            (
                "A02-NEG-2".into(),
                "Negatif",
                "Fallback proxy & file backup tertutup".into(),
                "GET /backup.sql.bak".into(),
                "404 Not Found".into(),
                ProbeInput {
                    action: "backup_probe".into(),
                    ..Default::default()
                },
                |o| o.response.status == 404 && !o.exploit_proved,
            ),
        ],
        "a03-supply-chain" => vec![
            (
                "A03-POS".into(),
                "Positif",
                "Artefak builder resmi bebas CVE lolos".into(),
                "promote core-clean".into(),
                "200 Promoted".into(),
                ProbeInput {
                    target: "core-clean".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && !o.exploit_proved,
            ),
            (
                "A03-NEG-1".into(),
                "Negatif",
                "Dependensi transitif ber-CVE diblokir".into(),
                "promote transitive-cve".into(),
                "422 Blocked".into(),
                ProbeInput {
                    target: "transitive-cve".into(),
                    ..Default::default()
                },
                |o| o.response.status >= 400 && !o.exploit_proved,
            ),
            (
                "A03-NEG-2".into(),
                "Regresi",
                "Provenance builder asing ditolak".into(),
                "promote untrusted-builder".into(),
                "403 Blocked".into(),
                ProbeInput {
                    target: "untrusted-builder".into(),
                    ..Default::default()
                },
                |o| o.response.status >= 400 && !o.exploit_proved,
            ),
        ],
        "a04-crypto" => vec![
            (
                "A04-POS".into(),
                "Positif",
                "Login sah tetap berhasil".into(),
                "login_valid".into(),
                "200 Authenticated".into(),
                ProbeInput {
                    action: "login_valid".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200,
            ),
            (
                "A04-NEG".into(),
                "Negatif",
                "Salt acak membuat hash Rani & Bima berbeda".into(),
                "inspect_dump".into(),
                "Argon2id dengan salt unik".into(),
                ProbeInput {
                    action: "inspect_dump".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved && o.response.body.contains("argon2id"),
            ),
            (
                "A04-REG".into(),
                "Regresi",
                "Login salah tidak memicu rehash".into(),
                "login_wrong_legacy".into(),
                "401 tanpa mutasi record".into(),
                ProbeInput {
                    action: "login_wrong_legacy".into(),
                    ..Default::default()
                },
                |o| o.response.status == 401 && !o.exploit_proved,
            ),
        ],
        "a05-sqli" => vec![
            (
                "A05-POS".into(),
                "Positif",
                "Pencarian kata kunci sah bertanda kutip".into(),
                "keyword=Kabel'Pro, sort=name_asc".into(),
                "200 OK menemukan Kabel'Pro".into(),
                ProbeInput {
                    payload: "Kabel'Pro".into(),
                    target: "name_asc".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && o.response.body.contains("Kabel'Pro"),
            ),
            (
                "A05-NEG".into(),
                "Negatif",
                "Payload SQLi tidak membocorkan produk private".into(),
                "keyword=' OR '1'='1".into(),
                "200 tanpa data private".into(),
                ProbeInput {
                    payload: "' OR '1'='1".into(),
                    target: "name_asc".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved && !o.response.body.contains("private"),
            ),
            (
                "A05-REG".into(),
                "Regresi",
                "Dynamic ORDER BY ilegal ditolak".into(),
                "sort=(CASE WHEN 1=1)".into(),
                "400 Bad Request".into(),
                ProbeInput {
                    payload: "ESP32".into(),
                    target: "(CASE WHEN 1=1)".into(),
                    ..Default::default()
                },
                |o| o.response.status == 400 && !o.exploit_proved,
            ),
        ],
        "a05-xss" => vec![
            (
                "A05-POS".into(),
                "Positif",
                "Komentar karakter khusus tampil utuh".into(),
                "5 < 10 & aman".into(),
                "200 tanpa DOM event".into(),
                ProbeInput {
                    payload: "5 < 10 & aman".into(),
                    target: "reader".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved,
            ),
            (
                "A05-NEG-1".into(),
                "Negatif",
                "Payload event handler di Pembaca inert".into(),
                "<img src=x onerror=demoAlert()>".into(),
                "dom_alert_triggered: false".into(),
                ProbeInput {
                    payload: "<img src=x onerror=demoAlert()>".into(),
                    target: "reader".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved,
            ),
            (
                "A05-REG".into(),
                "Regresi",
                "Preview Moderator juga merender teks aman".into(),
                "<svg onload=demoAlert()> (mod)".into(),
                "dom_alert_triggered: false".into(),
                ProbeInput {
                    payload: "<svg onload=demoAlert()>".into(),
                    target: "moderator".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved,
            ),
        ],
        "a06-coupon" => vec![
            (
                "A06-POS".into(),
                "Positif",
                "Pengguna sah lain (Bima) tetap bisa klaim 1x".into(),
                "actor=bima, KELAS10".into(),
                "200 OK diskon aktif".into(),
                ProbeInput {
                    actor: "bima".into(),
                    target: "cart-b".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved,
            ),
            (
                "A06-NEG".into(),
                "Negatif",
                "Barrier 2 request paralel dibatasi tepat 1x".into(),
                "actor=rani, parallel=true".into(),
                "Maksimal 1 redeem per akun".into(),
                ProbeInput {
                    actor: "rani".into(),
                    target: "cart-a".into(),
                    parallel: true,
                    ..Default::default()
                },
                |o| !o.exploit_proved,
            ),
            (
                "A06-REG".into(),
                "Regresi",
                "Kupon kedaluwarsa ditolak waktu server".into(),
                "action=expired".into(),
                "422 Unprocessable Entity".into(),
                ProbeInput {
                    action: "expired".into(),
                    actor: "rani".into(),
                    ..Default::default()
                },
                |o| o.response.status == 422 && !o.exploit_proved,
            ),
        ],
        "a07-auth" => vec![
            (
                "A07-POS".into(),
                "Positif",
                "Login sah & recovery seragam berjalan".into(),
                "login_valid".into(),
                "200 OK".into(),
                ProbeInput {
                    action: "login_valid".into(),
                    actor: "10.0.1.9".into(),
                    target: "bima@demo.local".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200,
            ),
            (
                "A07-NEG".into(),
                "Negatif",
                "Burst dengan rotasi IP kena throttle 429".into(),
                "login_burst IP 10.0.1.2".into(),
                "429 Too Many Requests".into(),
                ProbeInput {
                    action: "login_burst".into(),
                    actor: "10.0.1.2".into(),
                    target: "rani@demo.local".into(),
                    ..Default::default()
                },
                |o| o.response.status == 429 && !o.exploit_proved,
            ),
            (
                "A07-REG".into(),
                "Regresi",
                "Recovery anonim seragam (tanpa enumerasi 404)".into(),
                "recovery_probe tidak-ada@demo".into(),
                "200 respons generik".into(),
                ProbeInput {
                    action: "recovery_probe".into(),
                    target: "tidak-ada@demo".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && !o.exploit_proved,
            ),
        ],
        "a08-webhook" => vec![
            (
                "A08-POS".into(),
                "Positif",
                "Webhook sah format spasi bervariasi lolos raw HMAC".into(),
                "spaced_valid_json".into(),
                "200 OK PAID".into(),
                ProbeInput {
                    action: "spaced_valid_json".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && !o.exploit_proved,
            ),
            (
                "A08-NEG".into(),
                "Negatif",
                "Webhook tanpa tanda tangan ditolak".into(),
                "unsigned_tamper".into(),
                "401 Unauthorized".into(),
                ProbeInput {
                    action: "unsigned_tamper".into(),
                    ..Default::default()
                },
                |o| o.response.status == 401 && !o.exploit_proved,
            ),
            (
                "A08-REG".into(),
                "Regresi",
                "Event kedaluwarsa/nominal salah ditolak".into(),
                "expired_or_mismatch".into(),
                "422 ditolak".into(),
                ProbeInput {
                    action: "expired_or_mismatch".into(),
                    ..Default::default()
                },
                |o| o.response.status == 422 && !o.exploit_proved,
            ),
        ],
        "a09-logging" => vec![
            (
                "A09-POS".into(),
                "Positif",
                "Aktivitas normal bebas false alert".into(),
                "dataset=normal".into(),
                "0 alert palsu".into(),
                ProbeInput {
                    action: "normal".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved,
            ),
            (
                "A09-NEG".into(),
                "Negatif",
                "Spraying & burst memicu alert terstruktur".into(),
                "dataset=spray".into(),
                "Alert spray terpicu".into(),
                ProbeInput {
                    action: "spray".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved,
            ),
            (
                "A09-REG".into(),
                "Regresi",
                "Log injection & sink down terpantau aman".into(),
                "dataset=log_injection".into(),
                "Baris baru di-escape JSON".into(),
                ProbeInput {
                    action: "log_injection".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved,
            ),
        ],
        "a10-checkout" => vec![
            (
                "A10-POS".into(),
                "Positif",
                "Checkout valid kurangi 1 stok & buat 1 order".into(),
                "fault=normal".into(),
                "200 OK stok 9, 1 order".into(),
                ProbeInput {
                    action: "normal".into(),
                    target: "idem-pos".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && !o.exploit_proved,
            ),
            (
                "A10-NEG".into(),
                "Negatif",
                "Gagal setelah reserve otomatis rollback".into(),
                "fault=fail_after_reserve".into(),
                "500 + rollback utuh".into(),
                ProbeInput {
                    action: "fail_after_reserve".into(),
                    ..Default::default()
                },
                |o| o.response.status == 500 && !o.exploit_proved,
            ),
            (
                "A10-REG".into(),
                "Regresi",
                "Timeout + retry pakai idempotency key tanpa duplikat".into(),
                "fault=timeout_retry".into(),
                "Tidak ada order ganda".into(),
                ProbeInput {
                    action: "timeout_retry".into(),
                    target: "idem-pos".into(),
                    ..Default::default()
                },
                |o| !o.exploit_proved,
            ),
        ],
        "iot-esp32-gpio" => vec![
            (
                "ESP-GPIO-POS".into(),
                "Positif",
                "LED dengan resistor 220Ω menyala stabil di GPIO2".into(),
                "blink_resistor".into(),
                "SAFE_HIGH".into(),
                ProbeInput {
                    action: "blink_resistor".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && !o.exploit_proved,
            ),
            (
                "ESP-GPIO-NEG".into(),
                "Negatif",
                "Keluaran langsung tanpa resistor ditahan proteksi".into(),
                "direct_no_resistor".into(),
                "BLOCKED 422".into(),
                ProbeInput {
                    action: "direct_no_resistor".into(),
                    ..Default::default()
                },
                |o| o.response.status == 422 && !o.exploit_proved,
            ),
        ],
        "iot-esp32-ultrasonic" => vec![
            (
                "ESP-ULTRA-POS".into(),
                "Positif",
                "Objek dekat valid mengaktifkan alarm & servo 90°".into(),
                "close_valid".into(),
                "200 ACTUATED".into(),
                ProbeInput {
                    action: "close_valid".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && !o.exploit_proved,
            ),
            (
                "ESP-ULTRA-NEG".into(),
                "Negatif",
                "Nilai timeout 0 cm difilter tanpa memicu servo".into(),
                "timeout_zero".into(),
                "422 FILTERED".into(),
                ProbeInput {
                    action: "timeout_zero".into(),
                    ..Default::default()
                },
                |o| o.response.status == 422 && !o.exploit_proved,
            ),
        ],
        "iot-esp32-dht-oled" => vec![
            (
                "ESP-OLED-POS".into(),
                "Positif",
                "Pembacaan suhu & kelembapan tampil bersih di SSD1306".into(),
                "valid_dht".into(),
                "200 RENDER_OK".into(),
                ProbeInput {
                    action: "valid_dht".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && !o.exploit_proved,
            ),
            (
                "ESP-OLED-NEG".into(),
                "Negatif",
                "Data NaN dan layar tidak dibersihkan dicegah".into(),
                "nan_reading".into(),
                "422 GUARDED".into(),
                ProbeInput {
                    action: "nan_reading".into(),
                    ..Default::default()
                },
                |o| o.response.status == 422 && !o.exploit_proved,
            ),
        ],
        "iot-esp32-mqtt" => vec![
            (
                "ESP-MQTT-POS".into(),
                "Positif",
                "Telemetri ESP32 dikirim melalui mqtts://8883 TLS".into(),
                "mqtts://broker.weblab.local:8883".into(),
                "200 TLS_SENT".into(),
                ProbeInput {
                    target: "mqtts://broker.weblab.local:8883".into(),
                    ..Default::default()
                },
                |o| o.response.status == 200 && !o.exploit_proved,
            ),
            (
                "ESP-MQTT-NEG".into(),
                "Negatif",
                "Broker plaintext mqtt://1883 ditolak".into(),
                "mqtt://broker.weblab.local:1883".into(),
                "403 BLOCKED_INSECURE".into(),
                ProbeInput {
                    target: "mqtt://broker.weblab.local:1883".into(),
                    ..Default::default()
                },
                |o| o.response.status == 403 && !o.exploit_proved,
            ),
        ],
        _ => vec![],
    }
}

pub struct RubricInput {
    pub baseline_recorded: bool,
    pub hypothesis_ok: bool,
    pub exploit_proved: bool,
    pub diagnosis_ok: bool,
    pub patch_secure: bool,
    pub verification_passed: bool,
    pub reflection_submitted: bool,
    pub threshold: i32,
}

pub fn calculate_rubric(inp: RubricInput) -> RubricBreakdown {
    let pahami = if inp.baseline_recorded && inp.hypothesis_ok {
        15
    } else if inp.baseline_recorded || inp.hypothesis_ok {
        8
    } else {
        0
    };
    let uji = if inp.exploit_proved { 25 } else { 0 };
    let perbaiki = if inp.diagnosis_ok && inp.patch_secure {
        25
    } else if inp.patch_secure {
        15
    } else {
        0
    };
    let verifikasi = if inp.verification_passed { 25 } else { 0 };
    let refleksi = if inp.reflection_submitted { 10 } else { 0 };
    let total = pahami + uji + perbaiki + verifikasi + refleksi;
    let passed = total >= inp.threshold && inp.verification_passed && inp.reflection_submitted;
    RubricBreakdown {
        pahami,
        uji,
        perbaiki,
        verifikasi,
        refleksi,
        total,
        passed,
    }
}
