//! Parser dan eksportir format Bank Soal standar Moodle LMS
//! (Moodle XML, GIFT, Aiken, dan JSON) dengan pembatasan ketat hanya untuk
//! jalur `web` (Cyber Security) dan `iot` (IoT), proteksi anti-XXE, serta sanitasi HTML.

use crate::latihan::{Choice, Exercise, normalize};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const MAX_IMPORT_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportFormat {
    Auto,
    MoodleXml,
    MoodleGift,
    Aiken,
    Json,
}

#[derive(Debug, Serialize)]
pub struct ParsedQuestionPreview {
    pub title: String,
    pub track: String,
    pub level: u8,
    pub kind: String,
    pub question: String,
    pub options_count: usize,
    pub answer_preview: Vec<String>,
    pub tags: Vec<String>,
    pub source_format: String,
}

/// Pastikan track hanya 'web' (Cyber Security) atau 'iot' (IoT).
pub fn normalize_track(track: &str) -> Result<String, String> {
    match track.trim().to_ascii_lowercase().as_str() {
        "web" | "cyber" | "cyber_security" | "cybersecurity" | "cyber security" => {
            Ok("web".to_string())
        }
        "iot" | "internet_of_things" | "internet of things" => Ok("iot".to_string()),
        _ => Err(format!(
            "Jalur tidak valid '{}': hanya diizinkan Cyber Security ('web') atau IoT ('iot').",
            track.trim()
        )),
    }
}

/// Bersihkan teks HTML dari Moodle XML/GIFT tanpa mengeksekusi script atau entitas berbahaya.
pub fn sanitize_moodle_text(raw: &str) -> String {
    let mut s = raw.trim().to_string();
    // Buang pembungkus CDATA
    s = s.replace("<![CDATA[", "").replace("]]>", "");
    // Ganti tag blok umum menjadi spasi / baris baru
    for br in ["<br>", "<br/>", "<br />", "</p>", "</div>", "</li>"] {
        s = s.replace(br, "\n");
    }
    // Hapus blok <script>...</script> dan <style>...</style> beserta isinya
    s = strip_tag_block(&s, "script");
    s = strip_tag_block(&s, "style");

    // Hapus seluruh sisa tag HTML <...>
    let mut plain = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        if ch == '<' {
            in_tag = true;
            continue;
        }
        if ch == '>' && in_tag {
            in_tag = false;
            continue;
        }
        if !in_tag {
            plain.push(ch);
        }
    }

    let decoded = decode_entities(&plain);
    decoded
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn strip_tag_block(input: &str, tag: &str) -> String {
    let lower = input.to_ascii_lowercase();
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let mut out = String::with_capacity(input.len());
    let mut idx = 0;
    while idx < input.len() {
        if let Some(rel_start) = lower[idx..].find(&open) {
            let start = idx + rel_start;
            out.push_str(&input[idx..start]);
            if let Some(rel_end) = lower[start..].find(&close) {
                idx = start + rel_end + close.len();
            } else {
                break;
            }
        } else {
            out.push_str(&input[idx..]);
            break;
        }
    }
    out
}

