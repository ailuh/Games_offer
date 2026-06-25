import { Controller, Get, Injectable, Module, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SessionGuard } from "../auth/session.guard";
import type { Env } from "../config/env.validation";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async list(): Promise<Array<{ id: string; username: string | null; firstName: string | null }>> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return users.map((u) => ({ id: u.id.toString(), username: u.username, firstName: u.firstName }));
  }

  /**
   * Every allowlisted recipient with a display name (Telegram first name or
   * username), falling back to the raw id for people who have not logged in yet.
   * Drives the "suggest to selected people" picker.
   */
  async recipients(): Promise<Array<{ id: string; name: string }>> {
    const ids = this.config.get("ALLOWED_TELEGRAM_IDS_PARSED", { infer: true });
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } } });
    const byId = new Map(users.map((u) => [u.id.toString(), u]));
    return ids.map((id) => {
      const u = byId.get(id.toString());
      return { id: id.toString(), name: u?.firstName ?? u?.username ?? `ID ${id.toString()}` };
    });
  }
}

@Controller("users")
@UseGuards(SessionGuard)
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get("recipients")
  recipients() {
    return this.users.recipients();
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
