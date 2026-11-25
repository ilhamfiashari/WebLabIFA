import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Maximize2, Monitor, Moon, Pause, Play, SlidersHorizontal, Sun, Terminal, X } from 'lucide-react'
import { PROGRAM_LABELS, STUDIO_DEFAULTS, WEATHER_LABELS, type StudioSettings } from './studio-model'
import type { WorkstationView } from './LaptopWorkstationModal'

export function StudioControls({
  settings,
  setSettings,
  en,
  preview,
  onPreview,
  onOpenWorkstation,
}: {
  settings: StudioSettings
  setSettings: Dispatch<SetStateAction<StudioSettings>>
  en: boolean
  preview: boolean
  onPreview: () => void
  onOpenWorkstation: (view: WorkstationView) => void
}) {
  const [open, setOpen] = useState(false)
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null)
  const update = <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => setSettings(s => ({ ...s, [key]: value }))
  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside) }
  }, [open])
  return <div className="login-studio-dock">
    <button type="button" className="login-studio-trigger" onClick={() => onOpenWorkstation('terminal')} aria-label={en ? 'Zoom Terminal' : 'Zoom Terminal'} title={en ? 'Zoom Terminal' : 'Perbesar Terminal'}><Terminal size={17} /></button>
    <button type="button" className="login-studio-trigger" onClick={() => { update('program', 'desktop'); onOpenWorkstation('desktop') }} aria-label={en ? 'Open Desktop OS' : 'Buka Desktop OS'} title={en ? 'Open Desktop OS' : 'Tampilkan Desktop'}><Monitor size={17} /></button>
    <button type="button" className="login-studio-trigger login-studio-preview" onClick={onPreview} aria-label={preview ? en ? 'Back to login' : 'Kembali ke login' : en ? 'Preview studio' : 'Pratinjau studio'} aria-pressed={preview}>{preview ? <X size={17} /> : <Maximize2 size={17} />}</button>
    <button type="button" className="login-studio-trigger" onClick={() => update('theme', dark ? 'light' : 'dark')} aria-label={en ? 'Toggle light / dark theme' : 'Ganti tema terang / gelap'}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
    <button type="button" className="login-studio-trigger" onClick={() => update('paused', !settings.paused)} aria-label={settings.paused ? en ? 'Play animation' : 'Putar animasi' : en ? 'Pause animation' : 'Jeda animasi'} aria-pressed={settings.paused}>{settings.paused ? <Play size={17} /> : <Pause size={17} />}</button>
    <button ref={trigger} type="button" className="login-studio-trigger" aria-expanded={open} aria-controls="login-studio-panel" onClick={() => setOpen(!open)}><SlidersHorizontal size={17} />Studio</button>
    {open && <section ref={panel} id="login-studio-panel" className="login-studio-panel" aria-labelledby="studio-heading">
      <header><div><h2 id="studio-heading">{en ? 'Login studio' : 'Studio login'}</h2><p>{en ? 'Local visual simulation' : 'Simulasi visual lokal'}</p></div><button type="button" aria-label={en ? 'Close studio' : 'Tutup studio'} onClick={() => { setOpen(false); trigger.current?.focus() }}><X size={19} /></button></header>
      <label>{en ? 'Room lighting' : 'Pencahayaan ruang'}<select value={settings.time} onChange={e => update('time', e.target.value as StudioSettings['time'])}>{(['auto', 'sunrise', 'day', 'sunset', 'night'] as const).map((key, i) => <option key={key} value={key}>{(en ? ['Automatic', 'Sunrise', 'Day', 'Sunset', 'Night'] : ['Otomatis', 'Pagi', 'Siang', 'Senja', 'Malam'])[i]}</option>)}</select></label>
      <label>{en ? 'Outside weather' : 'Cuaca di luar'}<select value={settings.weather} onChange={e => update('weather', e.target.value as StudioSettings['weather'])}>{Object.entries(WEATHER_LABELS).map(([key, label]) => <option key={key} value={key}>{label[en ? 1 : 0]}</option>)}</select></label>
      <label>{en ? 'Laptop program' : 'Program laptop'}<select value={settings.program} onChange={e => update('program', e.target.value as StudioSettings['program'])}>{Object.entries(PROGRAM_LABELS).map(([key, label]) => <option key={key} value={key}>{label[en ? 1 : 0]}</option>)}</select></label>
      <label>{en ? 'Login theme' : 'Tema login'}<select value={settings.theme} onChange={e => update('theme', e.target.value as StudioSettings['theme'])}>{(['system', 'light', 'dark'] as const).map((key, i) => <option key={key} value={key}>{(en ? ['System', 'Light', 'Dark'] : ['Sistem', 'Terang', 'Gelap'])[i]}</option>)}</select></label>
      <label htmlFor="studio-network">{en ? 'Network activity' : 'Aktivitas jaringan'} <span aria-hidden="true">{settings.network}%</span><input id="studio-network" type="range" min="0" max="100" value={settings.network} aria-valuetext={`${settings.network}%`} onChange={e => update('network', Number(e.target.value))} /></label>
      <label htmlFor="studio-distance">{en ? 'Ultrasonic distance' : 'Jarak ultrasonik'} <span aria-hidden="true">{settings.distance} cm</span><input id="studio-distance" type="range" min="5" max="200" value={settings.distance} aria-valuetext={`${settings.distance} cm`} onChange={e => update('distance', Number(e.target.value))} /></label>
      <label className="login-studio-check"><input type="checkbox" checked={settings.leaves} onChange={e => update('leaves', e.target.checked)} />{en ? 'Wind and falling leaves' : 'Angin dan daun berjatuhan'}</label>
      <p>{en ? 'Sensor readings and network traffic are simulated. No physical devices are connected. Reduced motion follows your system setting.' : 'Angka sensor dan trafik jaringan merupakan simulasi. Tidak terhubung ke perangkat fisik. Pengurangan gerak mengikuti pengaturan sistem.'}</p>
      <button type="button" className="login-studio-reset" onClick={() => setSettings({ ...STUDIO_DEFAULTS })}>{en ? 'Reset studio' : 'Atur ulang studio'}</button>
    </section>}
  </div>
}
