# syntax=docker/dockerfile:1.7

# Build stage
FROM node:22-slim AS build
WORKDIR /app

# Install system dependencies required by @llamaindex/liteparse
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    ca-certificates \
    libreoffice \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY tsconfig.json vite.config.ts ./
COPY src ./src

RUN pnpm build

# Runtime stage
FROM node:22-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    ca-certificates \
    libreoffice \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist

EXPOSE 5707

CMD ["node", "dist/index.js"]
