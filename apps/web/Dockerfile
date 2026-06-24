# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
ARG VITE_TELEGRAM_BOT_USERNAME=""
ENV VITE_TELEGRAM_BOT_USERNAME=$VITE_TELEGRAM_BOT_USERNAME
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @app/shared build && pnpm --filter @app/web build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
