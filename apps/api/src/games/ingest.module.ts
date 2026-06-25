import { Injectable, Logger, Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiModule, AiService } from "../ai/ai.module";
import { SteamModule, SteamService, parseSteamAppId } from "../steam/steam.module";
import { LibraryModule, LibraryGateway } from "../library/library.module";
import { parseReleaseDate } from "./release-date";

/**
 * Turns free text (a post, a Steam link, or just a name) into a stored Game,
 * enriched from Steam. Shared by the website "add game" endpoint and the bot so
 * both behave identically.
 */
@Injectable()
export class GameIngestService {
  private readonly logger = new Logger(GameIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly steam: SteamService,
    private readonly library: LibraryGateway,
  ) {}

  async ingest(text: string, suggestedById: string | number): Promise<{ id: string; title: string } | null> {
    const parsed = await this.parseSafely(text);

    let appId = parseSteamAppId(text);
    if (!appId && parsed?.steamUrl) appId = parseSteamAppId(parsed.steamUrl);
    if (!appId && parsed?.title) appId = await this.steam.resolveAppId(parsed.title);

    const details = appId ? await this.steam.getDetails(appId) : null;
    const title = parsed?.title ?? details?.name ?? null;
    if (!title) return null;

    const players =
      details?.multiplayer && details.aboutText
        ? await this.extractPlayersSafely(details.aboutText)
        : { playersMin: null, playersMax: null };
    const releaseDateRaw = parsed?.releaseDateRaw ?? details?.releaseDateRaw ?? null;

    const game = await this.prisma.game.create({
      data: {
        title,
        description: parsed?.description ?? null,
        genres: parsed?.genres ?? [],
        releaseDateRaw,
        releaseDate: parseReleaseDate(releaseDateRaw),
        comingSoon: details?.comingSoon ?? true,
        hasDemo: (parsed?.hasDemo ?? false) || (details?.hasDemo ?? false),
        steamAppId: details?.appId ?? appId ?? null,
        steamUrl: parsed?.steamUrl ?? details?.steamUrl ?? null,
        headerImage: details?.headerImage ?? null,
        screenshots: details?.screenshots ?? [],
        coopOnline: details?.coopOnline ?? false,
        coopLocal: details?.coopLocal ?? false,
        coopSplitscreen: details?.coopSplitscreen ?? false,
        playersMin: players.playersMin,
        playersMax: players.playersMax,
        priceRub: details?.priceRub ?? null,
        priceIsFree: details?.priceIsFree ?? false,
        suggestedById: BigInt(suggestedById),
      },
    });
    this.library.notifyChanged();
    return { id: game.id, title: game.title };
  }

  private async parseSafely(text: string): Promise<Awaited<ReturnType<AiService["parsePost"]>>> {
    try {
      return await this.ai.parsePost(text);
    } catch (error) {
      this.logger.warn(`AI parse failed: ${String(error)}`);
      return null;
    }
  }

  private async extractPlayersSafely(aboutText: string): Promise<{ playersMin: number | null; playersMax: number | null }> {
    try {
      return await this.ai.extractPlayerCount(aboutText);
    } catch (error) {
      this.logger.warn(`Player-count extraction failed: ${String(error)}`);
      return { playersMin: null, playersMax: null };
    }
  }
}

@Module({
  imports: [AiModule, SteamModule, LibraryModule],
  providers: [GameIngestService],
  exports: [GameIngestService],
})
export class GameIngestModule {}
