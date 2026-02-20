# =============================================
# Accordo Backend - Unified Dockerfile
# Multi-stage build with dev and prod targets
# =============================================
#
# Development (hot-reload with tsx watch):
#   docker build --target dev -t accordo-backend:dev .
#
# Production (compiled TypeScript + migrations):
#   docker build --target prod -t accordo-backend:prod .
#
# Or via Docker Compose profiles:
#   docker compose --profile dev up -d --build
#   docker compose --profile prod up -d --build
# =============================================

# ---------------------------------------------
# Stage 1: Dependencies (shared by dev & prod)
# ---------------------------------------------
FROM node:20-alpine AS deps

# Install build dependencies for native modules (bcrypt, canvas, etc.)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    curl

WORKDIR /app

# Copy only package files first (better layer caching)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build/dev)
RUN npm install

# =============================================
# TARGET: dev — hot-reload with tsx watch
# =============================================
# Source code is mounted as a volume at runtime.
# start.dev.sh starts tsx watch; server handles migrations + seed internally
# ---------------------------------------------
FROM deps AS dev

ENV NODE_ENV=development
ENV PORT=5002

EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:5002/api/health || exit 1

# start.dev.sh is volume-mounted from the host
CMD ["/app/start.dev.sh"]

# =============================================
# TARGET: prod — compiled TypeScript
# =============================================

# ---------------------------------------------
# Stage 2: Builder (TypeScript compilation)
# ---------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Prune devDependencies for production, then re-install sequelize-cli
# (needed at runtime for the migration step in start.sh)
RUN npm prune --production && npm install sequelize-cli

# ---------------------------------------------
# Stage 3: Production Runtime
# ---------------------------------------------
FROM node:20-alpine AS prod

# Install runtime dependencies for native modules
RUN apk add --no-cache \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    pixman \
    curl

ENV NODE_ENV=production
ENV PORT=5002

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy necessary config files
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/sequelize.config.cjs ./sequelize.config.cjs

# Create runtime directories (logs for winston, uploads for multer/PDFs)
RUN mkdir -p /app/logs/combined /app/logs/error /app/uploads/pdfs

# Create production-safe .sequelizerc (without ts-node dependency)
RUN echo 'const path = require("path");' > /app/.sequelizerc && \
    echo 'module.exports = {' >> /app/.sequelizerc && \
    echo '  config: path.resolve(__dirname, "sequelize.config.cjs"),' >> /app/.sequelizerc && \
    echo '  migrationsPath: path.resolve(__dirname, "migrations"),' >> /app/.sequelizerc && \
    echo '};' >> /app/.sequelizerc

# Create startup script (server handles migrations internally)
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "Starting Accordo server..."' >> /app/start.sh && \
    echo 'exec node dist/index.js' >> /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5002/api/health || exit 1

CMD ["/app/start.sh"]
