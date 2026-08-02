#!/usr/bin/env bash
set -e

echo "📦 Preparing static assets..."

# Create a temporary public directory with only the files to serve
rm -rf .public-tmp
mkdir -p .public-tmp

# Copy all static assets
cp -r index.html css/ js/ images/ fonts/ .public-tmp/ 2>/dev/null || true

# Remove old library files from the copy to avoid confusion
# (We now serve js/lib/ alongside js/main.js)

echo "📤 Uploading to Workers KV..."
npx wrangler kv:bulk \
  --binding=ASSETS \
  --clean \
  .public-tmp

echo ""
echo "🧹 Cleaning up..."
rm -rf .public-tmp

echo "✅ Assets uploaded successfully!"
