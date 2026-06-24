import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatCoop } from "@app/shared";
import { api, Game, Video } from "../api/client";

export function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newGame, setNewGame] = useState("");
  const [addingGame, setAddingGame] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();

  const reload = () => {
    api.listGames().then(setGames).catch(() => undefined);
    api.listVideos().then(setVideos).catch(() => undefined);
  };

  useEffect(reload, []);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const addVideo = async () => {
    if (!newUrl.trim()) return;
    await api.addVideo(newUrl.trim());
    setNewUrl("");
    reload();
  };

  const addGame = async () => {
    if (!newGame.trim() || addingGame) return;
    setAddingGame(true);
    try {
      const game = await api.addGame(newGame.trim());
      setNewGame("");
      flash(`Added: ${game.title}`);
      reload();
    } catch {
      flash("Couldn't recognize a game from that");
    } finally {
      setAddingGame(false);
    }
  };

  const suggestGame = async (id: string) => {
    const { sent } = await api.suggestGame(id);
    flash(`Suggested to ${sent} ${sent === 1 ? "person" : "people"} 🎮`);
  };

  const suggestVideo = async (id: string) => {
    const { sent } = await api.suggestVideo(id);
    flash(`Suggested to ${sent} ${sent === 1 ? "person" : "people"} 📺`);
  };

  const watchNow = async (id: string) => {
    await api.watchNow(id);
    navigate("/watch");
  };

  return (
    <div>
      <header className="topbar">
        <h1>Watchlist Hub</h1>
        <nav>
          <Link className="btn btn--primary" to="/watch">
            ▶ Watch room
          </Link>
          <button className="btn btn--ghost" onClick={() => api.logout().then(() => (window.location.href = "/login"))}>
            Log out
          </button>
        </nav>
      </header>

      <section className="section">
        <h2>Games</h2>
        <div className="add-row">
          <input
            placeholder="Game name or Steam link…"
            value={newGame}
            onChange={(e) => setNewGame(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGame()}
          />
          <button className="btn btn--primary" onClick={addGame} disabled={addingGame}>
            {addingGame ? "Adding…" : "Add"}
          </button>
        </div>
        <div className="library">
          {games.length === 0 && <div className="empty">No games yet — add one above or forward a post to the bot.</div>}
          {games.map((game) => {
            const coop = formatCoop(game);
            return (
            <article className={`card${game.played ? " is-done" : ""}`} key={game.id}>
              <div className="card__cover">
                {game.headerImage ? (
                  <img src={game.headerImage} alt={game.title} loading="lazy" />
                ) : (
                  <div className="card__cover-empty">No cover</div>
                )}
                <div className="badges">
                  {game.hasDemo && <span className="badge badge--demo">Demo</span>}
                  {coop && <span className="badge badge--coop">🤝 Co-op</span>}
                  {game.releaseDateRaw && <span className="badge">{game.releaseDateRaw}</span>}
                </div>
              </div>
              <div className="card__body">
                <div className="card__title">{game.title}</div>
                {game.genres.length > 0 && <div className="card__meta">{game.genres.join(" · ")}</div>}
                {coop && <div className="card__coop">{coop}</div>}
                {game.screenshots.length > 0 && (
                  <div className="shots">
                    {game.screenshots.slice(0, 6).map((src) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer">
                        <img src={src} alt="" loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="rating">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      className={game.myRating && n <= game.myRating ? "is-filled" : ""}
                      onClick={() => api.setGameRating(game.id, n).then(reload)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="actions">
                  <button
                    className={`btn ${game.played ? "btn--done" : "btn--ghost"}`}
                    onClick={() => api.setGamePlayed(game.id, !game.played).then(reload)}
                  >
                    {game.played ? "Played ✓" : "Mark played"}
                  </button>
                  <button className="btn btn--suggest" onClick={() => suggestGame(game.id)}>
                    Suggest to all
                  </button>
                  <button className="btn btn--danger" onClick={() => api.removeGame(game.id).then(reload)}>
                    Remove
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2>Videos</h2>
        <div className="add-row">
          <input placeholder="Paste a YouTube URL…" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <button className="btn btn--primary" onClick={addVideo}>
            Add
          </button>
        </div>
        <div className="library">
          {videos.length === 0 && <div className="empty">No videos yet.</div>}
          {videos.map((video) => (
            <article className={`card${video.watched ? " is-done" : ""}`} key={video.id}>
              <a className="card__cover" href={video.url} target="_blank" rel="noreferrer">
                <img src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`} alt={video.title ?? ""} loading="lazy" />
              </a>
              <div className="card__body">
                <div className="card__title">{video.title ?? video.url}</div>
                {video.channel && <div className="card__meta">{video.channel}</div>}
                <div className="actions">
                  <button
                    className={`btn ${video.watched ? "btn--done" : "btn--ghost"}`}
                    onClick={() => api.setVideoWatched(video.id, !video.watched).then(reload)}
                  >
                    {video.watched ? "Watched ✓" : "Mark watched"}
                  </button>
                  <button className="btn btn--primary" onClick={() => watchNow(video.id)}>
                    Watch now
                  </button>
                  <button className="btn btn--suggest" onClick={() => suggestVideo(video.id)}>
                    Suggest to all
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
