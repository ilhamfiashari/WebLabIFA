use crate::simulator::{RubricInput, calculate_rubric, default_state, run_verification};
use crate::simulator_catalog::{LevelId, all_labs, find_lab};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

pub struct SeedReport {
    pub students_created: usize,
    pub students_total: usize,
    pub sessions_seeded: usize,
    pub achievements_seeded: usize,
    pub assignments_seeded: usize,
}

impl SeedReport {
    pub fn to_json(&self) -> Value {
        json!({
            "students_created": self.students_created,
            "students_total": self.students_total,
            "sessions_seeded": self.sessions_seeded,
            "achievements_seeded": self.achievements_seeded,
            "assignments_seeded": self.assignments_seeded,
        })
    }
}

struct SeedStudent {
    nim: &'static str,
    name: &'static str,
    class_id: &'static str,
    passed_labs: &'static [(&'static str, &'static str, i32, i64)],
    in_progress: Option<(&'static str, &'static str, &'static str)>,
    latihan_done: &'static [&'static str],
}

fn deterministic_uuid(tag: &str) -> Uuid {
    let digest = Sha256::digest(tag.as_bytes());
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Uuid::from_bytes(bytes)
}

const SEED_STUDENTS: &[SeedStudent] = &[
    SeedStudent {
        nim: "122140001",
        name: "Rani Puspita",
        class_id: "IF-3A",
        passed_labs: &[
            ("a01-idor", "easy", 96, 5),
            ("a01-idor", "medium", 92, 4),
            ("a05-sqli", "easy", 98, 3),
            ("a05-sqli", "medium", 94, 2),
            ("a05-xss", "easy", 95, 1),
            ("iot-esp32-gpio", "easy", 91, 0),
        ],
        in_progress: Some(("a05-sqli", "hard", "uji")),
        latihan_done: &["web-1-1", "web-1-2", "web-1-3", "web-2-1", "iot-1-1"],
    },
    SeedStudent {
        nim: "122140002",
        name: "Bima Pratama",
        class_id: "IF-3A",
        passed_labs: &[
            ("a01-idor", "easy", 94, 6),
            ("a05-sqli", "easy", 96, 4),
            ("a05-xss", "easy", 90, 2),
            ("a02-misconfig", "easy", 88, 1),
            ("iot-esp32-gpio", "easy", 92, 0),
        ],
        in_progress: Some(("a07-auth", "easy", "perbaiki")),
        latihan_done: &["web-1-1", "web-1-2", "web-1-3", "iot-1-1"],
    },
    SeedStudent {
        nim: "122140003",
        name: "Siti Rahma",
        class_id: "IF-3A",
        passed_labs: &[
            ("a01-idor", "easy", 90, 5),
            ("a05-sqli", "easy", 89, 3),
            ("a04-crypto", "easy", 93, 1),
            ("iot-esp32-ultrasonic", "easy", 87, 0),
        ],
        in_progress: Some(("a05-xss", "easy", "verifikasi")),
        latihan_done: &["web-1-1", "web-1-2", "iot-1-1"],
    },
    SeedStudent {
        nim: "122140004",
        name: "Bagas Aditya",
        class_id: "IF-3A",
        passed_labs: &[
            ("a01-idor", "easy", 84, 4),
            ("a05-sqli", "easy", 86, 2),
            ("a03-supply-chain", "easy", 82, 1),
        ],
        in_progress: Some(("a02-misconfig", "easy", "uji")),
        latihan_done: &["web-1-1", "web-1-2"],
    },
    SeedStudent {
        nim: "122140005",
        name: "Nadia Kusuma",
        class_id: "IF-3A",
        passed_labs: &[("a01-idor", "easy", 88, 6), ("a05-xss", "easy", 85, 3)],
        in_progress: Some(("a05-sqli", "easy", "pahami")),
        latihan_done: &["web-1-1"],
    },
    SeedStudent {
        nim: "122140006",
        name: "Fajar Nugroho",
        class_id: "IF-3A",
        passed_labs: &[("a05-sqli", "easy", 81, 2)],
        in_progress: Some(("a01-idor", "easy", "uji")),
        latihan_done: &["web-1-1"],
    },
    SeedStudent {
        nim: "122140007",
        name: "Aulia Zahra",
        class_id: "IF-3B",
        passed_labs: &[
            ("a01-idor", "easy", 98, 5),
            ("a01-idor", "medium", 95, 4),
            ("a05-sqli", "easy", 97, 3),
            ("a05-xss", "easy", 94, 2),
            ("a07-auth", "easy", 91, 1),
            ("iot-esp32-dht-oled", "easy", 93, 0),
        ],
        in_progress: Some(("a05-sqli", "medium", "verifikasi")),
        latihan_done: &[
            "web-1-1", "web-1-2", "web-1-3", "web-2-1", "iot-1-1", "iot-1-2",
        ],
    },
    SeedStudent {
        nim: "122140008",
        name: "Dimas Saputra",
        class_id: "IF-3B",
        passed_labs: &[
            ("a01-idor", "easy", 90, 4),
            ("a05-sqli", "easy", 88, 2),
            ("a08-webhook", "easy", 85, 1),
        ],
        in_progress: Some(("a06-coupon", "easy", "perbaiki")),
        latihan_done: &["web-1-1", "web-1-2", "iot-1-1"],
    },
    SeedStudent {
        nim: "122140009",
        name: "Tari Lestari",
        class_id: "IF-3B",
        passed_labs: &[("a05-xss", "easy", 86, 3), ("a09-logging", "easy", 83, 1)],
        in_progress: Some(("a05-sqli", "easy", "uji")),
        latihan_done: &["web-1-1"],
    },
    SeedStudent {
        nim: "122140010",
        name: "Reza Mahendra",
        class_id: "IF-3B",
        passed_labs: &[("a01-idor", "easy", 82, 2)],
        in_progress: Some(("a10-checkout", "easy", "pahami")),
        latihan_done: &[],
    },
    SeedStudent {
        nim: "122140011",
        name: "Putri Wulandari",
        class_id: "IF-4A",
        passed_labs: &[
            ("iot-esp32-gpio", "easy", 97, 4),
            ("iot-esp32-gpio", "medium", 94, 3),
            ("iot-esp32-ultrasonic", "easy", 93, 2),
            ("iot-esp32-dht-oled", "easy", 95, 1),
            ("iot-esp32-mqtt", "easy", 92, 0),
        ],
        in_progress: Some(("iot-esp32-ultrasonic", "medium", "perbaiki")),
        latihan_done: &["iot-1-1", "iot-1-2", "iot-1-3", "web-1-1"],
    },
    SeedStudent {
        nim: "122140012",
        name: "Hendri Kurniawan",
        class_id: "IF-4A",
        passed_labs: &[
            ("iot-esp32-gpio", "easy", 89, 3),
            ("iot-esp32-ultrasonic", "easy", 84, 1),
            ("iot-esp32-mqtt", "easy", 86, 0),
        ],
        in_progress: Some(("iot-esp32-dht-oled", "easy", "uji")),
        latihan_done: &["iot-1-1", "iot-1-2"],
    },
];

