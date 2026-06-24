import { Injectable, Module, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { formatCoop, formatPlayers } from "@app/shared";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramModule, TelegramService } from "../telegram/telegram.module";
import type { Env } from "../config/env.validation";

const MAX_ALBUM_SCREENSHOTS = 5;

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async suggestGame(gameId: string, byUserId: string): Promise<{ sent: number }> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException("Game not found");

    const who = await this.displayName(byUserId);
    const coop = formatCoop(game);
    const players = formatPlayers(game);
    const lines = [
      `🎮 ${who} suggests for tonight: "${game.title}"`,
      players ? `👥 ${players}` : null,
      coop ? `🤝 ${coop}` : null,
      game.steamUrl,
    ].filter((line): line is string => Boolean(line));

    const photos = [game.headerImage, ...game.screenshots.slice(0, MAX_ALBUM_SCREENSHOTS)].filter(
      (url): url is string => Boolean(url),
    );
    return this.broadcast(lines.join("\n"), photos);
  }

  async suggestVideo(videoId: string, byUserId: string): Promise<{ sent: number }> {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) throw new NotFoundException("Video not found");

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
