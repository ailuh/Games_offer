import { Controller, Get, Injectable, Module, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SessionGuard } from "../auth/session.guard";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Array<{ id: string; username: string | null; firstName: string | null }>> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return users.map((u) => ({ id: u.id.toString(), username: u.username, firstName: u.firstName }));
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
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