pub async fn seed_demo_data(
    pool: &PgPool,
    triggered_by: Option<Uuid>,
) -> Result<SeedReport, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Pastikan seluruh kelas aktif tersedia
    for (id, name, course, lb) in [
        (
            "IF-3A",
            "IF-3A · Keamanan Informasi",
            "IF3101 Keamanan Web & Jaringan",
            true,
        ),
        (
            "IF-3B",
            "IF-3B · Keamanan Informasi",
            "IF3101 Keamanan Web & Jaringan",
            true,
        ),
        ("IF-4A", "IF-4A · IoT", "IF4204 Sistem IoT & Tertanam", true),
    ] {
        sqlx::query(
            "INSERT INTO classes (id,name,course,semester,timezone,leaderboard_enabled,active) VALUES($1,$2,$3,'Ganjil 2026/2027','Asia/Jakarta',$4,true) ON CONFLICT (id) DO UPDATE SET leaderboard_enabled=EXCLUDED.leaderboard_enabled,active=true",
        )
        .bind(id)
        .bind(name)
        .bind(course)
        .bind(lb)
        .execute(&mut *tx)
        .await?;
    }

    // Pastikan semua modul lab terdaftar
    for lab in all_labs() {
        sqlx::query(
            "INSERT INTO lab_modules (lab_id,track,owasp_code,status,version) VALUES($1,$2,$3,'Terbit','1.0.0') ON CONFLICT (lab_id) DO NOTHING",
        )
        .bind(lab.id)
        .bind(lab.track)
        .bind(lab.owasp_code)
        .execute(&mut *tx)
        .await?;
    }

    // Tautkan seluruh akun dosen ke tiga kelas standar agar dashboard & leaderboard langsung terisi
    let lecturer_ids: Vec<(Uuid,)> =
        sqlx::query_as("SELECT DISTINCT user_id FROM user_roles WHERE role='dosen'")
            .fetch_all(&mut *tx)
            .await?;
    for (lid,) in lecturer_ids {
        for cid in ["IF-3A", "IF-3B", "IF-4A"] {
            sqlx::query(
                "INSERT INTO class_memberships (class_id,user_id,role_in_class) VALUES($1,$2,'dosen') ON CONFLICT DO NOTHING",
            )
            .bind(cid)
            .bind(lid)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Pastikan mahasiswa login aktif yang belum tergabung kelas otomatis masuk ke IF-3A
    let orphan_students: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT DISTINCT ur.user_id FROM user_roles ur WHERE ur.role='mahasiswa' AND NOT EXISTS (SELECT 1 FROM class_memberships cm WHERE cm.user_id=ur.user_id AND cm.role_in_class='mahasiswa')",
    )
    .fetch_all(&mut *tx)
    .await?;
    for (uid,) in orphan_students {
        sqlx::query(
            "INSERT INTO class_memberships (class_id,user_id,role_in_class) VALUES('IF-3A',$1,'mahasiswa') ON CONFLICT DO NOTHING",
        )
        .bind(uid)
        .execute(&mut *tx)
        .await?;
    }

    // Penugasan demo idempoten untuk tiap kelas (hanya 2 jalur: Cyber Security = web, IoT = iot)
    let mut assignments_seeded = 0usize;
    let seed_assignments = [
        (
            "asg-if3a-idor",
            "IF-3A",
            "Tugas 1 · Audit IDOR Pesanan",
            "a01-idor",
            "web",
            "medium",
            7,
            "Audit kerentanan Broken Access Control pada endpoint profil & pesanan yang mempercayai parameter client tanpa verifikasi kepemilikan sesi.",
            "1. Jalankan baseline dengan akun pemilik.\n2. Uji eksploitasi IDOR memakai ID akun lain.\n3. Terapkan patch verifikasi ownership sesi.\n4. Jalankan verifikasi penuh dan isi refleksi.",
        ),
        (
            "asg-if3a-sqli",
            "IF-3A",
            "Tugas 2 · SQL Injection & Parameterized Query",
            "a05-sqli",
            "web",
            "medium",
            14,
            "Evaluasi form login dan pencarian yang rentan manipulasi string SQL, lalu perbaiki dengan prepared statement.",
            "1. Rekam respons normal.\n2. Uji payload injeksi autentikasi.\n3. Pilih patch parameterized query.\n4. Lengkapi matriks verifikasi dan refleksi.",
        ),
        (
            "asg-if3a-xss",
            "IF-3A",
            "Tugas 3 · Stored XSS & Output Encoding",
            "a05-xss",
            "web",
            "easy",
            21,
            "Identifikasi eksekusi skrip berbahaya pada kolom komentar/profil dan terapkan sanitasi serta Content Security Policy.",
            "1. Uji input HTML berbahaya.\n2. Terapkan output encoding & CSP.\n3. Verifikasi kasus positif, negatif, dan regresi.",
        ),
        (
            "asg-if3b-sqli",
            "IF-3B",
            "Tugas 1 · SQL Injection Login & Search",
            "a05-sqli",
            "web",
            "easy",
            10,
            "Praktikum dasar deteksi dan mitigasi SQL Injection pada halaman autentikasi.",
            "1. Pahami batas kepercayaan database.\n2. Uji injeksi dasar.\n3. Terapkan patch prepared statement.",
        ),
        (
            "asg-if3b-auth",
            "IF-3B",
            "Tugas 2 · Rate Limit & Enumerasi Akun",
            "a07-auth",
            "web",
            "easy",
            18,
            "Analisis kebocoran status akun melalui pesan error login yang berbeda dan terapkan pembatasan laju percobaan.",
            "1. Bandingkan respons email terdaftar vs tidak.\n2. Pilih kontrol pesan generik dan rate limit.",
        ),
        (
            "asg-if4a-esp32-gpio",
            "IF-4A",
            "Tugas 1 · ESP32-C3 Kontrol GPIO, LED & Proteksi Resistor",
            "iot-esp32-gpio",
            "iot",
            "easy",
            12,
            "Rangkai sirkuit LED seri resistor 220 ohm pada pin GPIO ESP32-C3 serta pastikan tidak ada korsleting atau arus berlebih.",
            "1. Pasang ESP32-C3, LED, dan resistor di kanvas.\n2. Jalankan kode Arduino C++.\n3. Verifikasi log Serial & kelistrikan aman.",
        ),
        (
            "asg-if4a-esp32-mqtt",
            "IF-4A",
            "Tugas 2 · ESP32-C3 Wi-Fi Telemetri & MQTT TLS",
            "iot-esp32-mqtt",
            "iot",
            "easy",
            20,
            "Konfigurasikan koneksi Wi-Fi ESP32-C3 agar mengirim paket telemetri sensor melalui broker terenkripsi mqtts://.",
            "1. Hubungkan ESP32-C3 ke Wi-Fi.\n2. Kirim telemetri lewat mqtts:// dengan validasi sertifikat.",
        ),
    ];
    let default_rubric = serde_json::json!([
        { "criterion": "Identifikasi Skenario & Batas Kepercayaan", "weight": 20 },
        { "criterion": "Bukti Pengujian / Simulasi Akurat", "weight": 25 },
        { "criterion": "Pemilihan Perbaikan / Patch Tepat", "weight": 30 },
        { "criterion": "Verifikasi & Refleksi Konsep", "weight": 25 }
    ]);
    for (key, class_id, title, lab_id, track, level, days, desc, instr) in seed_assignments {
        let aid = deterministic_uuid(key);
        let res = sqlx::query(
            "INSERT INTO assignments (id,class_id,title,lab_id,track,required_level,due_at,pass_threshold,allow_hints,description,instructions,rubric_json) VALUES($1,$2,$3,$4,$5,$6,now()+($7 || ' days')::interval,80,true,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET track=EXCLUDED.track, description=CASE WHEN assignments.description='' THEN EXCLUDED.description ELSE assignments.description END, instructions=CASE WHEN assignments.instructions='' THEN EXCLUDED.instructions ELSE assignments.instructions END, rubric_json=CASE WHEN assignments.rubric_json='[]'::jsonb THEN EXCLUDED.rubric_json ELSE assignments.rubric_json END",
        )
        .bind(aid)
        .bind(class_id)
        .bind(title)
        .bind(lab_id)
        .bind(track)
        .bind(level)
        .bind(days.to_string())
        .bind(desc)
        .bind(instr)
        .bind(&default_rubric)
        .execute(&mut *tx)
        .await?;
        if res.rows_affected() > 0 {
            assignments_seeded += 1;
        }
    }

    let mut students_created = 0usize;
    let mut sessions_seeded = 0usize;
    let mut achievements_seeded = 0usize;

    for stu in SEED_STUDENTS {
        let email = format!("{}@student.itera.ac.id", stu.nim);
        let subject = format!("seed-{}", stu.nim);
        let candidate_id = deterministic_uuid(&format!("user:{email}"));

        // Jika email mahasiswa sudah ada di database (mis. pernah login Google), pakai akun tersebut.
        let existing: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM users WHERE lower(email)=$1 LIMIT 1")
                .bind(&email)
                .fetch_optional(&mut *tx)
                .await?;

        let user_id = if let Some((id,)) = existing {
            id
        } else {
            sqlx::query(
                "INSERT INTO users (id,issuer,subject,name,email,role,active,workspace_domain,access_initialized) VALUES($1,'https://seed.weblabifa.local',$2,$3,$4,'mahasiswa',true,'student.itera.ac.id',true)",
            )
            .bind(candidate_id)
            .bind(&subject)
            .bind(stu.name)
            .bind(&email)
            .execute(&mut *tx)
            .await?;
            students_created += 1;
            candidate_id
        };

        sqlx::query(
            "INSERT INTO user_roles (user_id,role) VALUES($1,'mahasiswa') ON CONFLICT DO NOTHING",
        )
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO class_memberships (class_id,user_id,role_in_class) VALUES($1,$2,'mahasiswa') ON CONFLICT DO NOTHING",
        )
        .bind(stu.class_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        // Sesi lulus & pencapaian XP
        let mut badge_first = false;
        let mut badge_patch = false;
        for (lab_id, level_str, target_score, days_ago) in stu.passed_labs {
            let Some(lab) = find_lab(lab_id) else {
                continue;
            };
            let Some(level) = LevelId::parse(level_str) else {
                continue;
            };
            let Some(level_spec) = lab.levels.iter().find(|lv| lv.level == level) else {
                continue;
            };
            let secure_patch = lab
                .patch_options
                .iter()
                .find(|p| p.is_secure)
                .map(|p| p.id)
                .unwrap_or("secure-patch");
            let report = run_verification(
                lab_id,
                level,
                Some(secure_patch),
                &default_state(lab_id, level),
            );
            let rubric = calculate_rubric(RubricInput {
                baseline_recorded: true,
                hypothesis_ok: true,
                exploit_proved: true,
                diagnosis_ok: true,
                patch_secure: true,
                verification_passed: true,
                reflection_submitted: true,
                threshold: 80,
            });
            let sid = deterministic_uuid(&format!("session:{}:{lab_id}:{level_str}", stu.nim));
            let ver_json = serde_json::to_value(&report.rows).unwrap_or_else(|_| json!([]));
            let refl_json = json!({
                "root_cause": format!("Kontrol batas kepercayaan pada {} belum tervalidasi ketat.", lab.title),
                "evidence": format!("Payload uji berhasil membuktikan celah dan verifikasi regresi setelah patch {} lulus {}/{} uji.", secure_patch, report.passed_count, report.total_count),
                "transfer": "Validasi server-side, prinsip least privilege, dan regresi otomatis diterapkan konsisten.",
                "rubric": {
                    "pahami": rubric.pahami,
                    "uji": rubric.uji,
                    "perbaiki": rubric.perbaiki,
                    "verifikasi": rubric.verifikasi,
                    "refleksi": rubric.refleksi,
                    "total": target_score,
                    "passed": true
                }
            });
            let days_str = days_ago.to_string();
            let res = sqlx::query(
                "INSERT INTO lab_sessions (id,user_id,lab_id,level_id,scenario_version,current_step,selected_patch,hypothesis,diagnosis,hints_opened,baseline_recorded,exploit_proved,verification_passed,reflection_submitted,score,passed,state_json,verification_json,reflection_json,row_version,started_at,updated_at,completed_at) VALUES($1,$2,$3,$4,'2026.1','refleksi',$5,$6,$7,0,true,true,true,true,$8,true,$9,$10,$11,5,now()-($12 || ' days')::interval-interval '25 minutes',now()-($12 || ' days')::interval,now()-($12 || ' days')::interval) ON CONFLICT (id) DO NOTHING",
            )
            .bind(sid)
            .bind(user_id)
            .bind(lab_id)
            .bind(level_str)
            .bind(secure_patch)
            .bind(level_spec.correct_hypothesis.to_string())
            .bind(level_spec.correct_diagnosis.to_string())
            .bind(*target_score)
            .bind(default_state(lab_id, level))
            .bind(ver_json)
            .bind(refl_json)
            .bind(&days_str)
            .execute(&mut *tx)
            .await?;
            if res.rows_affected() > 0 {
                sessions_seeded += 1;
            }

            let ach_key = format!("lab:{lab_id}:{level_str}");
            let ach_res = sqlx::query(
                "INSERT INTO lab_achievements (user_id,achievement_key,xp,earned_at) VALUES($1,$2,$3,now()-($4 || ' days')::interval) ON CONFLICT (user_id,achievement_key) DO NOTHING",
            )
            .bind(user_id)
            .bind(&ach_key)
            .bind(level.base_xp())
            .bind(&days_str)
            .execute(&mut *tx)
            .await?;
            if ach_res.rows_affected() > 0 {
                achievements_seeded += 1;
            }
            badge_first = true;
            badge_patch = true;
        }

        if badge_first {
            let r1 = sqlx::query(
                "INSERT INTO lab_achievements (user_id,achievement_key,xp) VALUES($1,'badge:bukti-pertama',20) ON CONFLICT (user_id,achievement_key) DO NOTHING",
            )
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
            if r1.rows_affected() > 0 {
                achievements_seeded += 1;
            }
        }
        if badge_patch {
            let r2 = sqlx::query(
                "INSERT INTO lab_achievements (user_id,achievement_key,xp) VALUES($1,'badge:perbaikan-teruji',30) ON CONFLICT (user_id,achievement_key) DO NOTHING",
            )
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
            if r2.rows_affected() > 0 {
                achievements_seeded += 1;
            }
        }

        if let Some((lab_id, level_str, step)) = stu.in_progress
            && let Some(level) = LevelId::parse(level_str)
        {
            let sid = deterministic_uuid(&format!("session-wip:{}:{lab_id}:{level_str}", stu.nim));
            let baseline = step != "pahami";
            let exploit = matches!(step, "perbaiki" | "verifikasi");
            let res = sqlx::query(
                "INSERT INTO lab_sessions (id,user_id,lab_id,level_id,scenario_version,current_step,baseline_recorded,exploit_proved,verification_passed,reflection_submitted,passed,state_json,row_version,started_at,updated_at) VALUES($1,$2,$3,$4,'2026.1',$5,$6,$7,false,false,false,$8,2,now()-interval '2 hours',now()-interval '15 minutes') ON CONFLICT (id) DO NOTHING",
            )
            .bind(sid)
            .bind(user_id)
            .bind(lab_id)
            .bind(level_str)
            .bind(step)
            .bind(baseline)
            .bind(exploit)
            .bind(default_state(lab_id, level))
            .execute(&mut *tx)
            .await?;
            if res.rows_affected() > 0 {
                sessions_seeded += 1;
            }
        }

        for ex_id in stu.latihan_done {
            sqlx::query(
                "INSERT INTO exercise_progress (user_id,exercise_id,attempts,hint_used,points,completed_at) VALUES($1,$2,1,false,10,now()-interval '1 day') ON CONFLICT (user_id,exercise_id) DO NOTHING",
            )
            .bind(user_id)
            .bind(ex_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    sqlx::query(
        "INSERT INTO platform_audit_logs (id,actor_id,kind,title,target,result) VALUES($1,$2,'Seed','Inisialisasi data seed mahasiswa & sesi lab',$3,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(triggered_by)
    .bind(format!("{} mahasiswa ({}@student.itera.ac.id)", SEED_STUDENTS.len(), "xxx140xxx"))
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    crate::security_account::seed_security_demo_data(pool).await;

    Ok(SeedReport {
        students_created,
        students_total: SEED_STUDENTS.len(),
        sessions_seeded,
        achievements_seeded,
        assignments_seeded,
    })
}
