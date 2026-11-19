// Data contoh untuk dasbor Admin. Backend belum menyediakan API admin,
// sehingga seluruh angka di sini deterministik dan selalu diberi label "Data contoh".

export type RangeKey = '4w' | '8w' | '12w'
export type Role = 'Mahasiswa' | 'Dosen' | 'Admin'
export type AccessStatus = 'Aktif' | 'Nonaktif' | 'Ditangguhkan'
export type PubStatus = 'Draft' | 'Review' | 'Terbit'
export type Track = 'Web' | 'IoT'

export const RANGES: Array<{ key: RangeKey; label: string; weeks: number }> = [
  { key: '4w', label: '4 minggu terakhir', weeks: 4 },
  { key: '8w', label: '8 minggu terakhir', weeks: 8 },
  { key: '12w', label: '12 minggu terakhir', weeks: 12 },
]

export interface ClassInfo { id: string; name: string; course: string; lecturer: string; students: number; semester: string; share: number; completion: number; schedule: string }

export const CLASSES: ClassInfo[] = [
  { id: 'IF-3A', name: 'IF-3A', course: 'Keamanan Aplikasi Web', lecturer: 'Arif Nugraha', students: 38, semester: 'Ganjil 2026/2027', share: 0.22, completion: 72, schedule: 'Senin, 08.00' },
  { id: 'IF-3B', name: 'IF-3B', course: 'Keamanan Aplikasi Web', lecturer: 'Arif Nugraha', students: 36, semester: 'Ganjil 2026/2027', share: 0.2, completion: 64, schedule: 'Selasa, 10.00' },
  { id: 'IF-3C', name: 'IF-3C', course: 'Keamanan Aplikasi Web', lecturer: 'Yoga Pranata', students: 35, semester: 'Ganjil 2026/2027', share: 0.18, completion: 58, schedule: 'Rabu, 13.00' },
  { id: 'IF-5A', name: 'IF-5A', course: 'IoT', lecturer: 'Yoga Pranata', students: 30, semester: 'Ganjil 2026/2027', share: 0.16, completion: 47, schedule: 'Kamis, 08.00' },
  { id: 'IF-5B', name: 'IF-5B', course: 'IoT', lecturer: 'Sari Wulandari', students: 28, semester: 'Ganjil 2026/2027', share: 0.14, completion: 41, schedule: 'Kamis, 13.00' },
  { id: 'IF-7A', name: 'IF-7A', course: 'Pengujian Penetrasi', lecturer: 'Sari Wulandari', students: 18, semester: 'Ganjil 2026/2027', share: 0.1, completion: 83, schedule: 'Jumat, 09.00' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export function shortDate(date: Date) { return `${date.getDate()} ${MONTHS[date.getMonth()]}` }

// Minggu terakhir yang lengkap berawal 9 Nov 2026.
const LAST_WEEK = new Date(2026, 10, 9)
const BASE_ACCOUNTS = [41, 44, 39, 47, 52, 49, 55, 58, 52, 75, 70, 92]
const BASE_SESSIONS = [48, 57, 51, 63, 70, 66, 74, 81, 62, 100, 95, 142]

export interface WeekPoint { label: string; value: number }

function weeks(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(LAST_WEEK); d.setDate(d.getDate() - (count - 1 - i) * 7); return shortDate(d)
  })
}

function scale(classId: string) { return classId === 'all' ? 1 : (CLASSES.find(c => c.id === classId)?.share ?? 1) }

export function activitySeries(range: RangeKey, classId: string) {
  const count = RANGES.find(r => r.key === range)!.weeks
  const labels = weeks(count)
  const k = scale(classId)
  const slice = <T,>(a: T[]) => a.slice(a.length - count)
  return {
    accounts: slice(BASE_ACCOUNTS).map((v, i) => ({ label: labels[i], value: Math.round(v * k) })),
    sessions: slice(BASE_SESSIONS).map((v, i) => ({ label: labels[i], value: Math.round(v * k) })),
  }
}

