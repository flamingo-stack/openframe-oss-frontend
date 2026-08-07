# syntax=docker/dockerfile:1.7
# Next.js 16 standalone (distDir=dist), multi-arch via BuildKit
FROM --platform=$BUILDPLATFORM node:22-alpine3.24 AS builder
WORKDIR /app

# npm's defaults allow 970s of silence per hung registry socket; these bound it to 115s 
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_FETCH_TIMEOUT=30000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=15000 \
    NPM_CONFIG_LOGLEVEL=http
ARG GITHUB_ACTOR

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .

RUN --mount=type=cache,target=/app/dist/cache \
    npm run build && \
    if node -p "require('./dist/required-server-files.json').config.images.unoptimized" | grep -q true; then \
      rm -rf dist/standalone/node_modules/@img dist/standalone/node_modules/sharp; \
    fi

FROM node:22-alpine3.24 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk upgrade --no-cache && \
    rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-v* && \
    addgroup -S -g 1001 nodejs && \
    adduser  -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/dist/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/dist/static      ./dist/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts/server-entry.js ./server-entry.js

USER nextjs
EXPOSE 3000
ENTRYPOINT ["node", "server-entry.js"]