fn decode_entities(s: &str) -> String {
    s.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub fn detect_format(raw: &str, requested: ImportFormat) -> ImportFormat {
    if requested != ImportFormat::Auto {
        return requested;
    }
    let trimmed = raw.trim_start();
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("<?xml") || lower.contains("<quiz") || lower.contains("<question") {
        ImportFormat::MoodleXml
    } else if trimmed.starts_with('[') || trimmed.starts_with('{') {
        ImportFormat::Json
    } else if raw
        .lines()
        .any(|l| l.trim_start().to_ascii_uppercase().starts_with("ANSWER:"))
    {
        ImportFormat::Aiken
    } else {
        ImportFormat::MoodleGift
    }
}

pub fn parse_import(
    raw: &str,
    requested_format: ImportFormat,
    track: &str,
    default_level: u8,
    max_questions: usize,
) -> Result<(Vec<Exercise>, String), String> {
    if raw.len() > MAX_IMPORT_BYTES {
        return Err(format!(
            "Ukuran file melebihi batas {} KB.",
            MAX_IMPORT_BYTES / 1024
        ));
    }
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Konten impor kosong.".to_string());
    }
    let clean_track = normalize_track(track)?;
    let level = default_level.clamp(1, 4);

    let detected = detect_format(trimmed, requested_format);
    let (mut items, fmt_label) = match detected {
        ImportFormat::MoodleXml => (
            parse_moodle_xml(trimmed, &clean_track, level)?,
            "moodle_xml",
        ),
        ImportFormat::MoodleGift => (
            parse_moodle_gift(trimmed, &clean_track, level)?,
            "moodle_gift",
        ),
        ImportFormat::Aiken => (parse_aiken(trimmed, &clean_track, level)?, "aiken"),
        ImportFormat::Json => (parse_json_bank(trimmed, &clean_track, level)?, "json"),
        ImportFormat::Auto => unreachable!(),
    };

    if items.is_empty() {
        return Err("Tidak ada soal valid yang ditemukan pada berkas impor.".to_string());
    }
    if items.len() > max_questions {
        return Err(format!(
            "Jumlah soal ({}) melebihi batas admin ({max_questions} soal per impor).",
            items.len()
        ));
    }

    for item in &mut items {
        item.track = normalize_track(&item.track)?;
        item.level = item.level.clamp(1, 4);
        item.source_format = fmt_label.to_string();
    }

    Ok((items, fmt_label.to_string()))
}

fn extract_tag_inner(block: &str, tag: &str) -> Option<String> {
    let lower = block.to_ascii_lowercase();
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let start = lower.find(&open)?;
    let gt = block[start..].find('>')? + start + 1;
    let end = lower[gt..].find(&close)? + gt;
    Some(block[gt..end].to_string())
}

fn extract_all_blocks(block: &str, tag: &str) -> Vec<(String, String)> {
    let lower = block.to_ascii_lowercase();
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let mut out = Vec::new();
    let mut pos = 0;
    while pos < block.len() {
        let Some(rel_start) = lower[pos..].find(&open) else {
            break;
        };
        let start = pos + rel_start;
        // Pastikan batas tag (spasi atau '>')
        let after = block[start + open.len()..].chars().next();
        if !matches!(
            after,
            Some('>') | Some(' ') | Some('\t') | Some('\n') | Some('\r')
        ) {
            pos = start + open.len();
            continue;
        }
        let Some(rel_gt) = block[start..].find('>') else {
            break;
        };
        let gt = start + rel_gt + 1;
        let Some(rel_end) = lower[gt..].find(&close) else {
            break;
        };
        let end = gt + rel_end;
        let attrs = block[start + open.len()..gt - 1].to_string();
        let inner = block[gt..end].to_string();
        out.push((attrs, inner));
        pos = end + close.len();
    }
    out
}

fn extract_attr(attrs: &str, name: &str) -> Option<String> {
    let needle = format!("{name}=");
    let lower = attrs.to_ascii_lowercase();
    let pos = lower.find(&needle)? + needle.len();
    let rest = attrs[pos..].trim_start();
    let quote = rest.chars().next()?;
    if quote == '"' || quote == '\'' {
        let end = rest[1..].find(quote)?;
        Some(rest[1..1 + end].to_string())
    } else {
        Some(
            rest.split_whitespace()
                .next()
                .unwrap_or_default()
                .to_string(),
        )
    }
}

fn make_id(track: &str, level: u8) -> String {
    let short = Uuid::new_v4().simple().to_string();
    format!("moodle-{track}-l{level}-{}", &short[..8])
}