export function kpis(range: RangeKey, classId: string) {
  const s = activitySeries(range, classId)
  const sum = (a: WeekPoint[]) => a.reduce((t, p) => t + p.value, 0)
  const half = Math.floor(s.sessions.length / 2)
  const recent = sum(s.sessions.slice(half)), prior = sum(s.sessions.slice(0, half))
  const cls = CLASSES.find(c => c.id === classId)
  return {
    activeAccounts: classId === 'all' ? 128 : cls!.students + 1,
    activeClasses: classId === 'all' ? CLASSES.length : 1,
    publishedLabs: MODULES.filter(m => m.status === 'Terbit' && m.track === 'Web').length,
    owaspCovered: new Set(MODULES.filter(m => m.status === 'Terbit' && m.owasp).map(m => m.owasp)).size,
    sessionsTotal: sum(s.sessions),
    sessionsTrend: prior ? Math.round(((recent - prior) / prior) * 100) : 0,
  }
}

export const OWASP: Array<{ code: string; name: string }> = [
  { code: 'A01', name: 'Broken Access Control' },
  { code: 'A02', name: 'Security Misconfiguration' },
  { code: 'A03', name: 'Software Supply Chain Failures' },
  { code: 'A04', name: 'Cryptographic Failures' },
  { code: 'A05', name: 'Injection' },
  { code: 'A06', name: 'Insecure Design' },
  { code: 'A07', name: 'Authentication Failures' },
  { code: 'A08', name: 'Software or Data Integrity Failures' },
  { code: 'A09', name: 'Security Logging & Alerting Failures' },
  { code: 'A10', name: 'Mishandling of Exceptional Conditions' },
]

export interface Module { id: string; title: string; track: Track; owasp: string | null; status: PubStatus; author: string; updated: string; level: 'Dasar' | 'Menengah' | 'Lanjut'; attempts: number; passRate: number | null }

export const MODULES: Module[] = [
  { id: 'web-idor', title: 'IDOR pada API nilai', track: 'Web', owasp: 'A01', status: 'Terbit', author: 'Yoga Pranata', updated: '15 Nov 2026', level: 'Dasar', attempts: 212, passRate: 78 },
  { id: 'web-sqli', title: 'SQL injection pada form login', track: 'Web', owasp: 'A05', status: 'Terbit', author: 'Arif Nugraha', updated: '6 Nov 2026', level: 'Dasar', attempts: 341, passRate: 71 },
  { id: 'web-xss', title: 'Stored XSS pada forum kelas', track: 'Web', owasp: 'A05', status: 'Terbit', author: 'Arif Nugraha', updated: '2 Nov 2026', level: 'Menengah', attempts: 187, passRate: 59 },
  { id: 'web-supply', title: 'Dependency confusion paket npm', track: 'Web', owasp: 'A03', status: 'Review', author: 'Yoga Pranata', updated: '13 Nov 2026', level: 'Lanjut', attempts: 0, passRate: null },
  { id: 'web-auth', title: 'Brute force dan rate limit login', track: 'Web', owasp: 'A07', status: 'Review', author: 'Sari Wulandari', updated: '12 Nov 2026', level: 'Menengah', attempts: 0, passRate: null },
  { id: 'web-header', title: 'Header keamanan yang hilang', track: 'Web', owasp: 'A02', status: 'Draft', author: 'Sari Wulandari', updated: '9 Nov 2026', level: 'Dasar', attempts: 0, passRate: null },
  { id: 'web-crypto', title: 'Penyimpanan kata sandi lemah', track: 'Web', owasp: 'A04', status: 'Draft', author: 'Arif Nugraha', updated: '4 Nov 2026', level: 'Menengah', attempts: 0, passRate: null },
  { id: 'web-ssrf', title: 'SSRF pada pratinjau tautan', track: 'Web', owasp: 'A01', status: 'Draft', author: 'Yoga Pranata', updated: '28 Okt 2026', level: 'Lanjut', attempts: 0, passRate: null },
  { id: 'iot-esp32-gpio', title: 'ESP32-C3: Kontrol GPIO, LED & Proteksi Resistor', track: 'IoT', owasp: null, status: 'Terbit', author: 'Yoga Pranata', updated: '30 Okt 2026', level: 'Dasar', attempts: 96, passRate: 82 },
  { id: 'iot-esp32-ultrasonic', title: 'ESP32-C3: Sensor Jarak HC-SR04, Buzzer & Servo', track: 'IoT', owasp: null, status: 'Terbit', author: 'Sari Wulandari', updated: '11 Nov 2026', level: 'Menengah', attempts: 64, passRate: 78 },
  { id: 'iot-esp32-mqtt', title: 'ESP32-C3: Wi-Fi Telemetri & Keamanan MQTT TLS', track: 'IoT', owasp: null, status: 'Review', author: 'Yoga Pranata', updated: '7 Nov 2026', level: 'Lanjut', attempts: 0, passRate: null },
]

