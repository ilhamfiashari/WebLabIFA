import { useEffect, useState } from 'react'

export type LoginSceneKey = 'sunrise' | 'day' | 'sunset' | 'night' | 'rainy' | 'snowy'

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow'

export interface PublicWeatherResponse {
  live: boolean
  condition: WeatherCondition
  weather_code: number
  temperature_c: number | null
  is_day: boolean | null
  sunrise: string | null
  sunset: string | null
  timezone: string | null
}

export interface SceneDescriptor {
  key: LoginSceneKey
  src: string
  labelId: string
  labelEn: string
}

export const LOGIN_SCENES: Record<LoginSceneKey, SceneDescriptor> = {
  sunrise: {
    key: 'sunrise',
    src: '/assets/login/lab-sunrise.webp',
    labelId: 'Matahari Terbit',
    labelEn: 'Sunrise',
  },
  day: {
    key: 'day',
    src: '/assets/login/lab-day.webp',
    labelId: 'Siang Cerah',
    labelEn: 'Daylight',
  },
  sunset: {
    key: 'sunset',
    src: '/assets/login/lab-sunset.webp',
    labelId: 'Senja',
    labelEn: 'Sunset',
  },
  night: {
    key: 'night',
    src: '/assets/login/lab-night.webp',
    labelId: 'Malam',
    labelEn: 'Night',
  },
  rainy: {
    key: 'rainy',
    src: '/assets/login/lab-rainy.webp',
    labelId: 'Hujan',
    labelEn: 'Rainy',
  },
  snowy: {
    key: 'snowy',
    src: '/assets/login/lab-snowy.webp',
    labelId: 'Salju',
    labelEn: 'Snowy',
  },
}

const TIMEZONE_COORDS: Record<string, { lat: number; lon: number }> = {
  'Asia/Jakarta': { lat: -5.3582, lon: 105.3148 },
  'Asia/Pontianak': { lat: -0.0263, lon: 109.3425 },
  'Asia/Makassar': { lat: -5.1477, lon: 119.4327 },
  'Asia/Jayapura': { lat: -2.5916, lon: 140.669 },
  'Asia/Singapore': { lat: 1.3521, lon: 103.8198 },
  'Asia/Kuala_Lumpur': { lat: 3.139, lon: 101.6869 },
  'Asia/Tokyo': { lat: 35.6762, lon: 139.6503 },
  'Europe/London': { lat: 51.5072, lon: -0.1276 },
  'America/New_York': { lat: 40.7128, lon: -74.006 },
}

export function inferCoordsFromTimezone(): { lat: number; lon: number } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && TIMEZONE_COORDS[tz]) return TIMEZONE_COORDS[tz]
  } catch {
    // fallback below
  }
  return { lat: -5.3582, lon: 105.3148 }
}

/** Parses 'YYYY-MM-DDTHH:MM' into minutes since local midnight. */
export function parseSolarMinutes(isoLocal: string | null | undefined): number | null {
  if (!isoLocal) return null
  const match = /T(\d{2}):(\d{2})/.exec(isoLocal)
  if (!match) return null
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

export function resolveTimeScene(now: Date, weather: PublicWeatherResponse | null): Exclude<LoginSceneKey, 'rainy' | 'snowy'> {
  const mins = now.getHours() * 60 + now.getMinutes()
  const sunriseMins = parseSolarMinutes(weather?.sunrise)
  const sunsetMins = parseSolarMinutes(weather?.sunset)

  if (sunriseMins !== null && sunsetMins !== null && sunsetMins > sunriseMins) {
    if (mins >= sunriseMins - 45 && mins <= sunriseMins + 60) return 'sunrise'
    if (mins >= sunsetMins - 60 && mins <= sunsetMins + 45) return 'sunset'
    if (mins > sunriseMins + 60 && mins < sunsetMins - 60) return 'day'
    return 'night'
  }

  if (mins >= 5 * 60 && mins < 8 * 60) return 'sunrise'
  if (mins >= 8 * 60 && mins < 16 * 60) return 'day'
  if (mins >= 16 * 60 && mins < 18 * 60 + 30) return 'sunset'
  return 'night'
}

export function resolveSceneFromTimeAndWeather(
  now: Date,
  weather: PublicWeatherResponse | null,
): SceneDescriptor {
  if (weather?.live) {
    if (weather.condition === 'snow') return LOGIN_SCENES.snowy
    if (weather.condition === 'rain') return LOGIN_SCENES.rainy
  }
  return LOGIN_SCENES[resolveTimeScene(now, weather)]
}

export interface AtmosphereState {
  now: Date
  scene: SceneDescriptor
  weather: PublicWeatherResponse | null
}

export function useRealtimeAtmosphere(): AtmosphereState {
  const [now, setNow] = useState<Date>(() => new Date())
  const [weather, setWeather] = useState<PublicWeatherResponse | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const loadWeather = async (coords: { lat: number; lon: number }) => {
      try {
        const res = await fetch(
          `/api/public/weather?lat=${coords.lat.toFixed(4)}&lon=${coords.lon.toFixed(4)}`,
          { signal: controller.signal },
        )
        if (!res.ok) return
        const data = (await res.json()) as PublicWeatherResponse
        if (active && data && typeof data.condition === 'string') {
          setWeather(data)
        }
      } catch {
        // Fallback smoothly to local clock when offline/blocked/aborted
      }
    }

    const baseCoords = inferCoordsFromTimezone()
    void loadWeather(baseCoords)

    // Silently use exact browser geolocation if permission is already granted
    if (navigator.permissions && navigator.geolocation) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then(status => {
          if (active && status.state === 'granted') {
            navigator.geolocation.getCurrentPosition(
              pos => {
                if (active) {
                  void loadWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude })
                }
              },
              () => undefined,
              { maximumAge: 600_000, timeout: 4_000 },
            )
          }
        })
        .catch(() => undefined)
    }

    const refresh = window.setInterval(() => void loadWeather(baseCoords), 600_000)
    return () => {
      active = false
      controller.abort()
      window.clearInterval(refresh)
    }
  }, [])

  const scene = resolveSceneFromTimeAndWeather(now, weather)
  return { now, scene, weather }
}
