import * as crypto from "crypto";

const APP_NAME = "TryNex Admin";
const TOTP_STEP = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // accept codes from 1 step before/after

// ---------------------------------------------------------------------------
// Base32 helpers (RFC 4648)
// ---------------------------------------------------------------------------
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const idx = B32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

// ---------------------------------------------------------------------------
// HOTP (RFC 4226)
// ---------------------------------------------------------------------------
function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  // Write 64-bit big-endian counter
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  msg.writeUInt32BE(high, 0);
  msg.writeUInt32BE(low, 4);
  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % Math.pow(10, TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

// ---------------------------------------------------------------------------
// TOTP (RFC 6238)
// ---------------------------------------------------------------------------
function totpAt(secret: string, timeSeconds: number): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timeSeconds / TOTP_STEP);
  return hotp(key, counter);
}

export function generateTotpSecret(): string {
  // 20 random bytes → base32 (160 bits, standard for TOTP)
  return base32Encode(crypto.randomBytes(20));
}

export function generateTotpUri(secret: string, username: string): string {
  const label = encodeURIComponent(`${APP_NAME}:${username}`);
  const params = new URLSearchParams({
    secret,
    issuer: APP_NAME,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export async function generateTotpQr(secret: string, username: string): Promise<string> {
  const uri = generateTotpUri(secret, username);
  // QRCode is bundled fine by esbuild as it's pure JS
  const QRCode = await import("qrcode");
  return QRCode.default.toDataURL(uri);
}

export function verifyTotp(token: string, secret: string): boolean {
  const code = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    if (totpAt(secret, now + delta * TOTP_STEP) === code) {
      return true;
    }
  }
  return false;
}
