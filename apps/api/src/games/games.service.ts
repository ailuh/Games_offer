import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGameDto } from "./dto";

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const uid = BigInt(userId);
    const games = await this.prisma.game.findMany({
      where: { status: { not: "REMOVED" } },
      include: { userStates: { where: { userId: uid } } },
      orderBy: [{ releaseDate: "asc" }, { createdAt: "desc" }],
    });

    return games.map((game) => {
      const mine = game.userStates[0];
      const { userStates, suggestedById, ...rest } = game;
      return {
        ...rest,
        suggestedById: suggestedById?.toString() ?? null,
        played: mine?.played ?? false,
        myRating: mine?.rating ?? null,
      };
    });
  }

  async create(userId: string, dto: CreateGameDto) {
    return this.prisma.game.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        genres: dto.genres ?? [],
        steamUrl: dto.steamUrl ?? null,
        hasDemo: dto.hasDemo ?? false,
        suggestedById: BigInt(userId),
      },
    });
  }

  async setPlayed(userId: string, gameId: string, played: boolean) {
    const uid = BigInt(userId);
    await this.prisma.userGame.upsert({
      where: { userId_gameId: { userId: uid, gameId } },
      create: { userId: uid, gameId, played },
      update: { played },
    });
    return { ok: true };
  }

  async setRating(userId: string, gameId: string, rating: number) {
    const uid = BigInt(userId);
    await this.prisma.userGame.upsert({
      where: { userId_gameId: { userId: uid, gameId } },
      create: { userId: uid, gameId, rating },
      update: { rating },
    });
    return { ok: true };
  }

  async remove(gameId: string) {
    await this.prisma.game.update({ where: { id: gameId }, data: { status: "REMOVED" } });
    return { ok: true };
  }
}
