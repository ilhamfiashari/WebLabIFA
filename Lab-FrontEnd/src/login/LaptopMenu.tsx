import { useEffect, useRef } from 'react'
import { LAPTOP_MENU, LAPTOP_MODES } from './laptop-content'
import type { LabProgram } from './studio-model'
import type { LoginSceneKey } from './weatherTime'

export function LaptopMenu({
  time,
  selected,
  onSelect,
  onOpenZoom,
}: {
  time: LoginSceneKey
  selected: LabProgram
  onSelect: (mode: LabProgram) => void
  onOpenZoom: (initialView?: 'lab' | 'terminal' | 'desktop') => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const plane = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = root.current
    const menu = plane.current
    if (!host || !menu) return
    const points = ['night', 'sunset'].includes(time)
      ? [43, 248, 736, 281, 790, 665, 85, 730]
      : [43, 246, 752, 284, 802, 687, 87, 740]
    const [x0, y0, x1, y1, x2, y2, x3, y3] = points
    const dx1 = x1 - x2
    const dx2 = x3 - x2
    const dx3 = x0 - x1 + x2 - x3
    const dy1 = y1 - y2
    const dy2 = y3 - y2
    const dy3 = y0 - y1 + y2 - y3
    const det = dx1 * dy2 - dx2 * dy1
    const g = (dx3 * dy2 - dx2 * dy3) / det
    const h = (dx1 * dy3 - dx3 * dy1) / det
    const a = x1 - x0 + g * x1
    const b = x3 - x0 + h * x3
    const d = y1 - y0 + g * y1
    const e = y3 - y0 + h * y3
    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      const scale = Math.max(width / 1446, height / 1087)
      const offset = (width - 1446 * scale) * (innerWidth < 900 ? 0.5 : 0)
      menu.style.transform = `translateX(${offset}px) scale(${scale}) matrix3d(${a / 1280},${d / 1280},0,${g / 1280},${b / 720},${e / 720},0,${h / 720},0,0,1,0,${x0},${y0},0,1)`
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    return () => observer.disconnect()
  }, [time])

  return (
    <div ref={root} className="login-laptop-menu-host">
      <div ref={plane} className="login-laptop-plane">
        <nav className="login-laptop-menu" aria-label="Laptop simulation">
          {LAPTOP_MODES.map((mode, i) => (
            <button
              type="button"
              key={mode}
              aria-label={`Laptop: ${LAPTOP_MENU[i]}`}
              aria-pressed={selected === mode}
              title={LAPTOP_MENU[i]}
              onClick={() => {
                onSelect(mode)
                if (mode === 'desktop') onOpenZoom('desktop')
              }}
            >
              {LAPTOP_MENU[i]}
            </button>
          ))}
          <button
            type="button"
            className="login-laptop-zoom-hit"
            aria-label="Laptop: Zoom workstation"
            title="Zoom workstation & Terminal"
            onClick={() => onOpenZoom(selected === 'desktop' ? 'desktop' : 'terminal')}
          >
            Zoom
          </button>
        </nav>

        {/* Direct click hitbox over the laptop's Terminal panel to pop out the wider terminal */}
        <button
          type="button"
          className="login-laptop-terminal-hit"
          aria-label="Open expanded workstation terminal"
          title="Klik untuk memperbesar Terminal & Workstation"
          onClick={() => onOpenZoom('terminal')}
        />
      </div>
    </div>
  )
}
