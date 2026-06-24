import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { GamesModule } from "./games/games.module";
import { VideosModule } from "./videos/videos.module";
import { AiModule } from "./ai/ai.module";
import { SteamModule } from "./steam/steam.module";
import { TelegramModule } from "./telegram/telegram.module";
import { WatchModule } from "./watch/watch.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    GamesModule,
    VideosModule,
    AiModule,
    SteamModule,
    TelegramModule,
    WatchModule,
    NotificationsModule,
  ],
})
export class AppModule {}
