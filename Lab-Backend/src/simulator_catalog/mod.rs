use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LevelId {
    Easy,
    Medium,
    Hard,
    Impossible,
}

impl LevelId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Easy => "easy",
            Self::Medium => "medium",
            Self::Hard => "hard",
            Self::Impossible => "impossible",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::Easy => "Easy",
            Self::Medium => "Medium",
            Self::Hard => "Hard",
            Self::Impossible => "Impossible",
        }
    }

    pub fn base_xp(&self) -> i32 {
        match self {
            Self::Easy => 25,
            Self::Medium => 40,
            Self::Hard => 60,
            Self::Impossible => 80,
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "easy" => Some(Self::Easy),
            "medium" => Some(Self::Medium),
            "hard" => Some(Self::Hard),
            "impossible" => Some(Self::Impossible),
            _ => None,
        }
    }

    pub fn all() -> [Self; 4] {
        [Self::Easy, Self::Medium, Self::Hard, Self::Impossible]
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct OwaspCategory {
    pub code: &'static str,
    pub name: &'static str,
    pub summary: &'static str,
    pub impact_example: &'static str,
    pub primary_controls: Vec<&'static str>,
    pub reference_url: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrustNode {
    pub id: &'static str,
    pub label: &'static str,
    pub zone: &'static str,
    pub role: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrustEdge {
    pub from: &'static str,
    pub to: &'static str,
    pub label: &'static str,
    pub crosses_boundary: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CodeStackComparison {
    pub stack: &'static str,
    pub language: &'static str,
    pub is_primary: bool,
    pub vulnerable_code: &'static str,
    pub fixed_code: &'static str,
    pub cause_line: usize,
    pub fix_line: usize,
    pub explanation: &'static str,
    pub doc_url: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct PatchOption {
    pub id: &'static str,
    pub label: &'static str,
    pub summary: &'static str,
    pub is_secure: bool,
    pub feedback: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct LevelSpec {
    pub level: LevelId,
    pub title: &'static str,
    pub scenario: &'static str,
    pub initial_control: &'static str,
    pub pahami_prompt: &'static str,
    pub hypothesis_options: Vec<&'static str>,
    pub correct_hypothesis: usize,
    pub probe_instruction: &'static str,
    pub diagnosis_options: Vec<&'static str>,
    pub correct_diagnosis: usize,
    pub target_patch_id: &'static str,
    pub expected_baseline: &'static str,
    pub expected_exploit: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReflectionSpec {
    pub root_cause_prompt: &'static str,
    pub evidence_prompt: &'static str,
    pub transfer_question: &'static str,
    pub official_summary: &'static str,
    pub key_takeaways: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LabDefinition {
    pub id: &'static str,
    pub track: &'static str,
    pub owasp_code: Option<&'static str>,
    pub title: &'static str,
    pub subtitle: &'static str,
    pub objective: &'static str,
    pub context: &'static str,
    pub cwe_id: &'static str,
    pub wstg_ref: &'static str,
    pub asvs_ref: &'static str,
    pub estimated_minutes: i32,
    pub prerequisite: &'static str,
    pub fixture_actors: Vec<&'static str>,
    pub trust_nodes: Vec<TrustNode>,
    pub trust_edges: Vec<TrustEdge>,
    pub hints: [&'static str; 3],
    pub patch_options: Vec<PatchOption>,
    pub code_stacks: Vec<CodeStackComparison>,
    pub levels: Vec<LevelSpec>,
    pub reflection: ReflectionSpec,
}

pub fn owasp_categories() -> &'static [OwaspCategory] {
    static CATS: OnceLock<Vec<OwaspCategory>> = OnceLock::new();
    CATS.get_or_init(|| vec![
        OwaspCategory {
            code: "A01",
            name: "Broken Access Control",
            summary: "Kegagalan menegakkan batasan otorisasi di sisi server sehingga pengguna dapat mengakses data atau fungsi milik pengguna maupun peran lain.",
            impact_example: "Mahasiswa membaca detail pesanan, invoice, atau dokumen milik akun lain hanya dengan mengganti ID pada permintaan API.",
            primary_controls: vec!["Otorisasi per objek di server (ownership check)", "Kebijakan akses bersama di seluruh rute (detail & invoice)", "Deny-by-default dan verifikasi sesi server-side"],
            reference_url: "https://owasp.org/Top10/2025/",
        },
        OwaspCategory {
            code: "A02",
            name: "Security Misconfiguration",
            summary: "Pengaturan aplikasi, reverse proxy, atau web server yang tidak aman sehingga memaparkan mode debug, stack trace, atau berkas cadangan.",
            impact_example: "Pesan error produksi menampilkan path internal, konfigurasi lingkungan, atau endpoint debug dan berkas backup dapat diunduh publik.",
            primary_controls: vec!["Matikan debug eksternal di profil production", "Error generik dengan correlation ID ke log internal teredaksi", "Blokir akses file backup dan endpoint diagnostik di proxy"],
            reference_url: "https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html",
        },
        OwaspCategory {
            code: "A03",
            name: "Software Supply Chain Failures",
            summary: "Kerentanan akibat dependensi langsung atau transitif yang rentan, ketiadaan lockfile terverifikasi, atau artefak build tanpa provenance sah.",
            impact_example: "Pipeline menerima pustaka rentan atau artefak yang dibangun dari workflow tidak resmi karena hanya mengecek nama tag tanpa digest dan provenance.",
            primary_controls: vec!["Kunci dependensi dengan lockfile (`cargo build --locked` / `npm ci`)", "Pemindaian SCA & SBOM hingga dependensi transitif", "Verifikasi digest dan provenance SLSA dari builder tepercaya"],
            reference_url: "https://slsa.dev/spec/v1.2/verifying-artifacts",
        },
        OwaspCategory {
            code: "A04",
            name: "Cryptographic Failures",
            summary: "Penyimpanan atau transmisi data sensitif dengan algoritma lemah, tanpa salt, atau skema migrasi kredensial yang tidak aman.",
            impact_example: "Kebocoran basis data langsung membuka kata sandi karena disimpan plaintext atau SHA-256 tanpa salt yang rentan brute-force cepat.",
            primary_controls: vec!["Gunakan Argon2id dengan salt acak unik per kredensial", "Tetapkan parameter memori dan waktu terukur", "Migrasi rehash hanya setelah verifikasi password lama berhasil"],
            reference_url: "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html",
        },
        OwaspCategory {
            code: "A05",
            name: "Injection",
            summary: "Masukan tidak tepercaya digabungkan langsung ke interpreter SQL atau dirender sebagai HTML aktif di browser pengguna.",
            impact_example: "Payload pencarian membocorkan produk privat dari basis data (SQLi) atau komentar forum mengeksekusi skrip di sesi pembaca (Stored XSS).",
            primary_controls: vec!["Parameterized query ($1) dan enum allowlist untuk sort dinamis", "Context-aware output encoding dan sanitasi allowlist jika rich text", "Content Security Policy (CSP) sebagai pertahanan berlapis"],
            reference_url: "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
        },
        OwaspCategory {
            code: "A06",
            name: "Insecure Design",
            summary: "Kelemahan arsitektur dan logika bisnis yang memungkinkan penyalahgunaan aturan domain, seperti klaim berulang atau kondisi balapan.",
            impact_example: "Kupon sekali pakai dapat diklaim berkali-kali lewat manipulasi API langsung atau pengiriman dua request paralel bersamaan.",
            primary_controls: vec!["Enforce invariant domain di server, bukan hanya di UI", "Transaksi basis data + unique constraint `(account_id, coupon_id)`", "Operasi atomik `INSERT ... ON CONFLICT DO NOTHING`"],
            reference_url: "https://owasp.org/www-community/vulnerabilities/Business_logic_vulnerability",
        },
        OwaspCategory {
            code: "A07",
            name: "Authentication Failures",
            summary: "Kelemahan pada mekanisme login, pembatasan percobaan, atau alur pemulihan akun yang memudahkan tebakan kata sandi dan penyalahgunaan token.",
            impact_example: "Penyerang melewati rate limit berbasis IP atau menggunakan ulang token reset password dan mendeteksi akun valid dari perbedaan pesan error.",
            primary_controls: vec!["Rate limit atomik per akun dan sinyal sumber dengan jendela waktu", "Respons pemulihan akun yang seragam", "Token pemulihan ter-hash sekali pakai dengan TTL singkat"],
            reference_url: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
        },
        OwaspCategory {
            code: "A08",
            name: "Software or Data Integrity Failures",
            summary: "Aplikasi mempercayai payload webhook atau artefak tanpa memverifikasi tanda tangan byte mentah, kesegaran timestamp, dan perlindungan replay.",
            impact_example: "Penyerang mengirim webhook pembayaran palsu atau memutar ulang event webhook lama untuk melunasi pesanan berulang kali.",
            primary_controls: vec!["Verifikasi HMAC pada byte body mentah sebelum parsing JSON", "Validasi jendela timestamp dalam payload bertanda tangan", "Deduplikasi atomik `(provider, event_id)` dan cocokkan nominal order"],
            reference_url: "https://asvs.owasp.org/",
        },
        OwaspCategory {
            code: "A09",
            name: "Security Logging and Alerting Failures",
            summary: "Ketiadaan pencatatan kegagalan autentikasi terstruktur, ambang deteksi burst/spray, sanitasi log injection, dan pemantauan kegagalan sink.",
            impact_example: "Serangan password spraying terjadi berjam-jam tanpa alert atau input baris baru dari pengguna memalsukan entri log.",
            primary_controls: vec!["Structured logging dengan field tetap dan redaksi rahasia", "Aturan korelasi burst dan spraying berbasis jendela waktu", "Deduplikasi alert dan pemantauan kesehatan jalur sink"],
            reference_url: "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html",
        },
        OwaspCategory {
            code: "A10",
            name: "Mishandling of Exceptional Conditions",
            summary: "Penanganan error atau kegagalan transaksi yang membiarkan perubahan parsial tersimpan (fail-open / tanpa rollback) atau menggandakan efek saat retry.",
            impact_example: "Checkout gagal setelah stok dikurangi sehingga stok hilang tanpa order, atau retry timeout menciptakan dua transaksi ganda.",
            primary_controls: vec!["Satukan mutasi dalam satu transaksi ACID dengan rollback saat gagal", "Propagasi error tanpa catch-and-swallow", "Idempotency key dan pola outbox untuk retry yang aman"],
            reference_url: "https://top10.owasp.org/2025/",
        },
    ])
}

mod iot_mqtt_replay;
mod iot_ota_interlock;
mod web_a01_a03;
mod web_a04_a05;
mod web_a06_a08;
mod web_a09_a10;
use iot_mqtt_replay::{lab_iot_mqtt_acl, lab_iot_replay};
use iot_ota_interlock::{lab_iot_interlock, lab_iot_ota};
use web_a01_a03::{lab_a01_idor, lab_a02_misconfig, lab_a03_supply_chain};
use web_a04_a05::{lab_a04_crypto, lab_a05_sqli, lab_a05_xss};
use web_a06_a08::{lab_a06_coupon, lab_a07_auth, lab_a08_webhook};
use web_a09_a10::{lab_a09_logging, lab_a10_checkout};

pub fn all_labs() -> &'static [LabDefinition] {
    static LABS: OnceLock<Vec<LabDefinition>> = OnceLock::new();
    LABS.get_or_init(build_labs)
}

pub fn find_lab(id: &str) -> Option<&'static LabDefinition> {
    all_labs().iter().find(|l| l.id == id)
}

fn build_labs() -> Vec<LabDefinition> {
    vec![
        lab_a01_idor(),
        lab_a02_misconfig(),
        lab_a03_supply_chain(),
        lab_a04_crypto(),
        lab_a05_sqli(),
        lab_a05_xss(),
        lab_a06_coupon(),
        lab_a07_auth(),
        lab_a08_webhook(),
        lab_a09_logging(),
        lab_a10_checkout(),
        lab_iot_mqtt_acl(),
        lab_iot_replay(),
        lab_iot_ota(),
        lab_iot_interlock(),
    ]
}
