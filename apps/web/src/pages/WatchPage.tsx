import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import type { RoomState } from "@app/shared";
import { loadYouTubeApi } from "../lib/youtube";

type Player = {
  loadVideoById: (arg: string | { videoId: string; startSeconds?: number }) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
};

export function WatchPage() {
  const [state, setState] = useState<RoomState | null>(null);
  const [needsSound, setNeedsSound] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const playerRef = useRef<Player | null>(null);
  const applyingRemote = useRef(false);
  const stateRef = useRef<RoomState | null>(null);
  const syncedAtRef = useRef(0);
  const soundEnabledRef = useRef(false);
  const pauseTimerRef = useRef<number | null>(null);

  const clearPauseTimer = () => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  // Tear the player down on unmount so leaving and returning to the room starts a
  // fresh iframe instead of reviving a stale, frozen one.
  useEffect(() => {
    return () => {
      clearPauseTimer();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = io({ withCredentials: true });
    socketRef.current = socket;

    socket.on("state:sync", (s: RoomState) => {
      stateRef.current = s;
      syncedAtRef.current = Date.now();
      setState(s);
    });
    socket.on("playback:play", (pos: number) => applyRemote("play", pos));
    socket.on("playback:pause", (pos: number) => applyRemote("pause", pos));
    socket.on("playback:seek", (pos: number) => applyRemote("seek", pos));
    socket.emit("room:join");

    return () => {
      socket.disconnect();
    };
  }, []);

  const youtubeId = state?.current?.youtubeId;

  useEffect(() => {
    if (!youtubeId) {
      playerRef.current = null;
      return;
    }
    let cancelled = false;

    void loadYouTubeApi().then(() => {
      if (cancelled) return;
      const startAt = Math.max(0, Math.floor(livePosition()));
      const YT = (window as unknown as { YT: { Player: new (id: string, opts: unknown) => Player } }).YT;
      if (!playerRef.current) {
        playerRef.current = new YT.Player("yt-player", {
          videoId: youtubeId,
          width: "100%",
          height: "100%",
          playerVars: { start: startAt, playsinline: 1 },
          events: { onReady: syncToState, onStateChange: onPlayerStateChange },
        });
      } else {
        playerRef.current.loadVideoById({ videoId: youtubeId, startSeconds: startAt });
        window.setTimeout(syncToState, 600);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [youtubeId]);

  /**
   * Position everyone should be at right now: the last server-reported position
   * extrapolated by the time elapsed since it arrived, so a late joiner seeks to
   * the live spot rather than where playback was when the snapshot was sent.
   */
  function livePosition(): number {
    const s = stateRef.current;
    if (!s) return 0;
    const raw = s.paused ? s.positionSeconds : s.positionSeconds + (Date.now() - syncedAtRef.current) / 1000;
    let pos = Math.max(0, raw);
    // If the room's clock ran past the end (e.g. it was left playing with nobody
    // watching), clamp to the video length so we show the last frame, not a black
    // void with a stuck subtitle.
    const duration = playerRef.current?.getDuration?.() ?? 0;
    if (duration > 0 && pos > duration) pos = duration;
    return pos;
  }

  function syncToState(): void {
    const player = playerRef.current;
    const s = stateRef.current;
    if (!player || !s) return;
    applyingRemote.current = true;
    player.seekTo(livePosition(), true);
    if (s.paused) {
      player.pauseVideo();
    } else {
      // Browsers block unmuted autoplay; start muted (allowed) so everyone is in
      // sync, and surface a one-tap prompt to enable sound.
      if (soundEnabledRef.current) {
        player.unMute();
      } else {
        player.mute();
        setNeedsSound(true);
      }
      player.playVideo();
    }
    window.setTimeout(() => {
      applyingRemote.current = false;
    }, 600);
  }

  function enableSound(): void {
    const player = playerRef.current;
    soundEnabledRef.current = true;
    setNeedsSound(false);
    if (!player) return;
    applyingRemote.current = true;
    player.unMute();
    player.seekTo(livePosition(), true);
    if (!stateRef.current?.paused) player.playVideo();
    window.setTimeout(() => {
      applyingRemote.current = false;
    }, 300);
  }

  function applyRemote(kind: "play" | "pause" | "seek", pos: number): void {
    const player = playerRef.current;
    if (!player) return;
    applyingRemote.current = true;
    if (kind === "seek") player.seekTo(pos, true);
    if (kind === "play") {
      player.seekTo(pos, true);
      if (!soundEnabledRef.current) {
        player.mute();
        setNeedsSound(true);
      }
      player.playVideo();
    }
    if (kind === "pause") player.pauseVideo();
    window.setTimeout(() => {
      applyingRemote.current = false;
    }, 300);
  }

  function onPlayerStateChange(event: { data: number }): void {
    const YT = (window as unknown as {
      YT: { PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number } };
    }).YT;

    // Buffering is transient and must never be broadcast as a pause: a slow
    // client stalling would otherwise pause the video for everyone. Cancel any
    // pending pause when buffering starts.
    if (event.data === YT.PlayerState.BUFFERING) {
      clearPauseTimer();
      return;
    }
    if (applyingRemote.current) return;

    const player = playerRef.current;
    const pos = player?.getCurrentTime() ?? 0;

    if (event.data === YT.PlayerState.PLAYING) {
      clearPauseTimer();
      socketRef.current?.emit("playback:play", pos);
    }
    if (event.data === YT.PlayerState.PAUSED) {
      // Debounce: a genuine pause stays paused, but a buffering blip flips back to
      // PLAYING/BUFFERING within a moment and cancels this before it broadcasts.
      clearPauseTimer();
      pauseTimerRef.current = window.setTimeout(() => {
        pauseTimerRef.current = null;
        socketRef.current?.emit("playback:pause", playerRef.current?.getCurrentTime() ?? pos);
      }, 800);
    }
    if (event.data === YT.PlayerState.ENDED) {
      clearPauseTimer();
      socketRef.current?.emit("queue:next");
    }
  }

  const queue = state?.queue ?? [];

  return (
    <div>
      <header className="topbar">
        <h1>Watch room</h1>
        <Link className="btn btn--ghost" to="/">
          Back
        </Link>
      </header>

      {youtubeId ? (
        <>
          <div className="player">
            <div id="yt-player" />
            {needsSound && (
              <button className="player__sound" onClick={enableSound}>
                🔊 Tap for sound
              </button>
            )}
          </div>
          {state?.current?.title && <p className="player__title">{state.current.title}</p>}
        </>
      ) : (
        <div className="empty" style={{ maxWidth: 560, margin: "40px auto" }}>
          <p style={{ fontSize: 18, marginTop: 0 }}>Nothing is playing right now ▶</p>
          <p style={{ color: "var(--text-muted)" }}>
            Add a video from the dashboard with “Watch now”, and it shows up here for everyone.
          </p>
          <Link className="btn btn--primary" to="/">
            Go to dashboard
          </Link>
        </div>
      )}

      <section className="section" style={{ marginTop: 32 }}>
        <h2>Up next</h2>
        {queue.length > 0 ? (
          <>
            <div className="actions" style={{ marginBottom: 12 }}>
              <button className="btn btn--ghost" onClick={() => socketRef.current?.emit("queue:next")}>
                Skip to next
              </button>
            </div>
            <ol className="queue">
              {queue.map((item) => (
                <li key={item.id}>{item.title ?? item.youtubeId}</li>
              ))}
            </ol>
          </>
        ) : (
          <p style={{ color: "var(--text-muted)" }}>The queue is empty.</p>
        )}
      </section>
    </div>
  );
}