export function owaspCoverage() {
  return OWASP.map(o => {
    const mods = MODULES.filter(m => m.owasp === o.code)
    const published = mods.filter(m => m.status === 'Terbit').length
    const review = mods.some(m => m.status === 'Review')
    return { ...o, published, total: mods.length, state: published ? 'Terbit' as const : review ? 'Review' as const : 'Draft' as const }
  })
}

export interface User { id: string; name: string; initials: string; nim?: string; role: Role; status: AccessStatus; lastActive: string; classId?: string; grants: Role[] }

const PEOPLE: Array<[string, string | undefined, Role, AccessStatus, string, string | undefined]> = [
  ['Nadia Pratama', '123140051', 'Mahasiswa', 'Aktif', '14 Nov 2026', 'IF-3A'],
  ['Arif Nugraha', undefined, 'Dosen', 'Aktif', '13 Nov 2026', undefined],
  ['Dian Putri', '123140077', 'Mahasiswa', 'Nonaktif', '11 Nov 2026', 'IF-3B'],
  ['Raka Saputra', '123140102', 'Mahasiswa', 'Aktif', '14 Nov 2026', 'IF-3A'],
  ['Sinta Lestari', '122140018', 'Mahasiswa', 'Aktif', '12 Nov 2026', 'IF-5A'],
  ['Sari Wulandari', undefined, 'Dosen', 'Aktif', '14 Nov 2026', undefined],
  ['Yoga Pranata', undefined, 'Admin', 'Aktif', '15 Nov 2026', undefined],
  ['Bima Ramadhan', '121140033', 'Mahasiswa', 'Ditangguhkan', '2 Nov 2026', 'IF-7A'],
  ['Citra Ayu', '123140119', 'Mahasiswa', 'Aktif', '15 Nov 2026', 'IF-3C'],
  ['Fajar Hidayat', '122140045', 'Mahasiswa', 'Aktif', '13 Nov 2026', 'IF-5B'],
  ['Gita Maharani', '123140008', 'Mahasiswa', 'Aktif', '10 Nov 2026', 'IF-3B'],
  ['Hendra Kusuma', '121140061', 'Mahasiswa', 'Nonaktif', '20 Okt 2026', 'IF-7A'],
]

export const USERS: User[] = PEOPLE.map(([name, nim, role, status, lastActive, classId], i) => ({
  id: `u${i + 1}`, name, nim, role, status, lastActive, classId,
  initials: name.split(' ').slice(0, 2).map(p => p[0]).join(''),
  grants: role === 'Admin' ? ['Dosen', 'Admin'] : [role],
}))

export const ROLE_TOTALS: Array<{ label: Role; value: number }> = [
  { label: 'Mahasiswa', value: 121 }, { label: 'Dosen', value: 5 }, { label: 'Admin', value: 2 },
]
export const STATUS_TOTALS: Array<{ label: AccessStatus; value: number }> = [
  { label: 'Aktif', value: 118 }, { label: 'Nonaktif', value: 8 }, { label: 'Ditangguhkan', value: 2 },
]

