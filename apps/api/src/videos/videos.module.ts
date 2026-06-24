import { Body, Controller, Get, Injectable, Module, Param, Patch, Post, BadRequestException, UseGuards } from "@nestjs/common";
import { IsBoolean, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { SessionGuard } from "../auth/session.guard";
import { CurrentUserId } from "../auth/current-user.decorator";
import { parseYoutubeId, fetchYoutubeMeta } from "./youtube";
import { SuggestionsModule, SuggestionsService } from "../suggestions/suggestions.module";

class AddVideoDto {
  @IsString()
  url!: string;
}

class SetWatchedDto {
  @IsBoolean()
  watched!: boolean;
}

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const uid = BigInt(userId);
    const videos = await this.prisma.video.findMany({
      include: { userStates: { where: { userId: uid } } },
      orderBy: { createdAt: "desc" },
    });
    return videos.map((video) => {
      const mine = video.userStates[0];
      const { userStates, suggestedById, ...rest } = video;
      return {
        ...rest,
        suggestedById: suggestedById?.toString() ?? null,
        watched: mine?.watched ?? false,
      };
    });
  }

  async add(userId: string, url: string) {
    const youtubeId = parseYoutubeId(url);
    if (!youtubeId) throw new BadRequestException("Unrecognized YouTube URL");

    const meta = await fetchYoutubeMeta(youtubeId);
    return this.prisma.video.upsert({
      where: { youtubeId },
      create: { youtubeId, url, title: meta.title, channel: meta.channel, suggestedById: BigInt(userId) },
      update: { title: meta.title, channel: meta.channel },
    });
  }

  async setWatched(userId: string, videoId: string, watched: boolean) {
    const uid = BigInt(userId);
    await this.prisma.userVideo.upsert({
      where: { userId_videoId: { userId: uid, videoId } },
      create: { userId: uid, videoId, watched },
      update: { watched },
    });
    return { ok: true };
  }
}

@Controller("videos")
@UseGuards(SessionGuard)
class VideosController {
  constructor(
    private readonly videos: VideosService,
    private readonly suggestions: SuggestionsService,
  ) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.videos.list(userId);
  }

  @Post()
  add(@CurrentUserId() userId: string, @Body() dto: AddVideoDto) {
    return this.videos.add(userId, dto.url);
  }

  @Patch(":id/watched")
  setWatched(@CurrentUserId() userId: string, @Param("id") id: string, @Body() dto: SetWatchedDto) {
    return this.videos.setWatched(userId, id, dto.watched);
  }

  @Post(":id/suggest")
  suggest(@CurrentUserId() userId: string, @Param("id") id: string) {
    return this.suggestions.suggestVideo(id, userId);
  }
}

@Module({
  imports: [SuggestionsModule],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
