# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @app/shared build \
 && pnpm --filter @app/api prisma generate \
 && pnpm --filter @app/api build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
