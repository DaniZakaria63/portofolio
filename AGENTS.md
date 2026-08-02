# AGENTS.md

Static one-page portfolio (Three.js + GSAP) served via Cloudflare Workers + KV. **No build step** — edit source files directly.

## Commands

- `npm run preview` — local dev via http-server on port 3000 (preferred, by user preference)
- `npm run dev` — wrangler dev (needs filled `wrangler.toml` + KV)
- `npm run upload` — `scripts/upload-assets.sh`: stages `index.html` + `css/ js/ images/ fonts/` into `.public-tmp/`, `kv:bulk --clean` to ASSETS, then removes tmp dir
- `npm run deploy` — `scripts/deploy.sh`: `wrangler kv:bulk --binding=ASSETS --clean .` then `wrangler deploy`

No lint, typecheck, or test tooling exists.

## Gotchas

- **Deploy KV push is the whole repo**: `deploy.sh` bulk-uploads `.` (cwd), so `wrangler.toml`, `package.json`, `scripts/` also land in KV. Harmless functionally, but extra clutter. Use `npm run upload` for a clean asset-only push.
- **`fonts/` no longer exists** (stripped from the template); `upload-assets.sh` skips it via `2>/dev/null || true`. Don't reintroduce font files relying on it.
- **CSP is strict**: `script-src 'self'`, `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`. All JS is vendored locally in `js/lib/` (minified three/gsap/ScrollTrigger) — never add external script/CDN tags or CSP edit + deploy both needed.
- **`wrangler.toml` has placeholder values** — `YOUR_ACCOUNT_ID`, `YOUR_KV_NAMESPACE_ID`, `YOUR_KV_PREVIEW_ID`. Deploys fail until replaced.
- **Libs are vendored globals**: `js/lib/*.min.js` load onto `window` (`THREE`, `gsap`). No npm deps in `package.json`.
- **worker.js is the only backend**: serves KV keys 1:1 from path (`/` → `index.html`), SPA-fallback to `index.html` for unknown paths, immutable cache for `css/js`, `must-revalidate` for html, security headers baked in.
- **Deployment is two-phase**: upload assets to KV, then deploy worker — worker reads KV at request time, so asset uploads can be done without redeploying.

## Customization

Content lives inline in `index.html` (bio, projects, skills, experience, contact — see README table). 3D scene config is in `js/main.js`: `colorPalette` in `createParticles()`, `nodePositions` in `createDataFlow()`, camera/scene in the `HeroScene` class.

## Restrictions

- `.commandcode/taste/portfolio-&-design-preferences/taste.md` records the design taste constraints (single-page landing look, realistic PCB/space-theme 3D, flat-to-viewer orientation, monospace the real repo honestly header font vs sans body). Respect them when editing the 3D scene or layout.
- Images live in `images/`; referenced from `index.html`.