import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { CurrentUserId } from "../auth/current-user.decorator";
import { GamesService } from "./games.service";
import { SuggestionsService } from "../suggestions/suggestions.module";
import { GameIngestService } from "./ingest.module";
import { CreateGameDto, IngestGameDto, SetPlayedDto, SetRatingDto, SetReviewDto, SuggestDto } from "./dto";

@Controller("games")
@UseGuards(SessionGuard)
export class GamesController {
  constructor(
    private readonly games: GamesService,
    private readonly suggestions: SuggestionsService,
    private readonly ingest: GameIngestService,
  ) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.games.list(userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateGameDto) {
    return this.games.create(userId, dto);
  }

  @Post("ingest")
  async ingestGame(@CurrentUserId() userId: string, @Body() dto: IngestGameDto) {
    const result = await this.ingest.ingest(dto.text, userId);
    if (!result) throw new BadRequestException("Could not recognize a game from that text");
    return result;
  }

  @Post(":id/suggest")
  suggest(@CurrentUserId() userId: string, @Param("id") id: string, @Body() dto: SuggestDto) {
    return this.suggestions.suggestGame(id, userId, dto.recipientIds);
  }

  @Patch(":id/played")
  setPlayed(@CurrentUserId() userId: string, @Param("id") id: string, @Body() dto: SetPlayedDto) {
    return this.games.setPlayed(userId, id, dto.played);
  }

  @Patch(":id/rating")
  setRating(@CurrentUserId() userId: string, @Param("id") id: string, @Body() dto: SetRatingDto) {
    return this.games.setRating(userId, id, dto.rating);
  }

  @Patch(":id/review")
  setReview(@CurrentUserId() userId: string, @Param("id") id: string, @Body() dto: SetReviewDto) {
    return this.games.setReview(userId, id, dto.review);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.games.remove(id);
  }
}
