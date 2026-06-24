import { Injectable, Logger, Module } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { formatCoop } from "@app/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SteamModule, SteamService } from "../steam/steam.module";
import { TelegramModule, TelegramService } from "../telegram/telegram.module";
import type { Env } from "../config/env.validation";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly steam: SteamService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron("0 12 * * *", { timeZone: "Europe/Moscow" })
  async checkReleasesToday(): Promise<void> {
    const recipients = this.config.get("ALLOWED_TELEGRAM_IDS_PARSED", { infer: true });
    if (recipients.length === 0) return;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const games = await this.prisma.game.findMany({
      where: { status: { not: "REMOVED" }, releaseDate: { gte: start, lt: end } },
    });

    for (const game of games) {
      const details = game.steamAppId ? await this.steam.getDetails(game.steamAppId) : null;
      const shifted = details ? details.comingSoon : false;
      const kind = shifted ? "SHIFTED" : "RELEASE_TODAY";

      const already = await this.prisma.releaseNotice.findUnique({
        where: { gameId_noticeOn_kind: { gameId: game.id, noticeOn: start, kind } },
      });
      if (already) continue;

      const coop = formatCoop(game);
      const lines = [
        shifted
          ? `🎮 Heads up: "${game.title}" looks delayed — Steam still marks it as coming soon.`
          : `🎮 Releasing today: "${game.title}"`,
        coop ? `🤝 ${coop}` : null,
        game.steamUrl,
      ].filter((line): line is string => Boolean(line));
      const text = lines.join("\n");
      const photos = [game.headerImage, ...game.screenshots.slice(0, 5)].filter(
        (url): url is string => Boolean(url),
      );

      await Promise.all(
        recipients.map((id) => {
          const send = photos.length > 0
            ? this.telegram.sendPhotos(id.toString(), photos, text)
            : this.telegram.sendMessage(id.toString(), text);
          return send.catch(() => undefined);
        }),
      );
      await this.prisma.releaseNotice.create({ data: { gameId: game.id, noticeOn: start, kind } });
    }

    this.logger.log(`Checked ${games.length} release(s) for today`);
  }
}

@Module({
  imports: [SteamModule, TelegramModule],
  providers: [NotificationsService],
})
export class NotificationsModule {}
