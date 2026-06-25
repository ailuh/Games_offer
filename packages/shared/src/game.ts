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
 * Co-op capabilities of a game, from Steam store categories. The player counts
 * live separately in PlayersInfo because they apply to any multiplayer mode, not
 * only co-op.
 */
export interface CoopInfo {
  coopOnline: boolean;
  coopLocal: boolean;
  coopSplitscreen: boolean;
}

/**
 * Min/max number of players that can play together (co-op or competitive), read
 * by the model from the Steam store description when it states one. Null when not
 * stated or the game is single-player.
 */
export interface PlayersInfo {
  playersMin: number | null;
  playersMax: number | null;
}

/**
 * Human-readable co-op modes summary, e.g. "Co-op: Online · Couch · Split-screen".
 * Returns null when the game has no known co-op.
 */
export function formatCoop(info: Partial<CoopInfo>): string | null {
  const parts: string[] = [];
  if (info.coopOnline) parts.push("Online");
  if (info.coopLocal) parts.push("Couch");
  if (info.coopSplitscreen) parts.push("Split-screen");
  return parts.length > 0 ? `Co-op: ${parts.join(" · ")}` : null;
}

/**
 * Human-readable player-count summary, e.g. "2–10 players", "up to 4 players".
 * Returns null when no count is known.
 */
export function formatPlayers(info: Partial<PlayersInfo>): string | null {
  const min = info.playersMin ?? null;
  const max = info.playersMax ?? null;
  if (min && max && min !== max) return `${min}–${max} players`;
  if (max && max > 1) return `up to ${max} players`;
  if (max) return `${max} player`;
  return null;
}

/**
 * Russian-region Steam price. priceRub is whole rubles; priceIsFree marks
 * free-to-play titles. Both unknown until the game is enriched from Steam.
 */
export interface PriceInfo {
  priceRub: number | null;
  priceIsFree: boolean;
}

/**
 * Human-readable RU price: "Free", "499 ₽", or null when unknown.
 */
export function formatPriceRub(info: Partial<PriceInfo>): string | null {
  if (info.priceIsFree) return "Free";
  if (info.priceRub != null) return `${info.priceRub} ₽`;
  return null;
}

export const GAME_STATUS = ["BACKLOG", "RELEASED", "REMOVED"] as const;
export type GameStatus = (typeof GAME_STATUS)[number];

export const RATING_MIN = 1;
export const RATING_MAX = 10;

export const REVIEW_MAX_LENGTH = 503;

/**
 * One person's take on a game: their written review plus the rating and
 * played-flag captured at the same time, signed with their Telegram name. Each
 * user has at most one per game (editable). Sent along with a game suggestion.
 */
export interface GameReview {
  userId: string;
  authorName: string;
  review: string;
  rating: number | null;
  played: boolean;
}
