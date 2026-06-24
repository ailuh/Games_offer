# Watchlist Hub

A self-hosted, invite-only hub for a small group of friends to collect **games**
and **videos**, track plays/watches, rate games, get **release-day notifications**,
and run **synchronized YouTube watch parties** — from a website and a Telegram bot.

Send the bot a post, a Steam link, or just a game name and an LLM parses it into
structured fields, enriched from Steam; YouTube links go to the videos pool. Access
is limited to an allowlist of Telegram ids, and everyone in the group is equal.

> Personal pet project. Full-TypeScript pnpm monorepo: NestJS + Prisma/Postgres +
> grammY + OpenAI on the back, React + Vite + Socket.IO on the front, Caddy + Docker
> Compose to deploy. The backend runs as one process (REST + WebSocket + bot + cron).

## Features

- **Telegram login** — allowlisted Telegram ids only; no passwords stored.
- **Games & videos** — per-user played/watched, 1–10 ratings, screenshots, and co-op
  modes + player count (read from the Steam description only when it states one).
- **AI ingest** — bot messages parsed by OpenAI into a strict schema, enriched from Steam.
- **Release notifications** — a daily job pings the group on release day and flags delays.
- **Suggestions** — push a game or video to everyone via Telegram DM.
- **Watch party** — a shared room with synchronized YouTube playback and queue.

## Quick start (local)

You'll need Node 22+, pnpm, Docker, a Telegram bot token from
[@BotFather](https://t.me/BotFather), and an OpenAI API key.

```bash
pnpm install
cp .env.example .env             # fill in the values (inline notes in the file)
docker compose up -d postgres    # local Postgres only
pnpm --filter @app/api prisma migrate dev
pnpm dev                         # web :5173, api :3000
```

The Telegram login widget needs a public HTTPS domain, so local dev uses a dev-login
shim (automatically disabled when `NODE_ENV=production`).

## Deploy (single VPS)

Four containers: `caddy` (HTTPS edge), `web`, `api`, and `postgres` (internal-only).

```bash
git clone <your-repo-url> && cd <repo>
cp .env.example .env             # production values; set NODE_ENV=production and DOMAIN
docker compose up -d --build
docker compose exec api pnpm prisma migrate deploy
```

Point your domain's DNS A record at the server and open ports 80/443 — Caddy obtains
and renews TLS automatically. Keep Postgres unpublished, keep `.env` out of git
(`chmod 600 .env`), and set `OPENAI_DAILY_TOKEN_CAP` (the provider's own limit only
alerts, it does not stop spend).

### Behind an existing reverse proxy

If the host already runs a reverse proxy on 80/443 (e.g. nginx for other sites),
skip Caddy and let that proxy handle TLS. Bring up the app on localhost ports and
forward to them:

```bash
docker compose -f docker-compose.yml -f docker-compose.behind-proxy.yml \
  up -d --build postgres api web
docker compose -f docker-compose.yml -f docker-compose.behind-proxy.yml \
  exec api pnpm prisma migrate deploy
```

Then add a vhost on the host proxy pointing at `127.0.0.1:8090` (web) and
`127.0.0.1:3090` (api) — see [`deploy/nginx-site.conf.example`](./deploy/nginx-site.conf.example),
then `certbot --nginx -d your-domain` for TLS.

## Security

The Telegram Login Widget's HMAC and `auth_date` are verified server-side and the id
checked against the allowlist before a session is issued; the same allowlist guards
every bot command. Telegram post content is treated as untrusted LLM input (data and
instructions separated, no secrets in prompts) and all model output is schema-validated.

## Disclaimer

Personal project for personal use. It embeds the official YouTube IFrame Player and
only synchronizes playback timestamps between clients — it does not download or rehost
content — and uses public Steam endpoints for metadata. You are responsible for
complying with the Terms of Service of YouTube, Steam, OpenAI, and Telegram and with
applicable law. Provided "as is", without warranty — see [LICENSE](./LICENSE).

## License

[MIT](./LICENSE)
