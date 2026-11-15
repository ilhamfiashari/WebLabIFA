use axum::http::HeaderMap;
use chrono::Utc;
use sqlx::PgPool;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    time::{Duration, timeout},
};
use uuid::Uuid;

use crate::Identity;

#[derive(Clone, Debug)]
pub struct SessionTelemetry {
    pub ip_address: String,
    pub user_agent: String,
    pub device_label: String,
    pub location_label: String,
}

pub fn extract_telemetry(headers: &HeaderMap) -> SessionTelemetry {
    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|raw| raw.split(',').next())
        .map(str::trim)
        .filter(|s| !s.is_empty() && s.len() <= 64)
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(str::trim)
                .filter(|s| !s.is_empty() && s.len() <= 64)
        })
        .unwrap_or("127.0.0.1")
        .to_string();

    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.chars().take(180).collect::<String>())
        .unwrap_or_else(|| "Browser Web".to_string());

    let device_label = parse_device_label(&user_agent);
    let location_label = headers
        .get("x-geo-city")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().chars().take(64).collect::<String>())
        .filter(|s| !s.is_empty())
        .or_else(|| {
            headers
                .get("cf-ipcountry")
                .and_then(|v| v.to_str().ok())
                .map(|c| format!("Negara {}", c.trim().to_uppercase()))
        })
        .unwrap_or_else(|| infer_location_from_ip(&ip_address));

    SessionTelemetry {
        ip_address,
        user_agent,
        device_label,
        location_label,
    }
}

pub fn parse_device_label(ua: &str) -> String {
    let lower = ua.to_ascii_lowercase();
    let browser = if lower.contains("edg/") {
        "Edge"
    } else if lower.contains("firefox/") {
        "Firefox"
    } else if lower.contains("chrome/") || lower.contains("chromium/") {
        "Chrome"
    } else if lower.contains("safari/") {
        "Safari"
    } else if lower.contains("curl") {
        "CLI HTTP"
    } else {
        "Browser"
    };
    let os = if lower.contains("iphone") || lower.contains("ipad") {
        "iOS"
    } else if lower.contains("android") {
        "Android"
    } else if lower.contains("mac os") || lower.contains("macintosh") {
        "macOS"
    } else if lower.contains("windows") {
        "Windows"
    } else if lower.contains("linux") {
        "Linux"
    } else {
        "Perangkat Web"
    };
    format!("{browser} · {os}")
}

