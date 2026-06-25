import { BadRequestException, Injectable } from "@nestjs/common";
import { normalizeReview, REVIEW_MAX_LINES } from "@app/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LibraryGateway } from "../library/library.module";
import { CreateGameDto } from "./dto";

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly library: LibraryGateway,
  ) {}

  async list(userId: string) {
    const uid = BigInt(userId);
    const games = await this.prisma.game.findMany({
      where: { status: { not: "REMOVED" } },
      include: { userStates: { include: { user: true } } },
      orderBy: [{ releaseDate: "asc" }, { createdAt: "desc" }],
    });

    return games.map((game) => {
      const mine = game.userStates.find((state) => state.userId === uid);
      const ratings = game.userStates
        .map((state) => state.rating)
        .filter((rating): rating is number => rating !== null);
      const avgRating =
        ratings.length > 0
          ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 2) / 2
          : null;

      const reviews = game.userStates
        .filter((state) => state.review && state.review.trim().length > 0)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map((state) => ({
          userId: state.userId.toString(),
          authorName: state.user?.firstName ?? state.user?.username ?? "Someone",
          review: state.review as string,
          rating: state.rating,
          played: state.played,
        }));

      const { userStates, suggestedById, ...rest } = game;
      return {
        ...rest,
        suggestedById: suggestedById?.toString() ?? null,
        played: mine?.played ?? false,
        myRating: mine?.rating ?? null,
        myReview: mine?.review ?? null,
        reviews,
        avgRating,
        ratingCount: ratings.length,
      };
    });
  }

  async create(userId: string, dto: CreateGameDto) {
    const game = await this.prisma.game.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        genres: dto.genres ?? [],
        steamUrl: dto.steamUrl ?? null,
        hasDemo: dto.hasDemo ?? false,
        suggestedById: BigInt(userId),
      },
    });
    this.library.notifyChanged();
    return game;
  }

  async setPlayed(userId: string, gameId: string, played: boolean) {
    const uid = BigInt(userId);
    await this.prisma.userGame.upsert({
      where: { userId_gameId: { userId: uid, gameId } },
      create: { userId: uid, gameId, played },
      update: { played },
    });
    this.library.notifyChanged();
    return { ok: true };
  }

  async setRating(userId: string, gameId: string, rating: number | null) {
    const uid = BigInt(userId);
    await this.prisma.userGame.upsert({
      where: { userId_gameId: { userId: uid, gameId } },
      create: { userId: uid, gameId, rating },
      update: { rating },
    });
    this.library.notifyChanged();
    return { ok: true };
  }

  async setReview(userId: string, gameId: string, review: string | null) {
    const uid = BigInt(userId);
    const cleaned = review?.trim() ? normalizeReview(review) : null;
    if (cleaned && cleaned.split("\n").length > REVIEW_MAX_LINES) {
      throw new BadRequestException(`Review has too many lines (max ${REVIEW_MAX_LINES})`);
    }
    await this.prisma.userGame.upsert({
      where: { userId_gameId: { userId: uid, gameId } },
      create: { userId: uid, gameId, review: cleaned },
      update: { review: cleaned },
    });
    this.library.notifyChanged();
    return { ok: true };
  }

  async remove(gameId: string) {
    await this.prisma.game.update({ where: { id: gameId }, data: { status: "REMOVED" } });
    this.library.notifyChanged();
    return { ok: true };
  }
}
