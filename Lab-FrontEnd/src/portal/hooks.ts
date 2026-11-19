import { useEffect, useRef, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

/** localStorage dapat dinonaktifkan; semua akses dibungkus agar halaman tetap berjalan. */
export const store = {
  get(key: string) { try { return window.localStorage.getItem(key) } catch { return null } },
  set(key: string, value: string) { try { window.localStorage.setItem(key, value) } catch { /* penyimpanan tidak tersedia */ } },
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (store.get('ifa-theme') as Theme | null) ?? 'light')
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { root.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme }
    apply(); store.set('ifa-theme', theme)
    media.addEventListener('change', apply)
    return () => { media.removeEventListener('change', apply); delete root.dataset.theme }
  }, [theme])
  return [theme, setTheme] as const
}

export function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => { const sync = () => setPath(window.location.pathname); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync) }, [])
  const go = (to: string) => { if (to !== window.location.pathname) { window.history.pushState(null, '', to); setPath(to); window.scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }) } }
  return [path, go] as const
}

export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, close])
  return ref
}

export const roleName = (role: string) => role === 'admin' ? 'Admin' : role === 'dosen' ? 'Dosen' : 'Mahasiswa'

/** Rute yang boleh dibuka oleh setiap peran aktif. Backend tetap memeriksa setiap endpoint. */
export function allowedPath(role: string, path: string) {
  const id = '(/[a-zA-Z0-9_-]{1,64})?'
  if (role === 'admin') return ['', '/pengguna', '/kelas', '/katalog', '/audit', '/pengaturan'].some(p => path === `/lab/admin${p}`)
  if (role === 'dosen') {
    return (
      ['/lab/dosen', '/lab/dosen/web', '/lab/dosen/web-dev', '/lab/dosen/iot', '/lab/dosen/kelas', '/lab/dosen/leaderboard', '/lab/dosen/penugasan', '/lab/dosen/progres', '/lab/dosen/panduan', '/lab/dosen/pengaturan'].includes(path) ||
      new RegExp(`^/lab/dosen/web/[a-zA-Z0-9_-]{1,32}(/[a-zA-Z0-9_-]{1,64})?$`).test(path) ||
      new RegExp(`^/lab/dosen/web-dev/[a-zA-Z0-9_-]{1,64}$`).test(path) ||
      new RegExp(`^/lab/dosen/iot/[a-zA-Z0-9_-]{1,64}$`).test(path) ||
      new RegExp(`^/lab/dosen/latihan${id}$`).test(path) ||
      new RegExp(`^/lab/dosen/sesi/[a-zA-Z0-9-]{1,64}$`).test(path)
    )
  }
  return (
    ['/lab', '/lab/pencapaian', '/lab/peringkat', '/lab/web', '/lab/web-dev', '/lab/iot', '/lab/tugas', '/lab/progres', '/lab/riwayat', '/lab/panduan', '/lab/pengaturan'].includes(path) ||
    new RegExp(`^/lab/latihan${id}$`).test(path) ||
    new RegExp(`^/lab/web/[a-zA-Z0-9_-]{1,32}(/[a-zA-Z0-9_-]{1,64})?$`).test(path) ||
    new RegExp(`^/lab/web-dev/[a-zA-Z0-9_-]{1,64}$`).test(path) ||
    new RegExp(`^/lab/iot/[a-zA-Z0-9_-]{1,64}$`).test(path) ||
    new RegExp(`^/lab/sesi/[a-zA-Z0-9-]{1,64}$`).test(path)
  )
}
