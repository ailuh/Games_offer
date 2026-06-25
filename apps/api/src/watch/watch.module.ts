import { Body, Controller, Get, Injectable, Module, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import type { QueueItem, RoomState } from "@app/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SessionGuard } from "../auth/session.guard";
import type { Env } from "../config/env.validation";

/**
 * Single shared room. The playlist is one ordered list; the head is what plays
 * now and the tail is "up next". Playback is always shared (no per-user state).
 * "Watch now" moves a video to the head and plays it for everyone. Advancing to
 * the next video marks the finished one as watched for all allowed users.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
@Injectable()
export class WatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private items: QueueItem[] = [];
  private positionSeconds = 0;
  private paused = true;
  private updatedAt = Date.now();
  private hostId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Current playback position, advanced by a wall-clock while playing so a client
   * that joins or reloads can seek straight to where everyone else is.
   */
  private effectivePosition(): number {
    if (this.paused) return this.positionSeconds;
    return this.positionSeconds + (Date.now() - this.updatedAt) / 1000;
  }

  private setPlayback(positionSeconds: number, paused: boolean): void {
    this.positionSeconds = positionSeconds;
    this.paused = paused;
    this.updatedAt = Date.now();
  }

  private snapshot(): RoomState {
    return {
      current: this.items[0] ?? null,
      queue: this.items.slice(1),
      positionSeconds: this.effectivePosition(),
      paused: this.paused,
      hostId: this.hostId,
    };
  }

  private broadcast(): void {
    this.server.emit("state:sync", this.snapshot());
  }

  handleConnection(client: Socket): void {
    client.emit("state:sync", this.snapshot());
  }

  /**
   * When the last viewer leaves, freeze the clock. Otherwise the position keeps
   * advancing by wall-clock with nobody around to send queue:next, so it runs
   * past the end of the video and the next person to join seeks into a black void.
   */
  handleDisconnect(client: Socket): void {
    const sockets = this.server?.sockets?.sockets;
    const remaining = sockets ? [...sockets.keys()].filter((id) => id !== client.id).length : 0;
    if (remaining === 0 && !this.paused) {
      this.setPlayback(this.effectivePosition(), true);
    }
    if (this.hostId === client.id) this.hostId = null;
  }

  @SubscribeMessage("room:join")
  onJoin(@ConnectedSocket() client: Socket): void {
    if (!this.hostId) this.hostId = client.id;
    client.emit("state:sync", this.snapshot());
  }

  @SubscribeMessage("playback:play")
  onPlay(@ConnectedSocket() client: Socket, @MessageBody() positionSeconds: number): void {
    this.setPlayback(positionSeconds, false);
    client.broadcast.emit("playback:play", positionSeconds);
  }

  @SubscribeMessage("playback:pause")
  onPause(@ConnectedSocket() client: Socket, @MessageBody() positionSeconds: number): void {
    this.setPlayback(positionSeconds, true);
    client.broadcast.emit("playback:pause", positionSeconds);
  }

  @SubscribeMessage("playback:seek")
  onSeek(@ConnectedSocket() client: Socket, @MessageBody() positionSeconds: number): void {
    this.setPlayback(positionSeconds, this.paused);
    client.broadcast.emit("playback:seek", positionSeconds);
  }

  @SubscribeMessage("queue:add")
  async onQueueAdd(@MessageBody() videoId: string): Promise<void> {
    await this.enqueue(videoId);
  }

  @SubscribeMessage("queue:next")
  async onQueueNext(): Promise<void> {
    await this.next();
  }

  getState(): RoomState {
    return this.snapshot();
  }

  async enqueue(videoId: string): Promise<boolean> {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) return false;

    const item: QueueItem = {
      id: video.id,
      videoId: video.id,
      youtubeId: video.youtubeId,
      title: video.title,
      addedById: video.suggestedById?.toString() ?? null,
    };

    this.items = this.items.filter((existing) => existing.videoId !== item.videoId);
    this.items.unshift(item);
    this.setPlayback(0, false);
    this.broadcast();
    return true;
  }

  async next(): Promise<void> {
    const finished = this.items.shift();
    if (finished) await this.markWatched(finished.videoId);
    this.setPlayback(0, this.items.length === 0);
    this.broadcast();
  }

  private async markWatched(videoId: string): Promise<void> {
    const ids = this.config.get("ALLOWED_TELEGRAM_IDS_PARSED", { infer: true });
    await Promise.all(
      ids.map((userId) =>
        this.prisma.userVideo
          .upsert({
            where: { userId_videoId: { userId, videoId } },
            create: { userId, videoId, watched: true },
            update: { watched: true },
          })
          .catch(() => undefined),
      ),
    );
  }
}

@Controller("watch")
@UseGuards(SessionGuard)
class WatchController {
  constructor(private readonly gateway: WatchGateway) {}

  @Get("state")
  state(): RoomState {
    return this.gateway.getState();
  }

  @Post("queue")
  async enqueue(@Body() dto: { videoId: string }): Promise<{ ok: boolean }> {
    return { ok: await this.gateway.enqueue(dto.videoId) };
  }
}

@Module({
  controllers: [WatchController],
  providers: [WatchGateway],
})
export class WatchModule {}
