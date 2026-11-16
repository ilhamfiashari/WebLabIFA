use openidconnect::reqwest;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

const DEFAULT_LAT: f64 = -5.3582;
const DEFAULT_LON: f64 = 105.3148;
const CACHE_TTL_SECS: u64 = 600;

#[derive(Clone, Debug, Serialize)]
pub struct WeatherPayload {
    pub live: bool,
    pub condition: &'static str,
    pub weather_code: i64,
    pub temperature_c: Option<f64>,
    pub is_day: Option<bool>,
    pub sunrise: Option<String>,
    pub sunset: Option<String>,
    pub timezone: Option<String>,
}

#[derive(Clone)]
struct CachedWeather {
    fetched_at: Instant,
    payload: WeatherPayload,
}

#[derive(Clone)]
pub struct WeatherCache {
    http: reqwest::Client,
    entries: Arc<Mutex<HashMap<String, CachedWeather>>>,
}

impl Default for WeatherCache {
    fn default() -> Self {
        Self::new()
    }
}

impl WeatherCache {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(3))
            .build()
            .unwrap_or_default();
        Self {
            http,
            entries: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn lookup(&self, raw_lat: Option<f64>, raw_lon: Option<f64>) -> WeatherPayload {
        let (lat, lon) = sanitize_coords(raw_lat, raw_lon);
        let key = format!("{lat:.1},{lon:.1}");
        if let Some(hit) = self.read_cached(&key) {
            return hit;
        }
        let payload = self.fetch_open_meteo(lat, lon).await;
        if payload.live {
            self.write_cached(key, payload.clone());
        }
        payload
    }

    fn read_cached(&self, key: &str) -> Option<WeatherPayload> {
        let guard = self.entries.lock().ok()?;
        let item = guard.get(key)?;
        if item.fetched_at.elapsed().as_secs() < CACHE_TTL_SECS {
            return Some(item.payload.clone());
        }
        None
    }

    fn write_cached(&self, key: String, payload: WeatherPayload) {
        if let Ok(mut guard) = self.entries.lock() {
            if guard.len() > 128 {
                guard.retain(|_, v| v.fetched_at.elapsed().as_secs() < CACHE_TTL_SECS);
            }
            guard.insert(
                key,
                CachedWeather {
                    fetched_at: Instant::now(),
                    payload,
                },
            );
        }
    }

    async fn fetch_open_meteo(&self, lat: f64, lon: f64) -> WeatherPayload {
        let url = format!(
            "https://api.open-meteo.com/v1/forecast?latitude={lat:.4}&longitude={lon:.4}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1"
        );
        let Ok(resp) = self.http.get(url).send().await else {
            return fallback_payload();
        };
        if !resp.status().is_success() {
            return fallback_payload();
        }
        let Ok(body) = resp.bytes().await else {
            return fallback_payload();
        };
        let Ok(parsed) = serde_json::from_slice::<OpenMeteoResponse>(&body) else {
            return fallback_payload();
        };
        let code = parsed
            .current
            .as_ref()
            .and_then(|c| c.weather_code)
            .unwrap_or(0);
        WeatherPayload {
            live: true,
            condition: classify_wmo_code(code),
            weather_code: code,
            temperature_c: parsed.current.as_ref().and_then(|c| c.temperature_2m),
            is_day: parsed
                .current
                .as_ref()
                .and_then(|c| c.is_day)
                .map(|flag| flag == 1),
            sunrise: parsed
                .daily
                .as_ref()
                .and_then(|d| d.sunrise.first())
                .cloned(),
            sunset: parsed
                .daily
                .as_ref()
                .and_then(|d| d.sunset.first())
                .cloned(),
            timezone: parsed.timezone,
        }
    }
}

#[derive(Deserialize)]
struct OpenMeteoResponse {
    timezone: Option<String>,
    current: Option<OpenMeteoCurrent>,
    daily: Option<OpenMeteoDaily>,
}

#[derive(Deserialize)]
struct OpenMeteoCurrent {
    temperature_2m: Option<f64>,
    weather_code: Option<i64>,
    is_day: Option<i64>,
}

#[derive(Deserialize)]
struct OpenMeteoDaily {
    #[serde(default)]
    sunrise: Vec<String>,
    #[serde(default)]
    sunset: Vec<String>,
}

fn fallback_payload() -> WeatherPayload {
    WeatherPayload {
        live: false,
        condition: "clear",
        weather_code: 0,
        temperature_c: None,
        is_day: None,
        sunrise: None,
        sunset: None,
        timezone: None,
    }
}

pub fn sanitize_coords(lat: Option<f64>, lon: Option<f64>) -> (f64, f64) {
    match (lat, lon) {
        (Some(la), Some(lo))
            if la.is_finite()
                && lo.is_finite()
                && (-90.0..=90.0).contains(&la)
                && (-180.0..=180.0).contains(&lo) =>
        {
            (la, lo)
        }
        _ => (DEFAULT_LAT, DEFAULT_LON),
    }
}

pub fn classify_wmo_code(code: i64) -> &'static str {
    match code {
        71 | 73 | 75 | 77 | 85 | 86 => "snow",
        51 | 53 | 55 | 56 | 57 | 61 | 63 | 65 | 66 | 67 | 80 | 81 | 82 | 95 | 96 | 99 => "rain",
        2 | 3 | 45 | 48 => "cloudy",
        _ => "clear",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_valid_and_invalid_coordinates() {
        assert_eq!(sanitize_coords(Some(-6.2), Some(106.8)), (-6.2, 106.8));
        assert_eq!(
            sanitize_coords(Some(999.0), Some(106.8)),
            (DEFAULT_LAT, DEFAULT_LON)
        );
        assert_eq!(
            sanitize_coords(Some(f64::NAN), Some(10.0)),
            (DEFAULT_LAT, DEFAULT_LON)
        );
        assert_eq!(sanitize_coords(None, None), (DEFAULT_LAT, DEFAULT_LON));
    }

    #[test]
    fn classifies_wmo_weather_codes() {
        assert_eq!(classify_wmo_code(0), "clear");
        assert_eq!(classify_wmo_code(3), "cloudy");
        assert_eq!(classify_wmo_code(63), "rain");
        assert_eq!(classify_wmo_code(95), "rain");
        assert_eq!(classify_wmo_code(73), "snow");
        assert_eq!(classify_wmo_code(86), "snow");
    }
}
