use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use rand::Rng;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

const BASE32_ALPHABET: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // pragma: allowlist secret -- RFC 4648 Base32 alphabet

pub fn base32_encode(data: &[u8]) -> String {
    let mut out = String::new();
    let mut buffer: u32 = 0;
    let mut bits_left: u8 = 0;
    for &b in data {
        buffer = (buffer << 8) | u32::from(b);
        bits_left += 8;
        while bits_left >= 5 {
            bits_left -= 5;
            let idx = ((buffer >> bits_left) & 0x1F) as usize;
            out.push(BASE32_ALPHABET[idx] as char);
        }
    }
    if bits_left > 0 {
        let idx = ((buffer << (5 - bits_left)) & 0x1F) as usize;
        out.push(BASE32_ALPHABET[idx] as char);
    }
    out
}

pub fn base32_decode(encoded: &str) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut buffer: u32 = 0;
    let mut bits_left: u8 = 0;
    for ch in encoded.trim().bytes() {
        if ch == b'=' || ch == b' ' || ch == b'-' {
            continue;
        }
        let upper = ch.to_ascii_uppercase();
        let val = BASE32_ALPHABET.iter().position(|&c| c == upper)? as u32;
        buffer = (buffer << 5) | val;
        bits_left += 5;
        if bits_left >= 8 {
            bits_left -= 8;
            out.push(((buffer >> bits_left) & 0xFF) as u8);
        }
    }
    Some(out)
}

fn sha1_digest(message: &[u8]) -> [u8; 20] {
    let mut h0: u32 = 0x6745_2301;
    let mut h1: u32 = 0xEFCD_AB89;
    let mut h2: u32 = 0x98BA_DCFE;
    let mut h3: u32 = 0x1032_5476;
    let mut h4: u32 = 0xC3D2_E1F0;

    let bit_len = (message.len() as u64) * 8;
    let mut padded = message.to_vec();
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0x00);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.as_chunks::<64>().0 {
        let mut w = [0u32; 80];
        for (i, word) in chunk.as_chunks::<4>().0.iter().enumerate() {
            w[i] = u32::from_be_bytes(*word);
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }

        let (mut a, mut b, mut c, mut d, mut e) = (h0, h1, h2, h3, h4);
        for (i, &wi) in w.iter().enumerate() {
            let (f, k) = match i {
                0..=19 => ((b & c) | ((!b) & d), 0x5A82_7999u32),
                20..=39 => (b ^ c ^ d, 0x6ED9_EBA1u32),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1B_BCDCu32),
                _ => (b ^ c ^ d, 0xCA62_C1D6u32),
            };
            let temp = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(wi);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = temp;
        }
        h0 = h0.wrapping_add(a);
        h1 = h1.wrapping_add(b);
        h2 = h2.wrapping_add(c);
        h3 = h3.wrapping_add(d);
        h4 = h4.wrapping_add(e);
    }

    let mut out = [0u8; 20];
    for (idx, word) in [h0, h1, h2, h3, h4].into_iter().enumerate() {
        out[idx * 4..idx * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

fn hmac_sha1(key: &[u8], data: &[u8]) -> [u8; 20] {
    let mut k_pad = [0u8; 64];
    if key.len() > 64 {
        let digest = sha1_digest(key);
        k_pad[..20].copy_from_slice(&digest);
    } else {
        k_pad[..key.len()].copy_from_slice(key);
    }

    let mut inner = Vec::with_capacity(64 + data.len());
    let mut outer = Vec::with_capacity(64 + 20);
    for b in k_pad {
        inner.push(b ^ 0x36);
        outer.push(b ^ 0x5C);
    }
    inner.extend_from_slice(data);
    let inner_hash = sha1_digest(&inner);
    outer.extend_from_slice(&inner_hash);
    sha1_digest(&outer)
}

pub fn totp_at(secret_b32: &str, unix_secs: u64) -> Option<String> {
    let key = base32_decode(secret_b32)?;
    let counter = unix_secs / 30;
    let mac = hmac_sha1(&key, &counter.to_be_bytes());
    let offset = (mac[19] & 0x0F) as usize;
    let code = (u32::from(mac[offset] & 0x7F) << 24)
        | (u32::from(mac[offset + 1]) << 16)
        | (u32::from(mac[offset + 2]) << 8)
        | u32::from(mac[offset + 3]);
    Some(format!("{:06}", code % 1_000_000))
}

pub fn verify_totp_code(secret_b32: &str, supplied: &str, unix_secs: u64) -> bool {
    let clean: String = supplied.chars().filter(|c| c.is_ascii_digit()).collect();
    if clean.len() != 6 {
        return false;
    }
    for delta in [-30i64, 0, 30] {
        let ts = if delta < 0 {
            unix_secs.saturating_sub(30)
        } else {
            unix_secs.saturating_add(delta as u64)
        };
        if let Some(expected) = totp_at(secret_b32, ts)
            && bool::from(expected.as_bytes().ct_eq(clean.as_bytes()))
        {
            return true;
        }
    }
    false
}

pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn argon2_hash_secret(secret: &str) -> Result<String, argon2::password_hash::Error> {
    Ok(Argon2::default()
        .hash_password(secret.as_bytes())?
        .to_string())
}

pub fn argon2_verify_secret(secret: &str, phc_hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(phc_hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(secret.as_bytes(), &parsed)
        .is_ok()
}

pub fn generate_totp_secret() -> String {
    let mut bytes = [0u8; 20];
    rand::rng().fill_bytes(&mut bytes);
    base32_encode(&bytes)
}

pub fn generate_backup_codes(count: usize) -> Vec<String> {
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // pragma: allowlist secret -- unambiguous backup code charset
    let mut rng = rand::rng();
    (0..count)
        .map(|_| {
            let mut buf = [0u8; 8];
            rng.fill_bytes(&mut buf);
            let chars: Vec<char> = buf
                .iter()
                .map(|b| CHARSET[(*b as usize) % CHARSET.len()] as char)
                .collect();
            format!(
                "{}-{}",
                chars[..4].iter().collect::<String>(),
                chars[4..].iter().collect::<String>()
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc6238_totp_test_vector_sha1() {
        let secret = base32_encode(b"12345678901234567890");
        assert_eq!(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
        assert_eq!(totp_at(&secret, 59).as_deref(), Some("287082"));
        assert!(verify_totp_code(&secret, "287082", 59));
        assert!(verify_totp_code(&secret, "287082", 80));
        assert!(!verify_totp_code(&secret, "000000", 59));
    }

    #[test]
    fn backup_code_generation_produces_unique_formatted_hashes() {
        let codes = generate_backup_codes(8);
        assert_eq!(codes.len(), 8);
        for c in &codes {
            assert_eq!(c.len(), 9);
            assert!(c.contains('-'));
        }
        assert_ne!(sha256_hex(&codes[0]), sha256_hex(&codes[1]));
    }

    #[test]
    fn argon2_hash_and_verify_roundtrip() {
        let code = "ABCD1234";
        let hash = argon2_hash_secret(code).expect("argon2id hash");
        assert!(hash.starts_with("$argon2id$"));
        assert!(argon2_verify_secret(code, &hash));
        assert!(!argon2_verify_secret("WRONG999", &hash));
    }
}
