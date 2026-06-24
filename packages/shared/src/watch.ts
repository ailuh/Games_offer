/**
 * Socket.IO event contract for the synchronized watch room. The backend relays
 * the host's actions to every client and periodically broadcasts the full state
 * so late joiners and drifting clients can re-sync.
 */

export interface QueueItem {
  id: string;
  videoId: string;
  youtubeId: string;
  title: string | null;
  addedById: string | null;
}

export interface RoomState {
  current: QueueItem | null;
  queue: QueueItem[];
  positionSeconds: number;
  paused: boolean;
  hostId: string | null;
}

export interface ClientToServerEvents {
  "room:join": () => void;
  "playback:play": (positionSeconds: number) => void;
  "playback:pause": (positionSeconds: number) => void;
  "playback:seek": (positionSeconds: number) => void;
  "queue:add": (videoId: string) => void;
  "queue:next": () => void;
}

export interface ServerToClientEvents {
  "state:sync": (state: RoomState) => void;
  "playback:play": (positionSeconds: number) => void;
  "playback:pause": (positionSeconds: number) => void;
  "playback:seek": (positionSeconds: number) => void;
}