export type AuditKind = 'Publikasi' | 'Akses' | 'Kelas' | 'Sesi' | 'Akun'
export interface AuditEvent { id: string; kind: AuditKind; title: string; actor: string; at: string; date: string; detail: string; result: 'Berhasil' | 'Ditolak' }

export const AUDIT: AuditEvent[] = [
  { id: 'e1', kind: 'Publikasi', title: 'Modul IDOR diterbitkan', actor: 'Admin', at: '09.12', date: '15 Nov 2026', detail: 'web-idor · versi 1.0', result: 'Berhasil' },
  { id: 'e2', kind: 'Kelas', title: 'Dosen ditugaskan ke kelas IF-3A', actor: 'Admin', at: '08.46', date: '15 Nov 2026', detail: 'Arif Nugraha → IF-3A', result: 'Berhasil' },
  { id: 'e3', kind: 'Akun', title: 'Status akun diperbarui', actor: 'Admin', at: '08.15', date: '15 Nov 2026', detail: 'Dian Putri · Aktif → Nonaktif', result: 'Berhasil' },
  { id: 'e4', kind: 'Sesi', title: 'Konteks sesi beralih ke Admin', actor: 'Yoga Pranata', at: '08.02', date: '15 Nov 2026', detail: 'Dosen → Admin · CSRF dirotasi', result: 'Berhasil' },
  { id: 'e5', kind: 'Akses', title: 'Login ditolak: akun di luar kebijakan', actor: 'Sistem', at: '22.41', date: '14 Nov 2026', detail: 'Domain tidak terdaftar', result: 'Ditolak' },
  { id: 'e6', kind: 'Publikasi', title: 'Modul dependency confusion diajukan ke review', actor: 'Yoga Pranata', at: '16.20', date: '13 Nov 2026', detail: 'web-supply · Draft → Review', result: 'Berhasil' },
  { id: 'e7', kind: 'Akses', title: 'Grant Admin diinisialisasi', actor: 'Sistem', at: '10.05', date: '13 Nov 2026', detail: 'Akun allowlist Dosen+Admin', result: 'Berhasil' },
  { id: 'e8', kind: 'Akses', title: 'Peralihan peran ditolak', actor: 'Sistem', at: '14.37', date: '12 Nov 2026', detail: 'Role tidak dimiliki akun', result: 'Ditolak' },
  { id: 'e9', kind: 'Kelas', title: 'Kelas IF-7A dibuat', actor: 'Admin', at: '09.30', date: '11 Nov 2026', detail: 'Pengujian Penetrasi · 18 mahasiswa', result: 'Berhasil' },
  { id: 'e10', kind: 'Akun', title: 'Akun ditangguhkan', actor: 'Admin', at: '11.18', date: '10 Nov 2026', detail: 'Bima Ramadhan · Aktif → Ditangguhkan', result: 'Berhasil' },
]

export const AUDIT_DAILY: WeekPoint[] = [
  { label: '9 Nov', value: 14 }, { label: '10 Nov', value: 22 }, { label: '11 Nov', value: 19 }, { label: '12 Nov', value: 26 },
  { label: '13 Nov', value: 31 }, { label: '14 Nov', value: 17 }, { label: '15 Nov', value: 12 },
]

// Sesi praktikum menurut hari dan blok jam (rata-rata per minggu).
export const HEAT_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
export const HEAT_SLOTS = ['07–10', '10–13', '13–16', '16–19', '19–22', '22–01']
export const HEAT: number[][] = [
  [18, 9, 6, 8, 12, 3],
  [7, 16, 8, 9, 14, 4],
  [5, 8, 15, 10, 16, 5],
  [17, 7, 14, 11, 18, 6],
  [6, 12, 5, 7, 9, 3],
  [2, 4, 5, 6, 11, 4],
  [1, 3, 4, 7, 15, 6],
]

export const NOTIFICATIONS = [
  { id: 'n1', title: '2 modul menunggu review', detail: 'Dependency confusion dan Brute force login', when: '1 jam lalu' },
  { id: 'n2', title: 'Login ditolak meningkat', detail: '5 percobaan dari domain tidak terdaftar', when: 'Kemarin' },
]
