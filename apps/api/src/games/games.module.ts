import { Module } from "@nestjs/common";
import { GamesService } from "./games.service";
import { GamesController } from "./games.controller";
import { SuggestionsModule } from "../suggestions/suggestions.module";
import { GameIngestModule } from "./ingest.module";

@Module({
  imports: [SuggestionsModule, GameIngestModule],
  providers: [GamesService],
  controllers: [GamesController],
  exports: [GamesService],
})
export class GamesModule {}