fn infer_location_from_ip(ip: &str) -> String {
    if ip == "127.0.0.1" || ip == "::1" || ip.starts_with("192.168.") || ip.starts_with("10.") {
        "Jaringan Lokal / Kampus".to_string()
    } else if ip.starts_with("172.") {
        "Jaringan Container Internal".to_string()
    } else {
        format!("Jaringan Publik ({ip})")
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn record_activity(
    pool: &PgPool,
    user_id: Option<Uuid>,
    actor_email: Option<&str>,
    session_id: Option<Uuid>,
    action: &str,
    route_path: Option<&str>,
    telemetry: &SessionTelemetry,
    anomaly_flag: bool,
    detail: &str,
) {
    let _ = sqlx::query(
        "INSERT INTO user_activity_logs(id,user_id,actor_email,session_id,action,route_path,ip_address,device_label,location_label,anomaly_flag,detail) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(actor_email)
    .bind(session_id)
    .bind(action)
    .bind(route_path)
    .bind(&telemetry.ip_address)
    .bind(&telemetry.device_label)
    .bind(&telemetry.location_label)
    .bind(anomaly_flag)
    .bind(detail)
    .execute(pool)
    .await;
}

pub async fn record_rejected_login_anomaly(
    pool: &PgPool,
    reason: &str,
    telemetry: &SessionTelemetry,
) {
    let summary = format!(
        "Percobaan login ditolak ({reason}) dari {}",
        telemetry.device_label
    );
    let _ = sqlx::query(
        "INSERT INTO security_anomalies(id,kind,severity,summary,ip_address,device_label,location_label) VALUES($1,'rejected_access','medium',$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(&summary)
    .bind(&telemetry.ip_address)
    .bind(&telemetry.device_label)
    .bind(&telemetry.location_label)
    .execute(pool)
    .await;
    record_activity(
        pool,
        None,
        None,
        None,
        "login_rejected",
        Some("/login"),
        telemetry,
        true,
        &summary,
    )
    .await;
}

pub async fn evaluate_login_anomalies(
    pool: &PgPool,
    user_id: Uuid,
    email: &str,
    session_id: Uuid,
    role: &str,
    telemetry: &SessionTelemetry,
) {
    let known_device: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM user_activity_logs WHERE user_id=$1 AND action='login_success' AND device_label=$2 LIMIT 1",
    )
    .bind(user_id)
    .bind(&telemetry.device_label)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let known_location: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM user_activity_logs WHERE user_id=$1 AND action='login_success' AND location_label=$2 LIMIT 1",
    )
    .bind(user_id)
    .bind(&telemetry.location_label)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let has_prior_login: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM user_activity_logs WHERE user_id=$1 AND action='login_success' LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let active_other_ip: Option<(String,)> = sqlx::query_as(
        "SELECT COALESCE(ip_address,'') FROM sessions WHERE user_id=$1 AND session_id<>$2 AND expires_at>now() AND COALESCE(ip_address,'')<>'' AND COALESCE(ip_address,'')<>$3 LIMIT 1",
    )
    .bind(user_id)
    .bind(session_id)
    .bind(&telemetry.ip_address)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let mut flagged = false;
    if has_prior_login.is_some() && known_device.is_none() {
        flagged = true;
        let summary = format!(
            "Login dari perangkat baru ({}) untuk akun {}",
            telemetry.device_label, email
        );
        insert_anomaly_and_alert(
            pool,
            user_id,
            email,
            session_id,
            "new_device",
            "medium",
            &summary,
            telemetry,
        )
        .await;
    }

    if has_prior_login.is_some() && known_location.is_none() {
        flagged = true;
        let summary = format!(
            "Login dari lokasi/jaringan baru ({}) untuk akun {}",
            telemetry.location_label, email
        );
        insert_anomaly_and_alert(
            pool,
            user_id,
            email,
            session_id,
            "new_location",
            "medium",
            &summary,
            telemetry,
        )
        .await;
    }

    if let Some((other_ip,)) = active_other_ip {
        flagged = true;
        let summary = format!(
            "Sesi bersamaan terdeteksi dari IP berbeda ({} & {}) untuk {}",
            other_ip, telemetry.ip_address, email
        );
        insert_anomaly_and_alert(
            pool,
            user_id,
            email,
            session_id,
            "concurrent_location",
            "high",
            &summary,
            telemetry,
        )
        .await;
    }

    let detail = format!(
        "Login berhasil sebagai {role} melalui {}",
        telemetry.device_label
    );
    record_activity(
        pool,
        Some(user_id),
        Some(email),
        Some(session_id),
        "login_success",
        Some(if role == "admin" {
            "/lab/admin"
        } else if role == "dosen" {
            "/lab/dosen"
        } else {
            "/lab"
        }),
        telemetry,
        flagged,
        &detail,
    )
    .await;
}

#[allow(clippy::too_many_arguments)]
async fn insert_anomaly_and_alert(
    pool: &PgPool,
    user_id: Uuid,
    email: &str,
    session_id: Uuid,
    kind: &str,
    severity: &str,
    summary: &str,
    telemetry: &SessionTelemetry,
) {
    let _ = sqlx::query(
        "INSERT INTO security_anomalies(id,user_id,actor_email,session_id,kind,severity,summary,ip_address,device_label,location_label) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(email)
    .bind(session_id)
    .bind(kind)
    .bind(severity)
    .bind(summary)
    .bind(&telemetry.ip_address)
    .bind(&telemetry.device_label)
    .bind(&telemetry.location_label)
    .execute(pool)
    .await;

    queue_email_notification(
        pool,
        user_id,
        "security_alert",
        "Peringatan Keamanan Akun WebLabIFA",
        &format!(
            "{summary}. IP: {}, Lokasi: {}. Segera periksa sesi aktif di Pengaturan Akun jika bukan Anda.",
            telemetry.ip_address, telemetry.location_label
        ),
    )
    .await;
}

/// Memasukkan notifikasi ke outbox email & kotak masuk pengguna (mematuhi preferensi email).
pub async fn queue_email_notification(
    pool: &PgPool,
    user_id: Uuid,
    category: &str,
    subject: &str,
    body_preview: &str,
) {
    let row: Option<(String, Option<String>, bool, bool, bool)> = sqlx::query_as(
        "SELECT u.email, s.secondary_email, COALESCE(s.notify_assignments,true), COALESCE(s.notify_feedback,true), COALESCE(s.notify_security_alerts,true) FROM users u LEFT JOIN user_security_settings s ON s.user_id=u.id WHERE u.id=$1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let Some((primary_email, secondary_email, n_assign, n_feed, n_sec)) = row else {
        return;
    };

    let allowed = match category {
        "assignment" => n_assign,
        "feedback" => n_feed,
        "security_alert" => n_sec,
        _ => true,
    };
    let recipient = secondary_email
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(primary_email);

    let status = if !allowed {
        "skipped"
    } else {
        let _ = try_smtp_relay(&recipient, subject, body_preview).await;
        "sent"
    };

    let sent_at = if status == "sent" {
        Some(Utc::now())
    } else {
        None
    };

    let _ = sqlx::query(
        "INSERT INTO email_notifications(id,user_id,recipient_email,category,subject,body_preview,status,sent_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&recipient)
    .bind(category)
    .bind(subject)
    .bind(body_preview)
    .bind(status)
    .bind(sent_at)
    .execute(pool)
    .await;

    tracing::info!(
        event = "email_notification_processed",
        category = category,
        status = status
    );
}

async fn try_smtp_relay(recipient: &str, subject: &str, body: &str) -> bool {
    let Ok(addr) = std::env::var("SMTP_RELAY_ADDR") else {
        return false;
    };
    if addr.trim().is_empty() {
        return false;
    }
    let from = std::env::var("SMTP_FROM").unwrap_or_else(|_| "no-reply@ifalab.local".to_string());
    let payload = format!(
        "EHLO weblabifa.local\r\nMAIL FROM:<{from}>\r\nRCPT TO:<{recipient}>\r\nDATA\r\nFrom: WebLabIFA <{from}>\r\nTo: <{recipient}>\r\nSubject: {subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{body}\r\n.\r\nQUIT\r\n"
    );
    let send = async {
        let mut stream = TcpStream::connect(addr.trim()).await.ok()?;
        let mut buf = [0u8; 256];
        let _ = stream.read(&mut buf).await.ok();
        stream.write_all(payload.as_bytes()).await.ok()?;
        let _ = stream.flush().await;
        Some(true)
    };
    matches!(timeout(Duration::from_secs(2), send).await, Ok(Some(true)))
}

pub async fn notify_class_students_assignment(
    pool: &PgPool,
    class_id: &str,
    title: &str,
    lab_id: &str,
    due_in_days: i64,
) {
    let student_ids: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT user_id FROM class_memberships WHERE class_id=$1 AND role_in_class='mahasiswa'",
    )
    .bind(class_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let subject = format!("[Tugas Baru {class_id}] {title}");
    let body = format!(
        "Dosen mempublikasikan tugas praktikum {title} (modul {lab_id}). Batas pengumpulan: {due_in_days} hari dari sekarang."
    );
    for (uid,) in student_ids {
        queue_email_notification(pool, uid, "assignment", &subject, &body).await;
    }
}

pub async fn notify_student_feedback(pool: &PgPool, student_id: Uuid, lab_id: &str, comment: &str) {
    let preview: String = comment.chars().take(160).collect();
    queue_email_notification(
        pool,
        student_id,
        "feedback",
        &format!("Umpan Balik Baru pada Modul {lab_id}"),
        &format!("Dosen menambahkan catatan pada sesi Anda: \"{preview}\""),
    )
    .await;
}

pub async fn record_context_switch_event(
    pool: &PgPool,
    actor: &Identity,
    new_role: &str,
    headers: &HeaderMap,
) {
    let telemetry = extract_telemetry(headers);
    record_activity(
        pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "context_switched",
        Some(if new_role == "admin" {
            "/lab/admin"
        } else if new_role == "dosen" {
            "/lab/dosen"
        } else {
            "/lab"
        }),
        &telemetry,
        false,
        &format!("Beralih peran aktif ke {new_role}"),
    )
    .await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_parser_identifies_browser_and_os() {
        let label = parse_device_label(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36",
        );
        assert_eq!(label, "Chrome · macOS");
        assert_eq!(
            parse_device_label("Mozilla/5.0 (Windows NT 10.0) Firefox/131.0"),
            "Firefox · Windows"
        );
    }
}
