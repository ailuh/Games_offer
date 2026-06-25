import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, BadRequestException, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { SessionGuard } from "../auth/session.guard";
import { CurrentUserId } from "../auth/current-user.decorator";
import { parseYoutubeId, fetchYoutubeMeta } from "./youtube";
import { SuggestionsModule, SuggestionsService } from "../suggestions/suggestions.module";
import { LibraryModule, LibraryGateway } from "../library/library.module";

class AddVideoDto {
  @IsString()
  url!: string;
}

class SetWatchedDto {
  @IsBoolean()
  watched!: boolean;
}

class SuggestDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientIds?: string[];
}

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly library: LibraryGateway,
  ) {}

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
    const video = await this.prisma.video.upsert({
      where: { youtubeId },
      create: { youtubeId, url, title: meta.title, channel: meta.channel, suggestedById: BigInt(userId) },
      update: { title: meta.title, channel: meta.channel },
    });
    this.library.notifyChanged();
    return video;
  }

  async setWatched(userId: string, videoId: string, watched: boolean) {
    const uid = BigInt(userId);
    await this.prisma.userVideo.upsert({
      where: { userId_videoId: { userId: uid, videoId } },
      create: { userId: uid, videoId, watched },
      update: { watched },
    });
    this.library.notifyChanged();
    return { ok: true };
  }

  async remove(videoId: string) {
    await this.prisma.video.delete({ where: { id: videoId } }).catch(() => undefined);
    this.library.notifyChanged();
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
  suggest(@CurrentUserId() userId: string, @Param("id") id: string, @Body() dto: SuggestDto) {
    return this.suggestions.suggestVideo(id, userId, dto.recipientIds);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.videos.remove(id);
  }
}

@Module({
  imports: [SuggestionsModule, LibraryModule],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