fn parse_moodle_xml(raw: &str, track: &str, default_level: u8) -> Result<Vec<Exercise>, String> {
    let upper = raw.to_ascii_uppercase();
    // Anti-XXE: tolak berkas yang mendeklarasikan DOCTYPE atau ENTITY XML eksternal
    if upper.contains("<!DOCTYPE") || upper.contains("<!ENTITY") {
        return Err(
            "Keamanan XML: Deklarasi <!DOCTYPE> dan <!ENTITY> tidak diizinkan untuk mencegah XXE."
                .to_string(),
        );
    }

    let q_blocks = extract_all_blocks(raw, "question");
    if q_blocks.is_empty() {
        return Err("Elemen <question> Moodle XML tidak ditemukan.".to_string());
    }

    let mut parsed = Vec::new();
    for (attrs, body) in q_blocks {
        let qtype = extract_attr(&attrs, "type")
            .unwrap_or_default()
            .to_ascii_lowercase();
        if qtype == "category" || qtype == "description" {
            continue;
        }
        let raw_name = extract_tag_inner(&body, "name")
            .and_then(|n| extract_tag_inner(&n, "text"))
            .unwrap_or_default();
        let raw_qtext = extract_tag_inner(&body, "questiontext")
            .and_then(|q| extract_tag_inner(&q, "text"))
            .unwrap_or_default();
        let raw_gen_fb = extract_tag_inner(&body, "generalfeedback")
            .and_then(|f| extract_tag_inner(&f, "text"))
            .unwrap_or_default();
        let raw_hint = extract_tag_inner(&body, "hint")
            .and_then(|h| extract_tag_inner(&h, "text"))
            .unwrap_or_default();

        let question_text = sanitize_moodle_text(&raw_qtext);
        if question_text.is_empty() {
            continue;
        }
        let title = {
            let clean_name = sanitize_moodle_text(&raw_name);
            if clean_name.is_empty() {
                question_text.chars().take(60).collect()
            } else {
                clean_name
            }
        };

        let answer_blocks = extract_all_blocks(&body, "answer");
        if answer_blocks.is_empty() {
            continue;
        }

        let mut tags: Vec<String> = extract_all_blocks(&body, "tag")
            .into_iter()
            .filter_map(|(_, inner)| extract_tag_inner(&inner, "text"))
            .map(|t| sanitize_moodle_text(&t))
            .filter(|t| !t.is_empty())
            .collect();
        if !tags.iter().any(|t| t.eq_ignore_ascii_case("Moodle XML")) {
            tags.push("Moodle XML".to_string());
        }

        let explanation_base = sanitize_moodle_text(&raw_gen_fb);
        let hint_clean = if sanitize_moodle_text(&raw_hint).is_empty() {
            "Periksa ulang skenario dan kata kunci keamanan terkait sebelum menjawab.".to_string()
        } else {
            sanitize_moodle_text(&raw_hint)
        };

        if qtype == "shortanswer" {
            let mut accepted = Vec::new();
            let mut ans_feedbacks = Vec::new();
            for (a_attrs, a_body) in &answer_blocks {
                let frac: f64 = extract_attr(a_attrs, "fraction")
                    .and_then(|f| f.parse().ok())
                    .unwrap_or(100.0);
                let txt = extract_tag_inner(a_body, "text").unwrap_or_default();
                let clean_ans = normalize(&sanitize_moodle_text(&txt));
                if frac > 0.0 && !clean_ans.is_empty() && !accepted.contains(&clean_ans) {
                    accepted.push(clean_ans);
                }
                if let Some(fb) = extract_tag_inner(a_body, "feedback")
                    .and_then(|f| extract_tag_inner(&f, "text"))
                {
                    let cfb = sanitize_moodle_text(&fb);
                    if !cfb.is_empty() {
                        ans_feedbacks.push(cfb);
                    }
                }
            }
            if accepted.is_empty() {
                continue;
            }
            let explanation = if !explanation_base.is_empty() {
                explanation_base
            } else if !ans_feedbacks.is_empty() {
                ans_feedbacks.join(" ")
            } else {
                format!("Jawaban yang diterima: {}", accepted.join(", "))
            };
            parsed.push(Exercise {
                id: make_id(track, default_level),
                track: track.to_string(),
                level: default_level,
                title,
                owasp: None,
                scenario: question_text.clone(),
                code: None,
                code_lang: None,
                question: question_text,
                kind: "isian".to_string(),
                options: Vec::new(),
                answer: accepted,
                hint: hint_clean,
                explanation,
                estimated_minutes: 5,
                tags,
                source_format: "moodle_xml".to_string(),
            });
        } else {
            // multichoice / truefalse
            let mut options = Vec::new();
            let mut correct_key: Option<String> = None;
            let mut correct_fb = String::new();
            for (idx, (a_attrs, a_body)) in answer_blocks.iter().enumerate() {
                if idx >= 8 {
                    break;
                }
                let key = ((b'a' + idx as u8) as char).to_string();
                let txt = extract_tag_inner(a_body, "text").unwrap_or_default();
                let mut clean_opt = sanitize_moodle_text(&txt);
                if qtype == "truefalse" {
                    clean_opt = match clean_opt.to_ascii_lowercase().as_str() {
                        "true" => "Benar (True)".to_string(),
                        "false" => "Salah (False)".to_string(),
                        _ => clean_opt,
                    };
                }
                if clean_opt.is_empty() {
                    continue;
                }
                let frac: f64 = extract_attr(a_attrs, "fraction")
                    .and_then(|f| f.parse().ok())
                    .unwrap_or(0.0);
                if frac >= 50.0 && correct_key.is_none() {
                    correct_key = Some(key.clone());
                    if let Some(fb) = extract_tag_inner(a_body, "feedback")
                        .and_then(|f| extract_tag_inner(&f, "text"))
                    {
                        correct_fb = sanitize_moodle_text(&fb);
                    }
                }
                options.push(Choice {
                    key,
                    text: clean_opt,
                });
            }
            let Some(ans_key) = correct_key else {
                continue;
            };
            if options.len() < 2 {
                continue;
            }
            let explanation = if !explanation_base.is_empty() {
                explanation_base
            } else if !correct_fb.is_empty() {
                correct_fb
            } else {
                format!("Opsi yang benar adalah {}.", ans_key.to_ascii_uppercase())
            };
            parsed.push(Exercise {
                id: make_id(track, default_level),
                track: track.to_string(),
                level: default_level,
                title,
                owasp: None,
                scenario: question_text.clone(),
                code: None,
                code_lang: None,
                question: question_text,
                kind: "pilihan".to_string(),
                options,
                answer: vec![ans_key],
                hint: hint_clean,
                explanation,
                estimated_minutes: 5,
                tags,
                source_format: "moodle_xml".to_string(),
            });
        }
    }

    Ok(parsed)
}

