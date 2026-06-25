import { HttpException, HttpStatus, Injectable, Module, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { formatCoop, formatPlayers, formatPriceRub } from "@app/shared";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramModule, TelegramService } from "../telegram/telegram.module";
import type { Env } from "../config/env.validation";

const MAX_ALBUM_SCREENSHOTS = 5;
const USER_COOLDOWN_MS = 30 * 1000;
const ITEM_COOLDOWN_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class SuggestionsService {
  private readonly lastByUser = new Map<string, number>();
  private readonly lastByUserItem = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Throws HTTP 429 when the user is suggesting too fast, or re-suggesting the
   * same item within the per-item window. Records the timestamps on success.
   */
  private rateLimit(userId: string, itemId: string): void {
    const now = Date.now();
    const lastUser = this.lastByUser.get(userId) ?? 0;
    if (now - lastUser < USER_COOLDOWN_MS) {
      const wait = Math.ceil((USER_COOLDOWN_MS - (now - lastUser)) / 1000);
      throw new HttpException(`Too many suggestions — wait ${wait}s`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const itemKey = `${userId}:${itemId}`;
    const lastItem = this.lastByUserItem.get(itemKey) ?? 0;
    if (now - lastItem < ITEM_COOLDOWN_MS) {
      throw new HttpException("You already suggested this recently", HttpStatus.TOO_MANY_REQUESTS);
    }
    this.lastByUser.set(userId, now);
    this.lastByUserItem.set(itemKey, now);
  }

  async suggestGame(gameId: string, byUserId: string): Promise<{ sent: number }> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { userStates: { include: { user: true } } },
    });
    if (!game) throw new NotFoundException("Game not found");
    this.rateLimit(byUserId, gameId);

    const who = await this.displayName(byUserId);
    const coop = formatCoop(game);
    const players = formatPlayers(game);
    const price = formatPriceRub(game);
    const lines = [
      `🎮 ${who} suggests for tonight: "${game.title}"`,
      price ? `💰 ${price}` : null,
      players ? `👥 ${players}` : null,
      coop ? `🤝 ${coop}` : null,
      game.steamUrl,
      ...this.formatReviews(game.userStates),
    ].filter((line): line is string => Boolean(line));

    const photos = [game.headerImage, ...game.screenshots.slice(0, MAX_ALBUM_SCREENSHOTS)].filter(
      (url): url is string => Boolean(url),
    );
    return this.broadcast(lines.join("\n"), photos);
  }

  /**
   * Renders only the most recently written review for the game (by updatedAt):
   * the author's rating, whether they played it, their name, and their text.
   */
  private formatReviews(
    states: Array<{
      review: string | null;
      rating: number | null;
      played: boolean;
      updatedAt: Date;
      user: { firstName: string | null; username: string | null } | null;
    }>,
  ): string[] {
    const latest = states
      .filter((s) => s.review && s.review.trim().length > 0)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    if (!latest) return [];
    const name = latest.user?.firstName ?? latest.user?.username ?? "Someone";
    const rating = latest.rating ? `★${latest.rating}` : "—";
    const played = latest.played ? "played" : "not played";
    return ["", `💬 ${name} (${rating}, ${played}): ${latest.review!.trim()}`];
  }

  async suggestVideo(videoId: string, byUserId: string): Promise<{ sent: number }> {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) throw new NotFoundException("Video not found");
    this.rateLimit(byUserId, videoId);

    const who = await this.displayName(byUserId);
    const thumb = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
    const text = `📺 ${who} suggests watching tonight: ${video.title ?? video.url}\n${video.url}`;
    return this.broadcast(text, [thumb]);
  }

  private async displayName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    return user?.firstName ?? user?.username ?? "Someone";
  }

  private async broadcast(text: string, photoUrls: string[]): Promise<{ sent: number }> {
    const recipients = this.config.get("ALLOWED_TELEGRAM_IDS_PARSED", { infer: true });
    await Promise.all(
      recipients.map((id) => {
        const send = photoUrls.length > 0
          ? this.telegram.sendPhotos(id.toString(), photoUrls, text)
          : this.telegram.sendMessage(id.toString(), text);
        return send.catch(() => undefined);
      }),
    );
    return { sent: recipients.length };
  }
}

@Module({
  imports: [TelegramModule],
  providers: [SuggestionsService],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
