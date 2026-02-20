#!/bin/sh
set -e

echo "================================================"
echo "  Accordo Backend - Development Startup"
echo "================================================"

echo ""
echo "Starting dev server (tsx watch)..."
echo "Server handles migrations + sync + seed internally."
echo "================================================"
exec npx tsx watch src/index.ts