fn parse_moodle_gift(raw: &str, track: &str, default_level: u8) -> Result<Vec<Exercise>, String> {
    let cleaned_lines: Vec<&str> = raw
        .lines()
        .map(str::trim)
        .filter(|l| !l.starts_with("//") && !l.starts_with("$CATEGORY"))
        .collect();
    let joined = cleaned_lines.join("\n");
    let mut parsed = Vec::new();

    for block in joined.split("\n\n") {
        let chunk = block.trim();
        if chunk.is_empty() {
            continue;
        }
        let Some(brace_open) = chunk.find('{') else {
            continue;
        };
        let Some(brace_close) = chunk.rfind('}') else {
            continue;
        };
        if brace_close <= brace_open {
            continue;
        }
        let header = chunk[..brace_open].trim();
        let body = chunk[brace_open + 1..brace_close].trim();

        let (title, question_raw) = if let Some(after_start) = header.strip_prefix("::") {
            if let Some(end_title) = after_start.find("::") {
                (
                    sanitize_moodle_text(&after_start[..end_title]),
                    sanitize_moodle_text(&after_start[end_title + 2..]),
                )
            } else {
                (String::new(), sanitize_moodle_text(header))
            }
        } else {
            (String::new(), sanitize_moodle_text(header))
        };

        if question_raw.is_empty() {
            continue;
        }
        let final_title = if title.is_empty() {
            question_raw.chars().take(60).collect()
        } else {
            title
        };

        let upper_body = body.to_ascii_uppercase();
        if matches!(upper_body.as_str(), "T" | "TRUE" | "F" | "FALSE") {
            let ans = if upper_body.starts_with('T') {
                "a"
            } else {
                "b"
            };
            parsed.push(Exercise {
                id: make_id(track, default_level),
                track: track.to_string(),
                level: default_level,
                title: final_title,
                owasp: None,
                scenario: question_raw.clone(),
                code: None,
                code_lang: None,
                question: question_raw,
                kind: "pilihan".to_string(),
                options: vec![
                    Choice {
                        key: "a".to_string(),
                        text: "Benar (True)".to_string(),
                    },
                    Choice {
                        key: "b".to_string(),
                        text: "Salah (False)".to_string(),
                    },
                ],
                answer: vec![ans.to_string()],
                hint: "Tentukan apakah pernyataan tersebut benar atau salah.".to_string(),
                explanation: format!(
                    "Pernyataan bernilai {}.",
                    if ans == "a" { "Benar" } else { "Salah" }
                ),
                estimated_minutes: 4,
                tags: vec!["GIFT".to_string()],
                source_format: "moodle_gift".to_string(),
            });
            continue;
        }

        // Tokenize `=` (correct) and `~` (wrong) markers in GIFT body
        let mut items: Vec<(bool, String, String)> = Vec::new();
        let mut cur_correct = false;
        let mut cur_buf = String::new();
        let mut started = false;
        let mut escaped = false;
        for ch in body.chars() {
            if escaped {
                cur_buf.push(ch);
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == '=' || ch == '~' {
                if started {
                    let (ans, fb) = split_gift_feedback(&cur_buf);
                    if !ans.is_empty() {
                        items.push((cur_correct, ans, fb));
                    }
                    cur_buf.clear();
                }
                started = true;
                cur_correct = ch == '=';
            } else {
                cur_buf.push(ch);
            }
        }
        if started {
            let (ans, fb) = split_gift_feedback(&cur_buf);
            if !ans.is_empty() {
                items.push((cur_correct, ans, fb));
            }
        }

        if items.is_empty() {
            continue;
        }
        let has_wrong = items.iter().any(|(ok, _, _)| !ok);
        if has_wrong {
            let mut options = Vec::new();
            let mut correct_key = None;
            let mut feedback = String::new();
            for (idx, (ok, text, fb)) in items.into_iter().take(8).enumerate() {
                let key = ((b'a' + idx as u8) as char).to_string();
                if ok && correct_key.is_none() {
                    correct_key = Some(key.clone());
                    feedback = fb;
                }
                options.push(Choice { key, text });
            }
            let Some(ans_key) = correct_key else {
                continue;
            };
            if options.len() < 2 {
                continue;
            }
            parsed.push(Exercise {
                id: make_id(track, default_level),
                track: track.to_string(),
                level: default_level,
                title: final_title,
                owasp: None,
                scenario: question_raw.clone(),
                code: None,
                code_lang: None,
                question: question_raw,
                kind: "pilihan".to_string(),
                options,
                answer: vec![ans_key.clone()],
                hint: "Analisis seluruh opsi sesuai prinsip Cyber Security atau IoT.".to_string(),
                explanation: if feedback.is_empty() {
                    format!(
                        "Jawaban benar adalah opsi {}.",
                        ans_key.to_ascii_uppercase()
                    )
                } else {
                    feedback
                },
                estimated_minutes: 5,
                tags: vec!["GIFT".to_string()],
                source_format: "moodle_gift".to_string(),
            });
        } else {
            let accepted: Vec<String> = items
                .iter()
                .map(|(_, ans, _)| normalize(ans))
                .filter(|a| !a.is_empty())
                .collect();
            if accepted.is_empty() {
                continue;
            }
            let fb = items
                .iter()
                .map(|(_, _, f)| f.clone())
                .find(|f| !f.is_empty())
                .unwrap_or_else(|| format!("Jawaban yang diterima: {}", accepted.join(", ")));
            parsed.push(Exercise {
                id: make_id(track, default_level),
                track: track.to_string(),
                level: default_level,
                title: final_title,
                owasp: None,
                scenario: question_raw.clone(),
                code: None,
                code_lang: None,
                question: question_raw,
                kind: "isian".to_string(),
                options: Vec::new(),
                answer: accepted,
                hint: "Masukkan istilah atau angka teknis secara ringkas dan tepat.".to_string(),
                explanation: fb,
                estimated_minutes: 5,
                tags: vec!["GIFT".to_string()],
                source_format: "moodle_gift".to_string(),
            });
        }
    }

    Ok(parsed)
}

fn split_gift_feedback(raw: &str) -> (String, String) {
    if let Some(pos) = raw.find('#') {
        (
            sanitize_moodle_text(&raw[..pos]),
            sanitize_moodle_text(&raw[pos + 1..]),
        )
    } else {
        (sanitize_moodle_text(raw), String::new())
    }
}

fn parse_aiken(raw: &str, track: &str, default_level: u8) -> Result<Vec<Exercise>, String> {
    let mut parsed = Vec::new();
    let mut question_lines: Vec<String> = Vec::new();
    let mut options: Vec<Choice> = Vec::new();

    for line in raw.lines() {
        let l = line.trim();
        if l.is_empty() {
            continue;
        }
        let upper = l.to_ascii_uppercase();
        if let Some(rest) = upper.strip_prefix("ANSWER:") {
            let ans_char = rest
                .trim()
                .chars()
                .next()
                .map(|c| c.to_ascii_lowercase().to_string())
                .unwrap_or_default();
            let q = sanitize_moodle_text(&question_lines.join(" "));
            if !q.is_empty() && options.len() >= 2 && options.iter().any(|o| o.key == ans_char) {
                parsed.push(Exercise {
                    id: make_id(track, default_level),
                    track: track.to_string(),
                    level: default_level,
                    title: q.chars().take(60).collect(),
                    owasp: None,
                    scenario: q.clone(),
                    code: None,
                    code_lang: None,
                    question: q,
                    kind: "pilihan".to_string(),
                    options: options.clone(),
                    answer: vec![ans_char.clone()],
                    hint: "Pilih jawaban paling tepat sesuai standar keamanan.".to_string(),
                    explanation: format!(
                        "Kunci jawaban sesuai format Aiken: {}",
                        ans_char.to_ascii_uppercase()
                    ),
                    estimated_minutes: 4,
                    tags: vec!["Aiken".to_string()],
                    source_format: "aiken".to_string(),
                });
            }
            question_lines.clear();
            options.clear();
            continue;
        }

        if l.len() > 3 {
            let bytes = l.as_bytes();
            let first = bytes[0];
            if first.is_ascii_alphabetic()
                && (bytes[1] == b'.' || bytes[1] == b')')
                && bytes[2] == b' '
            {
                let key = (first.to_ascii_lowercase() as char).to_string();
                let text = sanitize_moodle_text(&l[3..]);
                if !text.is_empty() {
                    options.push(Choice { key, text });
                }
                continue;
            }
        }
        question_lines.push(l.to_string());
    }

    Ok(parsed)
}

#[derive(Deserialize)]
struct JsonImportRow {
    title: Option<String>,
    track: Option<String>,
    level: Option<u8>,
    owasp: Option<String>,
    scenario: Option<String>,
    code: Option<String>,
    code_lang: Option<String>,
    question: String,
    kind: Option<String>,
    #[serde(default)]
    options: Vec<Choice>,
    answer: Vec<String>,
    hint: Option<String>,
    explanation: Option<String>,
    estimated_minutes: Option<i32>,
    #[serde(default)]
    tags: Vec<String>,
}

fn parse_json_bank(
    raw: &str,
    default_track: &str,
    default_level: u8,
) -> Result<Vec<Exercise>, String> {
    let rows: Vec<JsonImportRow> = if raw.trim_start().starts_with('[') {
        serde_json::from_str(raw).map_err(|e| format!("JSON array tidak valid: {e}"))?
    } else {
        #[derive(Deserialize)]
        struct Wrapper {
            exercises: Vec<JsonImportRow>,
        }
        serde_json::from_str::<Wrapper>(raw)
            .map_err(|e| format!("JSON objek (wajib field exercises) tidak valid: {e}"))?
            .exercises
    };

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let track = match r.track {
            Some(t) => normalize_track(&t)?,
            None => default_track.to_string(),
        };
        let level = r.level.unwrap_or(default_level).clamp(1, 4);
        let q = sanitize_moodle_text(&r.question);
        if q.is_empty() || r.answer.is_empty() {
            continue;
        }
        let kind = r.kind.unwrap_or_else(|| {
            if r.options.is_empty() {
                "isian".to_string()
            } else {
                "pilihan".to_string()
            }
        });
        let normalized_ans: Vec<String> = r
            .answer
            .iter()
            .map(|a| normalize(a))
            .filter(|a| !a.is_empty())
            .collect();
        if normalized_ans.is_empty() {
            continue;
        }
        if kind == "pilihan" && (r.options.len() < 2 || normalized_ans.len() != 1) {
            return Err(format!(
                "Opsi atau jawaban pilihan tidak valid pada soal '{}'",
                q
            ));
        }
        out.push(Exercise {
            id: make_id(&track, level),
            track,
            level,
            title: r
                .title
                .map(|t| sanitize_moodle_text(&t))
                .filter(|t| !t.is_empty())
                .unwrap_or_else(|| q.chars().take(60).collect()),
            owasp: r.owasp,
            scenario: r
                .scenario
                .map(|s| sanitize_moodle_text(&s))
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| q.clone()),
            code: r.code,
            code_lang: r.code_lang,
            question: q,
            kind,
            options: r.options,
            answer: normalized_ans,
            hint: r
                .hint
                .unwrap_or_else(|| "Periksa skenario dan standar terkait.".to_string()),
            explanation: r
                .explanation
                .unwrap_or_else(|| "Disimpan melalui impor JSON terstruktur.".to_string()),
            estimated_minutes: r.estimated_minutes.unwrap_or(5).clamp(1, 60),
            tags: if r.tags.is_empty() {
                vec!["JSON".to_string()]
            } else {
                r.tags
            },
            source_format: "json".to_string(),
        });
    }
    Ok(out)
}

