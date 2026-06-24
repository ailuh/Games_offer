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

  const dataCheckString = Object.keys(fields)
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
