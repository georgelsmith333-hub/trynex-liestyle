#!/bin/bash
set -e

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building TryNex Lifestyle storefront..."
NODE_ENV=production pnpm --filter @workspace/trynex-storefront run build

echo "==> Build complete! Output: artifacts/trynex-storefront/dist"