pub fn export_moodle_xml(exercises: &[Exercise]) -> String {
    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<quiz>\n");
    for ex in exercises {
        let qtype = if ex.kind == "isian" {
            "shortanswer"
        } else {
            "multichoice"
        };
        xml.push_str(&format!("  <question type=\"{qtype}\">\n"));
        xml.push_str(&format!(
            "    <name><text>{}</text></name>\n",
            xml_escape(&ex.title)
        ));
        let full_text = if ex.scenario != ex.question {
            format!("{}\n{}", ex.scenario, ex.question)
        } else {
            ex.question.clone()
        };
        xml.push_str(&format!(
            "    <questiontext format=\"plain_text\"><text>{}</text></questiontext>\n",
            xml_escape(&full_text)
        ));
        xml.push_str(&format!(
            "    <generalfeedback format=\"plain_text\"><text>{}</text></generalfeedback>\n",
            xml_escape(&ex.explanation)
        ));
        xml.push_str(&format!(
            "    <hint format=\"plain_text\"><text>{}</text></hint>\n",
            xml_escape(&ex.hint)
        ));
        if ex.kind == "isian" {
            for ans in &ex.answer {
                xml.push_str(&format!(
                    "    <answer fraction=\"100\" format=\"plain_text\"><text>{}</text></answer>\n",
                    xml_escape(ans)
                ));
            }
        } else {
            xml.push_str("    <single>true</single>\n");
            for opt in &ex.options {
                let frac = if ex.answer.contains(&opt.key) {
                    "100"
                } else {
                    "0"
                };
                xml.push_str(&format!(
                    "    <answer fraction=\"{frac}\" format=\"plain_text\"><text>{}</text></answer>\n",
                    xml_escape(&opt.text)
                ));
            }
        }
        xml.push_str(&format!(
            "    <tags><tag><text>{}</text></tag></tags>\n",
            xml_escape(if ex.track == "iot" {
                "IoT"
            } else {
                "Cyber Security"
            })
        ));
        xml.push_str("  </question>\n");
    }
    xml.push_str("</quiz>\n");
    xml
}

