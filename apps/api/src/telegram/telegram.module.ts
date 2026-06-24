import { Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Bot, Context } from "grammy";
import { PrismaService } from "../prisma/prisma.service";
import { GameIngestModule, GameIngestService } from "../games/ingest.module";
import { parseYoutubeId, fetchYoutubeMeta } from "../videos/youtube";
import type { Env } from "../config/env.validation";

/**
 * Allowed users send messages directly to the bot in any format: a freeform post
 * about a game, a Steam link, or just a game name go to the games pool (parsed by
 * the LLM and enriched from Steam); a YouTube link goes to the videos pool. The
 * sender is recorded as the suggester.
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;
  private allowed: bigint[] = [];

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly gameIngest: GameIngestService,
  ) {}

  onModuleInit(): void {
    this.allowed = this.config.get("ALLOWED_TELEGRAM_IDS_PARSED", { infer: true });

    const token = this.config.get("TELEGRAM_BOT_TOKEN", { infer: true });
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN is not set; the bot is disabled");
      return;
    }

    this.bot = new Bot(token);

    this.bot.use(async (ctx, next) => {
      const kinds = Object.keys(ctx.update).filter((key) => key !== "update_id");
      const msgKeys = ctx.message ? Object.keys(ctx.message) : [];
      this.logger.log(
        `Update ${ctx.update.update_id} [${kinds.join(",")}] from ${ctx.from?.id ?? "?"} msg=[${msgKeys.join(",")}] text=${JSON.stringify(ctx.message?.text ?? ctx.message?.caption ?? null)}`,
      );
      await next();
    });

    this.bot.command("start", (ctx) =>
      ctx.reply("Hi! Send me a game (a post, a Steam link, or just a name) or a YouTube link, and I'll add it to the pool."),
    );
    this.bot.on("message", (ctx) => this.handleMessage(ctx));
    this.bot.catch((err) => this.logger.error(`Bot handler error: ${String(err.error ?? err)}`));

    this.bot
      .start({ allowed_updates: ["message", "callback_query"] })
      .catch((err) => this.logger.error(`Bot polling failed: ${String(err)}`));
    this.logger.log("Telegram bot started");
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot?.stop();
  }

  async sendMessage(chatId: string | number, text: string): Promise<void> {
    if (!this.bot) return;
    await this.bot.api.sendMessage(chatId, text);
  }

  async sendPhoto(chatId: string | number, photoUrl: string, caption: string): Promise<void> {
    if (!this.bot) return;
    await this.bot.api.sendPhoto(chatId, photoUrl, { caption });
  }

  /**
   * Sends one or more photos with a single caption. Telegram albums hold 2-10
   * items with the caption on the first, so a single photo falls back to
   * sendPhoto and an empty list sends nothing.
   */
  async sendPhotos(chatId: string | number, photoUrls: string[], caption: string): Promise<void> {
    if (!this.bot || photoUrls.length === 0) return;
    if (photoUrls.length === 1) {
      await this.sendPhoto(chatId, photoUrls[0], caption);
      return;
    }
    const media = photoUrls.slice(0, 10).map((url, index) => ({
      type: "photo" as const,
      media: url,
      caption: index === 0 ? caption : undefined,
    }));
    await this.bot.api.sendMediaGroup(chatId, media);
  }

  private async handleMessage(ctx: Context): Promise<void> {
    const from = ctx.from;
    const text = ctx.msg?.text ?? ctx.msg?.caption;
    if (!from || !text) return;
    if (text.startsWith("/")) return;

    if (!this.allowed.some((id) => id === BigInt(from.id))) {
      await ctx.reply("You are not allowed to use this bot.");
      return;
    }

    this.logger.log(`Message from ${from.id}: ${text.slice(0, 80)}`);
    await this.upsertSender(from.id, from.username ?? null, from.first_name ?? null);

    try {
      const youtubeId = parseYoutubeId(text);
      if (youtubeId) {
        await this.addVideo(youtubeId, from.id);
        this.logger.log(`Added video ${youtubeId}`);
        await ctx.reply("Added to the videos pool.");
        return;
      }

      const title = await this.addGame(text, from.id);
      this.logger.log(title ? `Added game: ${title}` : `Not recognized: ${text.slice(0, 80)}`);
      await ctx.reply(title ? `Added to the games pool: ${title}` : "Could not recognize a game in that message.");
    } catch (error) {
      this.logger.error(`Failed to handle message: ${String(error)}`);
      await ctx.reply("Something went wrong while processing that.");
    }
  }

  private async upsertSender(id: number, username: string | null, firstName: string | null): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: BigInt(id) },
      create: { id: BigInt(id), username, firstName },
      update: { username, firstName },
    });
  }

  private async addVideo(youtubeId: string, senderId: number): Promise<void> {
    const meta = await fetchYoutubeMeta(youtubeId);
    await this.prisma.video.upsert({
      where: { youtubeId },
      create: {
        youtubeId,
        url: `https://www.youtube.com/watch?v=${youtubeId}`,
        title: meta.title,
        channel: meta.channel,
        suggestedById: BigInt(senderId),
      },
      update: { title: meta.title, channel: meta.channel },
    });
  }

  private async addGame(text: string, senderId: number): Promise<string | null> {
    const result = await this.gameIngest.ingest(text, senderId);
    return result?.title ?? null;
  }
}

@Module({
  imports: [GameIngestModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
