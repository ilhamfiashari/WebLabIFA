import { useId } from 'react'
import { ErrorArtwork } from './ErrorArtwork'
import { ERROR_VISUALS, resolveStatusKey } from './error-status'

export function ErrorIllustration({ status }: { status: number }) {
  const id = useId().replace(/:/g, '')
  const locked = status === 401 || status === 403
  const key = resolveStatusKey(status)
  return <svg className="err-illustration" data-error-art={ERROR_VISUALS[key]} viewBox="0 0 600 380" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-bar`} x1="135" y1="70" x2="447" y2="127" gradientUnits="userSpaceOnUse"><stop stopColor="#499b7b" /><stop offset="1" stopColor="#1a5d4c" /></linearGradient>
      <linearGradient id={`${id}-alert`} x1="276" y1="148" x2="345" y2="270" gradientUnits="userSpaceOnUse"><stop stopColor="#fcaa95" /><stop offset="1" stopColor="#df6357" /></linearGradient>
      <radialGradient id={`${id}-glass`}><stop stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#b7e6d4" stopOpacity=".35" /></radialGradient>
    </defs>
    <ellipse cx="301" cy="206" rx="204" ry="150" fill="#e5f5ed" />
    <ellipse cx="299" cy="336" rx="185" ry="12" fill="#cce8db" opacity=".55" />
    <g className="err-orbit"><path d="M125 89C223-12 454 3 496 186" stroke="#85c5a8" strokeWidth="1.5" strokeDasharray="6 7" /><circle cx="409" cy="41" r="7" fill="#75bd99" /><circle cx="484" cy="113" r="8" fill="#75bd99" /></g>
    <g className="err-leaves"><path d="M165 315C116 314 93 282 96 251C131 253 159 280 165 315Z" fill="#74b88c" /><path d="M163 318C119 344 96 328 85 309C117 293 148 296 163 318Z" fill="#40987b" /><path d="M431 310C431 248 470 214 505 216C505 252 479 293 431 310Z" fill="#92c879" /><path d="M430 316C471 272 506 273 520 291C501 318 470 333 430 316Z" fill="#6bb494" /></g>
    {key === 404 ? <><g className="err-browser-float">
      <path d="M160 78L427 95C445 96 456 111 455 129L443 303C442 321 429 334 411 333L146 316C128 315 116 302 118 284L130 107C131 89 143 77 160 78Z" fill="#b0cfc1" />
      <path d="M164 72L431 89C449 90 460 105 459 123L447 297C446 315 433 328 415 327L150 310C132 309 120 296 122 278L134 101C135 83 147 71 164 72Z" fill="#f8fcfa" stroke="#bdd8cb" strokeWidth="2" />
      <path d="M134 112L459 133L460 122C461 104 449 90 431 89L164 72C147 71 135 83 134 101Z" fill={`url(#${id}-bar)`} />
      <circle cx="163" cy="98" r="8" fill="#ef9b80" /><circle cx="188" cy="100" r="8" fill="#f3d07d" /><circle cx="213" cy="102" r="8" fill="#a9e2c0" />
      <path d="M177 148L413 163L407 250L171 235Z" fill="#e6efeb" />
      <path d="M172 259L281 266M169 278L343 289" stroke="#e1ebe5" strokeWidth="12" strokeLinecap="round" />
      {locked ? <g><rect x="255" y="191" width="83" height="71" rx="13" fill="#448f78" /><path d="M270 192V172C270 137 325 137 325 172V195" stroke="#438975" strokeWidth="12" /><circle cx="297" cy="220" r="8" fill="#effbf4" /><path d="M297 225V238" stroke="#effbf4" strokeWidth="5" strokeLinecap="round" /></g> : <g><path d="M284 146C291 135 305 136 311 148L361 248C367 259 360 270 348 269L239 262C226 261 221 249 228 239Z" fill={`url(#${id}-alert)`} stroke="#ee9989" strokeWidth="3" /><path d="M294 178L292 218" stroke="#fff7f1" strokeWidth="11" strokeLinecap="round" /><circle cx="291" cy="240" r="6" fill="#fff7f1" /></g>}
    </g>
    <g className="err-magnifier"><path d="M439 285L474 326" stroke="#256e59" strokeWidth="20" strokeLinecap="round" /><circle cx="416" cy="258" r="48" fill="#599a7e" /><circle cx="416" cy="258" r="39" fill={`url(#${id}-glass)`} stroke="#d0eadc" strokeWidth="4" /><path d="M394 247C397 234 406 226 419 225" stroke="#fff" strokeOpacity=".85" strokeWidth="5" strokeLinecap="round" /></g></> : <ErrorArtwork status={key} />}
    <circle cx="104" cy="204" r="4" fill="#89c4a7" /><circle cx="522" cy="338" r="3" fill="#89c4a7" />
  </svg>
}
