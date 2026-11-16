import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronRight, CircleHelp, Globe, LogOut, ShieldCheck } from 'lucide-react'
import { ApiError, getIdentity, getPublicConfig, type Identity } from './api'
import { Button } from './components/ui/button'
import { AdminApp } from './admin/AdminApp'
import { StudentApp } from './student/StudentApp'
import { LecturerApp } from './lecturer/LecturerApp'
import { LoginView } from './login/LoginView'
import { allowedPath } from './portal/hooks'
import { ErrorView } from './shared/errors/ErrorView'
import { useI18n } from './shared/i18n'

function Brand() {
  const { tr } = useI18n()
  return (
    <a className="brand" href="/" aria-label={tr.brand.homeAria}>
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="ifaBrandBg" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e563f" />
            <stop offset="100%" stopColor="#0f3324" />
          </linearGradient>
          <linearGradient id="ifaBrandRing" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#ifaBrandBg)" stroke="url(#ifaBrandRing)" strokeWidth="1.6" />
        <path d="M20 7.5 31 12v8.2c0 7-4.7 11.7-11 13.8-6.3-2.1-11-6.8-11-13.8V12l11-4.5Z" fill="#34d399" fillOpacity="0.16" stroke="url(#ifaBrandRing)" strokeWidth="1.7" strokeLinejoin="round" />
        <rect x="14.5" y="19" width="11" height="8" rx="1.6" fill="#ffffff" />
        <path d="M17 19v-2.2a3 3 0 0 1 6 0V19" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="20" cy="23" r="1.3" fill="#0f3324" />
      </svg>
      <span>IFA<span className="brand-lab"> Lab</span></span>
    </a>
  )
}

function LangToggleButton() {
  const { lang, setLang } = useI18n()
  return (
    <button
      type="button"
      className="btn-outline"
      style={{ minHeight: 34, padding: '0 10px', fontSize: 12.5, gap: 6 }}
      onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
      aria-label={lang === 'id' ? 'Switch language to English' : 'Ganti bahasa ke Indonesia'}
    >
      <Globe size={14} aria-hidden="true" />
      <span>{lang === 'id' ? 'ID → EN' : 'EN → ID'}</span>
    </button>
  )
}

function LabContent({ user }: { user: Identity }) {
  const { tr } = useI18n()
  const client = useQueryClient()
  const context = useMutation({ mutationFn: async (role: string) => {
    const response = await fetch('/api/session/context', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': user.csrf_token }, body: JSON.stringify({ role }) })
    if (!response.ok) throw new ApiError(response.status)
    return response.json() as Promise<{ home_route: string }>
  }, onSuccess: data => { client.clear(); window.location.assign(data.home_route) } })
  const logout = useMutation({ mutationFn: async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': user.csrf_token } })
    if (!response.ok && response.status !== 401) throw new ApiError(response.status)
  }, onSuccess: () => { client.clear(); window.location.replace('/login') } })
  const shell = { user, onLogout: () => logout.mutate(), loggingOut: logout.isPending, onSwitchRole: (role: string) => context.mutate(role), switching: context.isPending,
    error: <>{logout.isError && <p role="alert" className="notice">Belum berhasil keluar. <button className="inline-link" onClick={() => logout.mutate()}>Coba lagi</button>.</p>}{context.isError && <p role="alert" className="notice">Peran belum dapat dialihkan. Muat ulang untuk memeriksa akses Anda.</p>}</> }
  if (user.role === 'admin') return <AdminApp {...shell} />
  if (user.role === 'dosen') return <LecturerApp {...shell} />
  if (user.role === 'mahasiswa') return <StudentApp {...shell} />
  return <div className="app-frame"><header className="app-header"><Brand/><Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={16}/>{logout.isPending ? tr.shell.loggingOut : tr.shell.logout}</Button></header>
    <main className="app-sheet" id="main"><div className="breadcrumb">IFA Lab <ChevronRight size={14}/> {tr.student.greeting}</div><div className="lab-heading"><div><p className="eyebrow">IFA Lab</p><h1>Ruang praktikum Anda</h1><p>{user.name}</p></div><span className="session-active"><Check size={14}/> {tr.shell.sessionActive}</span></div>
      {user.allowed_roles && user.allowed_roles.length > 1 && <nav aria-label="Beralih peran">{user.allowed_roles.filter(role => role !== user.role).map(role => <Button key={role} variant="outline" disabled={context.isPending} onClick={() => context.mutate(role)}>{tr.shell.switchTo} {role === 'admin' ? 'Admin' : 'Dosen'}</Button>)}</nav>}
      <section className="coming-next"><ShieldCheck size={28} strokeWidth={1.3}/><div><h2>Tempat eksperimen berikutnya.</h2><p>Pilih modul praktikum untuk memulai.</p></div></section>
      <footer className="app-footer"><a href="/privasi">{tr.brand.privacy}</a><a href="/bantuan">{tr.brand.help} <CircleHelp size={14}/></a></footer>
    </main></div>
}

