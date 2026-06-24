import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthService, SessionUser } from "./auth.service";
import { TelegramLoginDto } from "./dto/telegram-login.dto";
import { SessionGuard } from "./session.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("telegram")
  async telegram(@Body() dto: TelegramLoginDto, @Req() req: Request): Promise<SessionUser> {
    const user = await this.authService.loginWithTelegram(dto);
    req.session.user = { id: user.id };
    return user;
  }

  @Get("dev-accounts")
  devAccounts(): { ids: string[] } {
    return { ids: this.authService.devAccounts() };
  }

  @Post("dev-login")
  async devLogin(@Body() body: { id?: string }, @Req() req: Request): Promise<SessionUser> {
    const user = await this.authService.devLogin(body?.id);
    req.session.user = { id: user.id };
    return user;
  }

  @Get("me")
  @UseGuards(SessionGuard)
  me(@Req() req: Request): { id: string } {
    const user = req.session.user;
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Post("logout")
  logout(@Req() req: Request): { ok: boolean } {
    req.session.destroy(() => undefined);
    return { ok: true };
  }
}