pub fn export_moodle_gift(exercises: &[Exercise]) -> String {
    let mut out = String::from("// IFA Lab Question Bank Export (Moodle GIFT)\n\n");
    for ex in exercises {
        let body = if ex.kind == "isian" {
            ex.answer
                .iter()
                .map(|a| format!("={a}"))
                .collect::<Vec<_>>()
                .join(" ")
        } else {
            ex.options
                .iter()
                .map(|o| {
                    let prefix = if ex.answer.contains(&o.key) { "=" } else { "~" };
                    format!("{prefix}{}", o.text.replace('{', "(").replace('}', ")"))
                })
                .collect::<Vec<_>>()
                .join(" ")
        };
        out.push_str(&format!(
            "::{}:: {} {{\n  {body}\n  #### {}\n}}\n\n",
            ex.title.replace("::", "-"),
            ex.question.replace('{', "(").replace('}', ")"),
            ex.explanation
        ));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enforces_only_two_tracks_cyber_and_iot() {
        assert_eq!(normalize_track("web").unwrap(), "web");
        assert_eq!(normalize_track("Cyber Security").unwrap(), "web");
        assert_eq!(normalize_track("iot").unwrap(), "iot");
        assert_eq!(normalize_track("IoT").unwrap(), "iot");
        assert!(normalize_track("ai").is_err());
        assert!(normalize_track("keamanan_iot_invalid").is_err());
    }

    #[test]
    fn blocks_xxe_doctype_and_sanitizes_xss_in_moodle_xml() {
        let xxe = r#"<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><quiz><question type="truefalse"><questiontext><text>&xxe;</text></questiontext></question></quiz>"#;
        let err = parse_import(xxe, ImportFormat::MoodleXml, "web", 1, 50).unwrap_err();
        assert!(err.contains("XXE"));

        let xml = r#"
        <quiz>
          <question type="multichoice">
            <name><text>SQL Injection Guard</text></name>
            <questiontext format="html"><text><![CDATA[<p>Pilih proteksi<script>alert(1)</script> SQLi:</p>]]></text></questiontext>
            <answer fraction="100"><text>Parameterized Query</text><feedback><text>Tepat!</text></feedback></answer>
            <answer fraction="0"><text>String Concatenation</text></answer>
            <hint><text>Gunakan placeholder</text></hint>
          </question>
          <question type="shortanswer">
            <name><text>MQTT TLS Port</text></name>
            <questiontext format="plain_text"><text>Sebutkan port TCP default MQTT TLS?</text></questiontext>
            <answer fraction="100"><text>8883</text></answer>
          </question>
        </quiz>"#;
        let (items, fmt) = parse_import(xml, ImportFormat::Auto, "web", 2, 50).unwrap();
        assert_eq!(fmt, "moodle_xml");
        assert_eq!(items.len(), 2);
        assert!(!items[0].question.contains("alert(1)"));
        assert!(!items[0].question.contains("<script>"));
        assert_eq!(items[0].kind, "pilihan");
        assert_eq!(items[0].answer, vec!["a"]);
        assert_eq!(items[1].kind, "isian");
        assert_eq!(items[1].answer, vec!["8883"]);
    }

    #[test]
    fn parses_moodle_gift_and_aiken_and_roundtrips_xml() {
        let gift = r#"
// Contoh GIFT
::Port CoAP:: Port UDP standar CoAP tanpa DTLS adalah {=5683}

::BLE Just Works:: Just Works pairing tahan serangan MITM {FALSE}

::ACL Broker:: Desain terbaik ACL MQTT? {=Identitas unik per perangkat ~Satu akun kelas bersama ~Wildcard # terbuka}
"#;
        let (gift_items, fmt) = parse_import(gift, ImportFormat::Auto, "iot", 3, 50).unwrap();
        assert_eq!(fmt, "moodle_gift");
        assert_eq!(gift_items.len(), 3);
        assert_eq!(gift_items[0].kind, "isian");
        assert_eq!(gift_items[0].answer, vec!["5683"]);
        assert_eq!(gift_items[1].answer, vec!["b"]);
        assert_eq!(gift_items[2].answer, vec!["a"]);

        let aiken = "\
Komponen Arduino untuk membaca suhu dan kelembapan digital adalah?\n\
A. HC-SR04\n\
B. DHT22\n\
C. Piezo Buzzer\n\
D. Potensiometer\n\
ANSWER: B\n";
        let (aiken_items, afmt) = parse_import(aiken, ImportFormat::Auto, "iot", 1, 50).unwrap();
        assert_eq!(afmt, "aiken");
        assert_eq!(aiken_items.len(), 1);
        assert_eq!(aiken_items[0].answer, vec!["b"]);

        let exported_xml = export_moodle_xml(&aiken_items);
        let (reimported, _) =
            parse_import(&exported_xml, ImportFormat::MoodleXml, "iot", 1, 50).unwrap();
        assert_eq!(reimported.len(), 1);
        assert_eq!(reimported[0].answer, vec!["b"]);
    }
}
