import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { formatCoop, formatPlayers, formatPriceRub, REVIEW_MAX_LENGTH, REVIEW_MAX_LINES } from "@app/shared";
import { api, Game, Recipient, Video } from "../api/client";
import { Modal } from "../components/Modal";

const PAGE_SIZE = 8;

type RemoveTarget = { kind: "game" | "video"; id: string; title: string };
type SuggestTarget = { kind: "game" | "video"; id: string; title: string };

export function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [newGame, setNewGame] = useState("");
  const [addingGame, setAddingGame] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [visibleGames, setVisibleGames] = useState(PAGE_SIZE);
  const [visibleVideos, setVisibleVideos] = useState(PAGE_SIZE);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [suggestTarget, setSuggestTarget] = useState<SuggestTarget | null>(null);
  const navigate = useNavigate();

  const reload = useCallback(() => {
    api.listGames().then(setGames).catch(() => undefined);
    api.listVideos().then(setVideos).catch(() => undefined);
  }, []);

  useEffect(() => {
    reload();
    api.me().then((u) => setMeId(u.id)).catch(() => undefined);
    api.listRecipients().then(setRecipients).catch(() => undefined);
  }, [reload]);

  // Live updates: the API emits "library:changed" on every add/edit/remove, so
  // every open dashboard refreshes itself. Debounced to coalesce bursts.
  useEffect(() => {
    const socket = io({ withCredentials: true });
    let timer: number | undefined;
    socket.on("library:changed", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(reload, 300);
    });
    return () => {
      window.clearTimeout(timer);
      socket.disconnect();
    };
  }, [reload]);

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

  const doSuggest = async (recipientIds: string[]) => {
    if (!suggestTarget) return;
    const { kind, id } = suggestTarget;
    setSuggestTarget(null);
    try {
      const { sent } =
        kind === "game" ? await api.suggestGame(id, recipientIds) : await api.suggestVideo(id, recipientIds);
      flash(`Suggested to ${sent} ${sent === 1 ? "person" : "people"} ${kind === "game" ? "🎮" : "📺"}`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't suggest");
    }
  };

  const doRemove = async () => {
    if (!removeTarget) return;
    const { kind, id } = removeTarget;
    setRemoveTarget(null);
    if (kind === "game") await api.removeGame(id);
    else await api.removeVideo(id);
    reload();
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
          {games.slice(0, visibleGames).map((game) => {
            const coop = formatCoop(game);
            const players = formatPlayers(game);
            const price = formatPriceRub(game);
            const coverInner = (
              <>
                {game.headerImage ? (
                  <img src={game.headerImage} alt={game.title} loading="lazy" />
                ) : (
                  <div className="card__cover-empty">No cover</div>
                )}
                <div className="badges">
                  {price && <span className="badge badge--price">💰 {price}</span>}
                  {game.hasDemo && <span className="badge badge--demo">Demo</span>}
                  {players && <span className="badge badge--players">👥 {players}</span>}
                  {coop && <span className="badge badge--coop">🤝 Co-op</span>}
                  {game.releaseDateRaw && <span className="badge">{game.releaseDateRaw}</span>}
                </div>
              </>
            );
            return (
            <article className={`card${game.played ? " is-done" : ""}`} key={game.id}>
              {game.steamUrl ? (
                <a className="card__cover" href={game.steamUrl} target="_blank" rel="noreferrer">
                  {coverInner}
                </a>
              ) : (
                <div className="card__cover">{coverInner}</div>
              )}
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
                  <button
                    className="btn btn--suggest"
                    onClick={() => setSuggestTarget({ kind: "game", id: game.id, title: game.title })}
                  >
                    Suggest
                  </button>
                  <button
                    className="btn btn--danger"
                    onClick={() => setRemoveTarget({ kind: "game", id: game.id, title: game.title })}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </div>
        {games.length > visibleGames && (
          <div className="show-more">
            <button className="btn btn--ghost" onClick={() => setVisibleGames((v) => v + PAGE_SIZE)}>
              Show more ({games.length - visibleGames})
            </button>
          </div>
        )}
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
          {videos.slice(0, visibleVideos).map((video) => (
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
                  <button
                    className="btn btn--suggest"
                    onClick={() => setSuggestTarget({ kind: "video", id: video.id, title: video.title ?? video.url })}
                  >
                    Suggest
                  </button>
                  <button
                    className="btn btn--danger"
                    onClick={() => setRemoveTarget({ kind: "video", id: video.id, title: video.title ?? video.url })}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {videos.length > visibleVideos && (
          <div className="show-more">
            <button className="btn btn--ghost" onClick={() => setVisibleVideos((v) => v + PAGE_SIZE)}>
              Show more ({videos.length - visibleVideos})
            </button>
          </div>
        )}
      </section>

      {removeTarget && (
        <Modal title="Remove?" onClose={() => setRemoveTarget(null)}>
          <p className="modal__text">
            Remove “{removeTarget.title}”? This can’t be undone.
          </p>
          <div className="actions">
            <button className="btn btn--danger" onClick={doRemove}>
              Remove
            </button>
            <button className="btn btn--ghost" onClick={() => setRemoveTarget(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {suggestTarget && (
        <SuggestModal
          title={suggestTarget.title}
          recipients={recipients}
          onClose={() => setSuggestTarget(null)}
          onSend={doSuggest}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/**
 * Suggest picker: lists every group member (names from Telegram), all selected
 * by default, and sends the suggestion only to the people left checked.
 */
function SuggestModal({
  title,
  recipients,
  onClose,
  onSend,
}: {
  title: string;
  recipients: Recipient[];
  onClose: () => void;
  onSend: (recipientIds: string[]) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(recipients.map((r) => r.id)));
  const [sending, setSending] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    setSending(true);
    await onSend([...selected]);
  };

  return (
    <Modal title={`Suggest “${title}”`} onClose={onClose}>
      <div className="picker">
        {recipients.length === 0 && <p className="modal__text">No people to suggest to yet.</p>}
        {recipients.map((r) => (
          <label className="picker__row" key={r.id}>
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
            <span>{r.name}</span>
          </label>
        ))}
      </div>
      <div className="actions">
        <button className="btn btn--primary" disabled={sending || selected.size === 0} onClick={send}>
          {sending ? "Sending…" : `Suggest (${selected.size})`}
        </button>
        <button className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
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
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(game.myReview ?? "");
  }, [game.myReview]);

  const reviews = game.reviews;
  const shown = showAll ? reviews : reviews.slice(0, 1);

  const onDraftChange = (value: string) => {
    setError(null);
    setDraft(value.split("\n").slice(0, REVIEW_MAX_LINES).join("\n"));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.setGameReview(game.id, draft.trim() ? draft.trim() : null);
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reviews">
      {shown.map((r) => (
        <div className={`review${r.userId === meId ? " review--own" : ""}`} key={r.userId}>
          <div className="review__head">
            <span className="review__author">{r.authorName}{r.userId === meId ? " (you)" : ""}</span>
            {r.rating && <span className="review__rating">★ {r.rating}</span>}
            <span className="review__played">{r.played ? "played" : "not played"}</span>
          </div>
          <div className="review__text">{r.review}</div>
        </div>
      ))}

      {reviews.length > 1 && (
        <button className="btn btn--ghost btn--sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Hide reviews" : `Show all reviews (${reviews.length})`}
        </button>
      )}

      {editing ? (
        <div className="review review--own">
          <textarea
            className="review__input"
            placeholder="Your review…"
            value={draft}
            maxLength={REVIEW_MAX_LENGTH}
            onChange={(e) => onDraftChange(e.target.value)}
          />
          <div className="review__count">
            {draft.length}/{REVIEW_MAX_LENGTH} · {draft.split("\n").length}/{REVIEW_MAX_LINES} lines
          </div>
          {error && <div className="review__error">{error}</div>}
          <div className="actions">
            <button className="btn btn--primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save review"}
            </button>
            <button className="btn btn--ghost" onClick={() => { setDraft(game.myReview ?? ""); setEditing(false); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
          {game.myReview ? "Edit your review" : "✍ Write a review"}
        </button>
      )}
    </div>
  );
}
