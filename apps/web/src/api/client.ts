const BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface GameReview {
  userId: string;
  authorName: string;
  review: string;
  rating: number | null;
  played: boolean;
}

export interface Game {
  id: string;
  title: string;
  description: string | null;
  genres: string[];
  releaseDateRaw: string | null;
  hasDemo: boolean;
  steamUrl: string | null;
  headerImage: string | null;
  screenshots: string[];
  coopOnline: boolean;
  coopLocal: boolean;
  coopSplitscreen: boolean;
  playersMin: number | null;
  playersMax: number | null;
  priceRub: number | null;
  priceIsFree: boolean;
  played: boolean;
  myRating: number | null;
  myReview: string | null;
  reviews: GameReview[];
  avgRating: number | null;
  ratingCount: number;
}

export interface Video {
  id: string;
  youtubeId: string;
  url: string;
  title: string | null;
  channel: string | null;
  watched: boolean;
}

export const api = {
  me: () => request<{ id: string }>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  listGames: () => request<Game[]>("/games"),
  addGame: (text: string) => request<{ id: string; title: string }>("/games/ingest", { method: "POST", body: JSON.stringify({ text }) }),
  setGamePlayed: (id: string, played: boolean) =>
    request(`/games/${id}/played`, { method: "PATCH", body: JSON.stringify({ played }) }),
  setGameRating: (id: string, rating: number | null) =>
    request(`/games/${id}/rating`, { method: "PATCH", body: JSON.stringify({ rating }) }),
  setGameReview: (id: string, review: string | null) =>
    request(`/games/${id}/review`, { method: "PATCH", body: JSON.stringify({ review }) }),
  removeGame: (id: string) => request(`/games/${id}`, { method: "DELETE" }),
  suggestGame: (id: string) => request<{ sent: number }>(`/games/${id}/suggest`, { method: "POST" }),
  listVideos: () => request<Video[]>("/videos"),
  addVideo: (url: string) => request("/videos", { method: "POST", body: JSON.stringify({ url }) }),
  setVideoWatched: (id: string, watched: boolean) =>
    request(`/videos/${id}/watched`, { method: "PATCH", body: JSON.stringify({ watched }) }),
  suggestVideo: (id: string) => request<{ sent: number }>(`/videos/${id}/suggest`, { method: "POST" }),
  removeVideo: (id: string) => request(`/videos/${id}`, { method: "DELETE" }),
  watchNow: (videoId: string) => request<{ ok: boolean }>("/watch/queue", { method: "POST", body: JSON.stringify({ videoId }) }),
};
