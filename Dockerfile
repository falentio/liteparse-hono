# syntax=docker/dockerfile:1.7

# Build stage
FROM node:24-slim AS build
WORKDIR /app

# Install system dependencies required by @llamaindex/liteparse.
# ghostscript is the back-end for ImageMagick's PDF coder; liteparse
# routes image OCR through a PDF conversion step (see smoke-test
# failure history). The PDF policy restriction in /etc/ImageMagick-6/
# policy.xml is relaxed below to allow this. Security note: this
# re-enables the Ghostscript RCE surface for *uploaded PDFs being
# rasterized through ImageMagick*. Bounded by API-key auth + 30MB
# cap; acceptable for this internal tool.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    ca-certificates \
    libreoffice \
    imagemagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/* \
    && sed -i 's|<policy domain="coder" rights="none" pattern="PDF" />|<policy domain="coder" rights="read\|write" pattern="PDF" />|' /etc/ImageMagick-6/policy.xml

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY tsconfig.json vite.config.ts ./
COPY src ./src

RUN pnpm build

# Runtime stage
FROM node:24-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    ca-certificates \
    libreoffice \
    imagemagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/* \
    && sed -i 's|<policy domain="coder" rights="none" pattern="PDF" />|<policy domain="coder" rights="read\|write" pattern="PDF" />|' /etc/ImageMagick-6/policy.xml

ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist

EXPOSE 5707

CMD ["node", "dist/index.js"]
