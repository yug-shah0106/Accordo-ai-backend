#!/bin/sh
set -e

echo "================================================"
echo "  Accordo Backend - Development Startup"
echo "================================================"

# Step 1: Run database migrations
echo ""
echo "[1/3] Running database migrations..."
npx sequelize-cli db:migrate || {
  echo "WARNING: Migrations failed (database may not exist yet, retrying in 5s)..."
  sleep 5
  npx sequelize-cli db:migrate
}
echo "Migrations complete."

# Step 2: Run seed data
echo ""
echo "[2/3] Running seed data..."
npx tsx ./scripts/seed.ts || {
  echo "WARNING: Seed script failed. Continuing without seed data."
}
echo "Seed complete."

# Step 3: Start dev server with hot-reload
echo ""
echo "[3/3] Starting dev server (tsx watch)..."
echo "================================================"
exec npx tsx watch src/index.ts
