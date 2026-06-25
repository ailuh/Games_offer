import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatCoop, formatPlayers } from "@app/shared";
import { api, Game, Video } from "../api/client";

export function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
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
  useEffect(() => {
    api.me().then((u) => setMeId(u.id)).catch(() => undefined);
  }, []);

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
    try {
      const { sent } = await api.suggestGame(id);
      flash(`Suggested to ${sent} ${sent === 1 ? "person" : "people"} 🎮`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't suggest");
    }
  };

  const suggestVideo = async (id: string) => {
    try {
      const { sent } = await api.suggestVideo(id);
      flash(`Suggested to ${sent} ${sent === 1 ? "person" : "people"} 📺`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't suggest");
    }
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
            const players = formatPlayers(game);
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
                  {players && <span className="badge badge--players">👥 {players}</span>}
                  {coop && <span className="badge badge--coop">🤝 Co-op</span>}
                  {game.releaseDateRaw && <span className="badge">{game.releaseDateRaw}</span>}
                </div>
              </div>
              <div className="card__body">
                <div className="card__title">{game.title}</div>
                {game.genres.length > 0 && <div className="card__meta">{game.genres.join(" · ")}</div>}
                {(players || coop) && (
                  <div className="card__coop">{[players, coop].filter(Boolean).join(" · ")}</div>
                )}
                {game.screenshots.length > 0 && (
                  <div className="shots">
                    {game.screenshots.slice(0, 6).map((src) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer">
                        <img src={src} alt="" loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="rating-row">
                  <div className="rating">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        className={game.myRating && n <= game.myRating ? "is-filled" : ""}
                        onClick={() => api.setGameRating(game.id, game.myRating === n ? null : n).then(reload)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {game.ratingCount > 0 && (
                    <span className="rating__avg" title={`Average of ${game.ratingCount} rating${game.ratingCount === 1 ? "" : "s"}`}>
                      ★ {game.avgRating} <small>({game.ratingCount})</small>
                    </span>
                  )}
                </div>
                <GameReviewBlock game={game} meId={meId} onSaved={reload} />
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
                  <button className="btn btn--danger" onClick={() => api.removeVideo(video.id).then(reload)}>
                    Remove
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

/**
 * Per-game review area: everyone's reviews (signed with their Telegram name,
 * with rating and played flag), plus an editable box for your own — one review
 * per person, changeable later.
 */
function GameReviewBlock({ game, meId, onSaved }: { game: Game; meId: string | null; onSaved: () => void }) {
  const [draft, setDraft] = useState(game.myReview ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(game.myReview ?? "");
  }, [game.myReview]);

  const others = game.reviews.filter((r) => r.userId !== meId);

  const save = async () => {
    setSaving(true);
    try {
      await api.setGameReview(game.id, draft.trim() ? draft.trim() : null);
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reviews">
      {others.map((r) => (
        <div className="review" key={r.userId}>
          <div className="review__head">
            <span className="review__author">{r.authorName}</span>
            {r.rating && <span className="review__rating">★ {r.rating}</span>}
            <span className="review__played">{r.played ? "played" : "not played"}</span>
          </div>
          <div className="review__text">{r.review}</div>
        </div>
      ))}

      {editing ? (
        <div className="review review--own">
          <textarea
            className="review__input"
            placeholder="Your review…"
            value={draft}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="actions">
            <button className="btn btn--primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save review"}
            </button>
            <button className="btn btn--ghost" onClick={() => { setDraft(game.myReview ?? ""); setEditing(false); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : game.myReview ? (
        <div className="review review--own">
          <div className="review__head">
            <span className="review__author">You</span>
          </div>
          <div className="review__text">{game.myReview}</div>
          <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
            Edit review
          </button>
        </div>
      ) : (
        <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
          ✍ Write a review
        </button>
      )}
    </div>
  );
}
