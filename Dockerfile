# =============================================
# Accordo Backend - Production Dockerfile
# Multi-stage build optimized for layer caching
# Supports: AMD64 and ARM64 (Apple Silicon)
# =============================================

# ---------------------------------------------
# Stage 1: Dependencies (cached layer)
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
    pixman-dev

WORKDIR /app

# Copy only package files first (better layer caching)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

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

# Prune devDependencies for production
RUN npm prune --production

# ---------------------------------------------
# Stage 3: Production Runtime
# ---------------------------------------------
FROM node:20-alpine AS production

# Install runtime dependencies for native modules
RUN apk add --no-cache \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    pixman \
    # Required for healthcheck
    curl

# Set environment
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

# Create production-safe .sequelizerc (without ts-node dependency)
RUN echo 'const path = require("path");' > /app/.sequelizerc && \
    echo 'module.exports = {' >> /app/.sequelizerc && \
    echo '  config: path.resolve(__dirname, "sequelize.config.cjs"),' >> /app/.sequelizerc && \
    echo '  migrationsPath: path.resolve(__dirname, "migrations"),' >> /app/.sequelizerc && \
    echo '};' >> /app/.sequelizerc

# Create startup script for migrations + server
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "Running database migrations..."' >> /app/start.sh && \
    echo 'npm run migrate || echo "Migration failed or already up to date"' >> /app/start.sh && \
    echo 'echo "Starting server..."' >> /app/start.sh && \
    echo 'exec node dist/index.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose the application port
EXPOSE 5002

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5002/api/health || exit 1

# Start the application with migrations
CMD ["/app/start.sh"]