function Lab() {
  const session = useQuery({ queryKey: ['identity'], queryFn: getIdentity })
  useEffect(() => { if (session.data === null) window.location.replace('/login?status=expired') }, [session.data])
  useEffect(() => { if (session.data?.home_route && window.location.pathname === '/lab' && session.data.home_route !== '/lab') window.location.replace(session.data.home_route) }, [session.data])
  if (session.isError) {
    const code = session.error instanceof ApiError ? session.error.status : 500
    return (
      <main className="document" id="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Brand />
          <LangToggleButton />
        </div>
        <ErrorView
          status={code}
          homeHref="/login"
          onStayCurrent={() => void session.refetch()}
        />
      </main>
    )
  }
  if (!session.data) return <StatusPage title="Memeriksa sesi…"><p role="status">Mohon tunggu sebentar.</p></StatusPage>
  const path = window.location.pathname
  const allowed = path === '/lab' || allowedPath(session.data.role, path)
  if (!allowed) {
    return (
      <main className="document" id="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Brand />
          <LangToggleButton />
        </div>
        <ErrorView
          status={403}
          homeHref={session.data.home_route ?? '/lab'}
          onStayCurrent={() => window.location.reload()}
        />
      </main>
    )
  }
  return <LabContent user={session.data}/>
}

function StatusPage({ title, children }: { title: string; children: React.ReactNode }) { return <main className="document" id="main"><Brand/><h1>{title}</h1>{children}</main> }

function Information({ help }: { help: boolean }) {
  const { tr, lang } = useI18n()
  const config = useQuery({ queryKey: ['public-config'], queryFn: getPublicConfig, enabled: help })
  return <main className="document" id="main">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <Brand />
      <LangToggleButton />
    </div>
    <a className="back-link" href="/login"><ArrowLeft size={16}/> {tr.brand.backToLogin}</a>
    <h1>{help ? tr.brand.help : tr.brand.privacy}</h1>
    {help ? (lang === 'en' ? <>
      <p>If sign-in is cancelled or expires, return to the login page and choose “Sign in with Google”. Make sure browser cookies are enabled.</p><h2>Need more help?</h2>
      {config.data?.support_email ? <p>Contact the administrator via <a className="inline-link" href={`mailto:${config.data.support_email}`}>{config.data.support_email}</a> without attaching passwords or login codes.</p> : <p>Support contact is not configured yet. Please reach out to your class lecturer.</p>}
    </> : <>
      <p>Jika login dibatalkan atau waktunya habis, kembali ke halaman login dan pilih “Masuk dengan Google”. Pastikan cookie di browser diizinkan.</p><h2>Masih memerlukan bantuan?</h2>
      {config.data?.support_email ? <p>Hubungi pengelola melalui <a className="inline-link" href={`mailto:${config.data.support_email}`}>{config.data.support_email}</a>. Jelaskan masalah dan waktu kejadian tanpa menyertakan kata sandi atau kode login.</p> : <p>{config.isPending ? 'Memuat kontak pengelola…' : 'Kontak bantuan belum tersedia. Hubungi dosen atau pengelola praktikum melalui jalur komunikasi kelas Anda.'}</p>}
    </>) : (lang === 'en' ? <>
      <p>IFA Lab uses Google Sign-In to authorize access to student, lecturer, and admin lab portals. No password is stored.</p><h2>Data Processed</h2><p>Verified Google identity, name, email, and portal roles are stored with strict HttpOnly SameSite cookies.</p>
    </> : <>
      <p>IFA Lab menggunakan akun Google untuk memberikan akses ke ruang praktikum. Kebijakan ini mencakup fondasi login pada Fase 1.</p><h2>Data yang diproses</h2><p>Kami menyimpan identitas penyedia akun dan ID akun, nama, alamat email terverifikasi, serta peran portal. Kami tidak meminta atau menyimpan kata sandi Google. Token Google dipakai untuk validasi login dan tidak disimpan sebagai sesi portal.</p><h2>Cookie dan sesi</h2><p>Cookie esensial digunakan untuk transaksi login selama 5 menit dan sesi portal hingga 8 jam. Sesi berakhir setelah 30 menit tanpa aktivitas. Cookie sesi tidak dapat dibaca oleh JavaScript. Tidak ada cookie analitik atau iklan pada fase ini.</p><h2>Penyimpanan dan penghapusan</h2><p>Sesi dan transaksi login kedaluwarsa dibersihkan setiap 5 menit saat layanan berjalan. Identitas akun disimpan sampai akun dihapus oleh pengelola. Log autentikasi mencatat jenis peristiwa, tanpa token, kode otorisasi, atau kata sandi. Kebijakan retensi log dan backup ditetapkan pengelola sebelum rilis production.</p><h2>Penyedia dan hak Anda</h2><p>Google memproses autentikasi sesuai <a href="https://policies.google.com/privacy" rel="noreferrer">Kebijakan Privasi Google</a>. Untuk permintaan akses, koreksi, atau penghapusan data portal, gunakan <a href="/bantuan">halaman Bantuan</a>.</p>
    </>)}
  </main>
}

export default function App() {
  const path = window.location.pathname
  const { tr } = useI18n()
  useEffect(() => { if (path.startsWith('/lab')) return; document.title = `${path === '/lab' ? 'Ruang praktikum' : path === '/privasi' ? tr.brand.privacy : path === '/bantuan' ? tr.brand.help : 'Masuk'} · IFA Lab` }, [path, tr.brand.help, tr.brand.privacy])
  return <><a className="skip-link" href="#main">Lewati ke konten utama</a>{path === '/' || path === '/login' ? <LoginView/> : path === '/lab' || path.startsWith('/lab/') ? <Lab/> : path === '/privasi' || path === '/bantuan' ? <Information help={path === '/bantuan'}/> : <main className="document" id="main"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Brand /><LangToggleButton /></div><ErrorView status={404} homeHref="/" /></main>}</>
}
