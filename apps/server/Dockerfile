FROM oven/bun:latest AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY turbo.json ./

COPY apps/server/package.json ./apps/server/
COPY packages/api/package.json ./packages/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/socket/package.json ./packages/socket/

RUN bun install --frozen-lockfile

COPY packages ./packages
COPY apps/server ./apps/server

RUN cd apps/server && bun run build

FROM oven/bun:latest AS runner
WORKDIR /app

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./

EXPOSE 3000

CMD ["bun", "run", "dist/index.mjs"]
