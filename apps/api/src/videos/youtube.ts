/**
 * Extracts the 11-character YouTube video id from the common URL shapes
 * (watch?v=, youtu.be/, shorts/, embed/). Returns null when no id is found.
 */
export function parseYoutubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Fetches a video's title and channel name via YouTube's public oEmbed endpoint,
 * which requires no API key. Returns nulls on any failure so callers can proceed.
 */
export async function fetchYoutubeMeta(youtubeId: string): Promise<{ title: string | null; channel: string | null }> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { title: null, channel: null };
    const data = (await response.json()) as { title?: string; author_name?: string };
    return { title: data.title ?? null, channel: data.author_name ?? null };
  } catch {
    return { title: null, channel: null };
  }
}
