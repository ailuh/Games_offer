# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Copy only the manifests first so `pnpm install` is cached and re-runs only when
# a package.json or the lockfile changes — not on every source edit.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
# --ignore-scripts: the shared package's `prepare` (tsc) would run here, before
# its source exists. We build it explicitly after copying the source below.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm --filter @app/shared build \
 && pnpm --filter @app/api exec prisma generate \
 && pnpm --filter @app/api build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
