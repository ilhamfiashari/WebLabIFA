import { useEffect, useRef } from 'react'
import { LAPTOP_MENU, LAPTOP_MODES } from './laptop-content'
import type { LabProgram } from './studio-model'
import type { LoginSceneKey } from './weatherTime'

export function LaptopMenu({ time, selected, onSelect }: { time: LoginSceneKey; selected: LabProgram; onSelect: (mode: LabProgram) => void }) {
  const root = useRef<HTMLDivElement>(null), plane = useRef<HTMLElement>(null)
  useEffect(() => {
    const host = root.current, menu = plane.current
    if (!host || !menu) return
    const points = ['night', 'sunset'].includes(time) ? [43, 248, 736, 281, 790, 665, 85, 730] : [43, 246, 752, 284, 802, 687, 87, 740]
    const [x0,y0,x1,y1,x2,y2,x3,y3] = points
    const dx1=x1-x2, dx2=x3-x2, dx3=x0-x1+x2-x3, dy1=y1-y2, dy2=y3-y2, dy3=y0-y1+y2-y3, det=dx1*dy2-dx2*dy1
    const g=(dx3*dy2-dx2*dy3)/det, h=(dx1*dy3-dx3*dy1)/det
    const a=x1-x0+g*x1, b=x3-x0+h*x3, d=y1-y0+g*y1, e=y3-y0+h*y3
    const resize = () => {
      const { width, height } = host.getBoundingClientRect(), scale = Math.max(width/1446, height/1087), offset=(width-1446*scale)*(innerWidth < 900 ? .5 : 0)
      menu.style.transform = `translateX(${offset}px) scale(${scale}) matrix3d(${a/1280},${d/1280},0,${g/1280},${b/720},${e/720},0,${h/720},0,0,1,0,${x0},${y0},0,1)`
    }
    const observer = new ResizeObserver(resize); observer.observe(host); resize()
    return () => observer.disconnect()
  }, [time])
  return <div ref={root} className="login-laptop-menu-host"><nav ref={plane} className="login-laptop-menu" aria-label="Laptop simulation">
    {LAPTOP_MODES.map((mode, i) => <button type="button" key={mode} aria-label={`Laptop: ${LAPTOP_MENU[i]}`} aria-pressed={selected === mode} title={LAPTOP_MENU[i]} onClick={() => onSelect(mode)}>{LAPTOP_MENU[i]}</button>)}
  </nav></div>
}
