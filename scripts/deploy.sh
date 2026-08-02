#!/usr/bin/env bash
set -e

echo "📦 Uploading assets to Workers KV..."

# Upload all static files to KV namespace bound as ASSETS
# This maps URL paths to KV keys (e.g., /css/style.css -> css/style.css in KV)
npx wrangler kv:bulk \
  --binding=ASSETS \
  --clean \
  .

echo ""
echo "🚀 Deploying Worker..."
npx wrangler deploy --outdir=./dist

echo ""
echo "✅ Deployment complete!"
echo "Your portfolio is now live on your Cloudflare Worker."
