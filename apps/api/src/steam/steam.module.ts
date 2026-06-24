import { Injectable, Logger, Module } from "@nestjs/common";

export interface SteamDetails {
  appId: number;
  name: string | null;
  steamUrl: string;
  comingSoon: boolean;
  releaseDateRaw: string | null;
  hasDemo: boolean;
  headerImage: string | null;
  screenshots: string[];
  coopOnline: boolean;
  coopLocal: boolean;
  coopSplitscreen: boolean;
  aboutText: string | null;
}

/**
 * Collapses the Steam store description (short + long body) into plain text the
 * LLM can read to extract a stated co-op player count. HTML tags are dropped and
 * whitespace is normalised; the result is truncated to keep prompts small.
 */
function buildAboutText(short: string | undefined, about: string | undefined): string | null {
  const combined = `${short ?? ""}\n${about ?? ""}`
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return combined ? combined.slice(0, 4000) : null;
}

/**
 * Derives co-op flags from Steam store category descriptions (e.g. "Online
 * Co-op", "Shared/Split Screen Co-op", "LAN Co-op"). A bare "Co-op" category
 * with no qualifier is treated as online co-op.
 */
function parseCoopCategories(categories: Array<{ description?: string }> | undefined): {
  coopOnline: boolean;
  coopLocal: boolean;
  coopSplitscreen: boolean;
} {
  const labels = (categories ?? []).map((c) => (c.description ?? "").toLowerCase());
  const has = (needle: string) => labels.some((l) => l.includes(needle));
  const coopSplitscreen = has("split screen co-op");
  const coopOnline = has("online co-op");
  const coopLocal = coopSplitscreen || has("lan co-op") || has("local co-op") || has("remote play together");
  const coopOnlineEffective = coopOnline || (has("co-op") && !coopLocal);
  return { coopOnline: coopOnlineEffective, coopLocal, coopSplitscreen };
}

/**
 * Extracts the numeric Steam app id from a store URL such as
 * https://store.steampowered.com/app/1234567/Some_Game/. Returns null otherwise.
 */
export function parseSteamAppId(text: string): number | null {
  const match = text.match(/\/app\/(\d+)/);
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * Steam's storefront endpoints (storesearch, appdetails) are undocumented and
 * unofficial. They are widely used but can change or rate-limit (HTTP 429), so
 * every call is wrapped defensively: short timeout, null on any failure, and the
 * caller must tolerate missing data.
 */
@Injectable()
export class SteamService {
  private readonly logger = new Logger(SteamService.name);

  async resolveAppId(title: string): Promise<number | null> {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&cc=us&l=en`;
    const data = await this.fetchJson<{ items?: Array<{ id: number; name: string }> }>(url);
    return data?.items?.[0]?.id ?? null;
  }

  async getDetails(appId: number): Promise<SteamDetails | null> {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=en`;
    const data = await this.fetchJson<Record<string, { success: boolean; data?: AppDetailsData }>>(url);
    const entry = data?.[String(appId)];
    if (!entry?.success || !entry.data) return null;

    const coop = parseCoopCategories(entry.data.categories);
    const aboutText = buildAboutText(entry.data.short_description, entry.data.about_the_game);
    return {
      appId,
      name: entry.data.name ?? null,
      steamUrl: `https://store.steampowered.com/app/${appId}`,
      comingSoon: entry.data.release_date?.coming_soon ?? true,
      releaseDateRaw: entry.data.release_date?.date || null,
      hasDemo: Array.isArray(entry.data.demos) && entry.data.demos.length > 0,
      headerImage: entry.data.header_image ?? null,
      screenshots: Array.isArray(entry.data.screenshots)
        ? entry.data.screenshots
            .slice(0, 6)
            .map((s) => s.path_full)
            .filter((url): url is string => Boolean(url))
        : [],
      ...coop,
      aboutText,
    };
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        this.logger.warn(`Steam request failed: ${response.status} ${url}`);
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(`Steam request error: ${String(error)}`);
      return null;
    }
  }
}

interface AppDetailsData {
  name?: string;
  header_image?: string;
  short_description?: string;
  about_the_game?: string;
  screenshots?: Array<{ path_full?: string }>;
  release_date?: { coming_soon?: boolean; date?: string };
  demos?: Array<{ appid: number; description: string }>;
  categories?: Array<{ id: number; description: string }>;
}

@Module({
  providers: [SteamService],
  exports: [SteamService],
})
export class SteamModule {}
