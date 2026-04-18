#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing pnpm@10.26.1..."
npm install -g pnpm@10.26.1

echo "==> Installing dependencies (including devDependencies)..."
NODE_ENV=development pnpm install --no-frozen-lockfile

echo "==> Pushing database schema..."
pnpm --filter @workspace/db run push

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo "==> Build complete!"
