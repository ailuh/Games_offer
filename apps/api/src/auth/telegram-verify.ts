import { createHash, createHmac } from "node:crypto";

export interface TelegramLoginData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Verifies a Telegram Login Widget payload as described at
 * https://core.telegram.org/widgets/login-legacy. The data-check-string is built
 * from every field except "hash", sorted alphabetically and joined by newlines;
 * its HMAC-SHA256 (keyed by SHA256(botToken)) must equal the provided hash. The
 * auth_date is also checked for freshness to prevent replay.
 */
export function verifyTelegramLogin(
  data: TelegramLoginData,
  botToken: string,
  maxAgeSeconds = 86400,
): boolean {
  const { hash, ...fields } = data;

  // Only the fields Telegram actually sent are part of the signature. DTO class
  // fields can materialise as own properties with value `undefined` (e.g. a user
  // with no photo_url); those must be skipped, or the data-check-string would
  // include "photo_url=undefined" and never match Telegram's hash.
  const dataCheckString = Object.keys(fields)
    .filter((key) => (fields as Record<string, unknown>)[key] !== undefined)
    .sort()
    .map((key) => `${key}=${(fields as Record<string, unknown>)[key]}`)
    .join("\n");

  const secret = createHash("sha256").update(botToken).digest();
  const computed = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (computed !== hash) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - Number(data.auth_date) > maxAgeSeconds) return false;

  return true;
}
