import { Injectable, Module } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";

/**
 * Broadcasts a single "library:changed" event whenever games or videos are
 * added, edited, or removed, so every open dashboard reloads itself live.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
@Injectable()
export class LibraryGateway {
  @WebSocketServer()
  server!: Server;

  notifyChanged(): void {
    this.server?.emit("library:changed");
  }
}

@Module({
  providers: [LibraryGateway],
  exports: [LibraryGateway],
})
export class LibraryModule {}
