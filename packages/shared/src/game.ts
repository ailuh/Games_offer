import { z } from "zod";

/**
 * Strict schema the LLM must produce when parsing a Telegram post about a game.
 * Fields that may be absent in the post are nullable rather than optional so the
 * model is forced to emit every key (a requirement of strict structured outputs).
 */
export const GamePostSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  genres: z.array(z.string()),
  releaseDateRaw: z.string().nullable(),
  hasDemo: z.boolean(),
  steamUrl: z.string().url().nullable(),
});

export type GamePost = z.infer<typeof GamePostSchema>;

/**
 * Co-op capabilities of a game. Boolean flags come from Steam store categories;
 * the max player count is read by the model from the Steam store description when
 * it states one, and is null otherwise.
 */
export interface CoopInfo {
  coopOnline: boolean;
  coopLocal: boolean;
  coopSplitscreen: boolean;
  coopOnlineMax: number | null;
  coopOfflineMax: number | null;
}

/**
 * Human-readable one-line co-op summary, e.g. "Co-op: Online 2–4 · Couch ·
 * Split-screen · Campaign". Returns null when the game has no known co-op.
 */
export function formatCoop(info: Partial<CoopInfo>): string | null {
  const parts: string[] = [];
  if (info.coopOnline || info.coopOnlineMax) {
    parts.push(info.coopOnlineMax ? `Online ${formatPlayers(info.coopOnlineMax)}` : "Online");
  }
  if (info.coopLocal || info.coopOfflineMax) {
    parts.push(info.coopOfflineMax ? `Couch ${formatPlayers(info.coopOfflineMax)}` : "Couch");
  }
  if (info.coopSplitscreen) parts.push("Split-screen");
  return parts.length > 0 ? `Co-op: ${parts.join(" · ")}` : null;
}

const formatPlayers = (max: number): string => (max > 1 ? `up to ${max}` : `${max}`);

export const GAME_STATUS = ["BACKLOG", "RELEASED", "REMOVED"] as const;
export type GameStatus = (typeof GAME_STATUS)[number];

export const RATING_MIN = 1;
export const RATING_MAX = 10;
