import { ForbiddenException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import type { Env } from "../config/env.validation";
import { TelegramLoginDto } from "./dto/telegram-login.dto";
import { verifyTelegramLogin } from "./telegram-verify";

export interface SessionUser {
  id: string;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async loginWithTelegram(dto: TelegramLoginDto): Promise<SessionUser> {
    const botToken = this.config.get("TELEGRAM_BOT_TOKEN", { infer: true });
    if (!botToken) {
      throw new ServiceUnavailableException("Telegram bot token is not configured");
    }

    const verified = verifyTelegramLogin(dto, botToken);
    const allowed = this.config.get("ALLOWED_TELEGRAM_IDS_PARSED", { infer: true });
    const isAllowed = allowed.some((id) => id === BigInt(dto.id));
    const dtoRecord = dto as unknown as Record<string, unknown>;
    const fields = Object.keys(dto)
      .filter((k) => dtoRecord[k] !== undefined && k !== "hash")
      .sort()
      .join(",");
    Logger.log(
      `tg-login id=${dto.id} fields=[${fields}] verified=${verified} allowed=${isAllowed} age=${
        Math.floor(Date.now() / 1000) - Number(dto.auth_date)
      }s`,
      "AuthLoginDebug",
    );

    if (!verified) {
      throw new UnauthorizedException("Invalid Telegram login signature");
    }

    if (!isAllowed) {
      throw new ForbiddenException("This account is not allowed");
    }

    const user = await this.prisma.user.upsert({
      where: { id: BigInt(dto.id) },
      create: {
        id: BigInt(dto.id),
        username: dto.username ?? null,
        firstName: dto.first_name ?? null,
        photoUrl: dto.photo_url ?? null,
      },
      update: {
        username: dto.username ?? null,
        firstName: dto.first_name ?? null,
        photoUrl: dto.photo_url ?? null,
      },
    });

    return {
      id: user.id.toString(),
      username: user.username,
      firstName: user.firstName,
      photoUrl: user.photoUrl,
    };
  }

  /**
   * Development-only shortcut to obtain a session without the Telegram login
   * widget (which requires a public HTTPS domain registered with the bot). It is
   * disabled in production and still restricted to the allowlist.
   */
  async devLogin(idRaw?: string): Promise<SessionUser> {
    if (this.config.get("NODE_ENV", { infer: true }) === "production") {
      throw new ForbiddenException("Dev login is disabled in production");
    }

    const allowed = this.config.get("ALLOWED_TELEGRAM_IDS_PARSED", { infer: true });
    if (!idRaw && allowed.length === 0) {
      throw new ForbiddenException("No allowed users configured");
    }

    const id = idRaw ? BigInt(idRaw) : allowed[0];
    if (!allowed.some((allowedId) => allowedId === id)) {
      throw new ForbiddenException("This account is not allowed");
    }

    const user = await this.prisma.user.upsert({
      where: { id },
      create: { id, username: null, firstName: "Dev" },
      update: {},
    });

    return {
      id: user.id.toString(),
      username: user.username,
      firstName: user.firstName,
      photoUrl: user.photoUrl,
    };
  }

  /**
   * Development-only list of allowlisted ids, so the local login page can offer a
   * one-click sign-in per account. Empty in production.
   */
  devAccounts(): string[] {
    if (this.config.get("NODE_ENV", { infer: true }) === "production") return [];
    return this.config.get("ALLOWED_TELEGRAM_IDS_PARSED", { infer: true }).map(String);
  }
}
