import { useEffect, useState } from 'react'
import type { LoginSceneKey, PublicWeatherResponse } from './weatherTime'

export type LabWeather = 'clear' | 'cloudy' | 'drizzle' | 'rain' | 'storm' | 'snow' | 'blizzard'
export type LabProgram = 'auto' | 'security' | 'pentest' | 'vulnerability' | 'attacks' | 'iot' | 'protocols'
export interface StudioSettings {
  time: 'auto' | 'sunrise' | 'day' | 'sunset' | 'night'
  weather: 'auto' | LabWeather
  program: LabProgram
  theme: 'system' | 'light' | 'dark'
  paused: boolean
  leaves: boolean
  network: number
  distance: number
}
export const STUDIO_DEFAULTS: StudioSettings = { time: 'auto', weather: 'auto', program: 'auto', theme: 'system', paused: false, leaves: true, network: 50, distance: 80 }
const STORAGE_KEY = 'ifa-login-studio-v1'
export function useStudioSettings() {
  const [settings, setSettings] = useState<StudioSettings>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
      const oneOf = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback
      return { time: oneOf(raw.time, ['auto', 'sunrise', 'day', 'sunset', 'night'], 'auto'), weather: oneOf(raw.weather, ['auto', 'clear', 'cloudy', 'drizzle', 'rain', 'storm', 'snow', 'blizzard'], 'auto'), program: oneOf(raw.program, ['auto', 'security', 'pentest', 'vulnerability', 'attacks', 'iot', 'protocols'], 'auto'), theme: oneOf(raw.theme, ['system', 'light', 'dark'], 'system'), paused: raw.paused === true, leaves: raw.leaves !== false, network: bounded(raw.network, 0, 100, 50), distance: bounded(raw.distance, 5, 200, 80) }
    } catch { return STUDIO_DEFAULTS }
  })
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* Storage may be disabled. */ } }, [settings])
  return [settings, setSettings] as const
}
function bounded(value: unknown, min: number, max: number, fallback: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback }
export function resolveLabWeather(weather: PublicWeatherResponse | null): LabWeather {
  if (!weather?.live) return 'clear'
  if (weather.weather_code >= 95) return 'storm'
  if ([75, 86].includes(weather.weather_code)) return 'blizzard'
  if (weather.condition === 'snow') return 'snow'
  if (weather.weather_code >= 51 && weather.weather_code <= 57) return 'drizzle'
  if (weather.condition === 'rain') return 'rain'
  return weather.condition === 'cloudy' ? 'cloudy' : 'clear'
}
export function studioScene(time: LoginSceneKey, weather: LabWeather): LoginSceneKey {
  if (weather === 'snow' || weather === 'blizzard') return 'snowy'
  if (['drizzle', 'rain', 'storm'].includes(weather)) return 'rainy'
  return time
}
export function sensorSample(seconds: number, weather: LabWeather, distance: number, network: number) {
  const wet = ['drizzle', 'rain', 'storm'].includes(weather), snow = ['snow', 'blizzard'].includes(weather)
  return { temperature: (snow ? -2 : wet ? 23 : 28) + Math.sin(seconds * .13) * .6, humidity: (snow ? 78 : wet ? 88 : 61) + Math.sin(seconds * .09) * 2, distance: distance + Math.sin(seconds * .8) * .4, upload: network === 0 ? 0 : network * (.38 + Math.sin(seconds * .7) * .08), download: network === 0 ? 0 : network * (.08 + Math.sin(seconds * .43) * .025) }
}
export const PROGRAM_LABELS = {
  auto: ['Putar semua program', 'Cycle all programs'], security: ['Cybersecurity', 'Cybersecurity'], pentest: ['Pentest lab', 'Pentest lab'], vulnerability: ['Pemindaian kerentanan', 'Vulnerability scanning'], attacks: ['Simulasi serangan', 'Attack simulation'], iot: ['Simulator IoT', 'IoT simulator'], protocols: ['Protokol jaringan', 'Network protocols'],
} as const
export const WEATHER_LABELS = {
  auto: ['Cuaca otomatis', 'Automatic weather'], clear: ['Cerah', 'Clear'], cloudy: ['Berawan', 'Cloudy'], drizzle: ['Gerimis', 'Drizzle'], rain: ['Hujan', 'Rain'], storm: ['Badai', 'Storm'], snow: ['Salju', 'Snow'], blizzard: ['Badai salju', 'Blizzard'],
} as const
