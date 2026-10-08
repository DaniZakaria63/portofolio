# Dani Zakaria — Senior Software Engineer Portfolio

A modern, single-page portfolio with real-time 3D data flow visualization, built for Cloudflare Worker deployment.

## Tech Stack

- **Three.js** — 3D scenes (hero PCB data flow, skills orbiting spheres)
- **GSAP + ScrollTrigger** — Scroll-triggered animations, counters, loading transitions
- **Vanilla CSS** — Glassmorphism, 3D transforms, CSS variables, responsive grid
- **Cloudflare Workers** — Static asset serving via Workers KV

## Local Development

```bash
# Install http-server globally (if not already)
npm install -g http-server

# Or use the npm script
npm install && npm run preview
```

Open `http://localhost:3000` in your browser.

## Cloudflare Worker Deployment

### Prerequisites

1. Install [Wrangler CLI](https://developers.cloudflare.com/wrangler/):
   ```bash
   npm install -g wrangler
   ```

2. Authenticate:
   ```bash
   wrangler login
   ```

3. Get your account ID:
   ```bash
   wrangler whoami
   ```

4. Fill in `wrangler.toml`:
   - Replace `YOUR_ACCOUNT_ID` with your Cloudflare account ID
   - Create a KV namespace and replace `YOUR_KV_NAMESPACE_ID` and `YOUR_KV_PREVIEW_ID`

### Create KV Namespace

```bash
npx wrangler kv:namespace create ASSETS --preview
```

Copy the returned `id` and `preview_id` into `wrangler.toml`.

### Deploy

```bash
# Option 1: Full deploy (upload assets + deploy worker)
npm run deploy

# Option 2: Upload assets only
npm run upload

# Option 3: Deploy worker only (use after uploading assets)
npx wrangler deploy
```

## Server Deployment

Pushing to `master` (or running the *Deploy* workflow manually) rsyncs the
static site over SSH to the server, where nginx serves it from
`/var/www/danizakaria.tech` behind Cloudflare. `dream-team.works` serves a
static "on progress" page from the same server.

Setup, secrets, and troubleshooting: [server/README.md](server/README.md).

The existing Workers/KV pipeline (`npm run upload` / `npm run deploy`) is
unchanged.

## Customization

Replace the placeholder data in `index.html`:

| Section | What to Update |
|---|---|
| **About** | Bio text, experience stats, domain highlights |
| **Skills** | Skill categories, tech names, proficiency percentages |
| **Projects** | Project title, description, tech stack, category, links |
| **Experience** | Company, role, duration, achievements, tech stack |
| **Contact** | Email, phone, location, social links |

To customize 3D colors, update the `colorPalette` in `createParticles()` and the `nodePositions` array in `createDataFlow()` within `js/main.js`.

## File Structure

```
portfolio/
├── .github/
│   └── workflows/
│       └── deploy.yml  # CI: rsync deploy to server on push to master
├── server/             # Server-side setup kit (see server/README.md)
│   ├── nginx/          # vhost + security headers
│   └── cloudflared/    # tunnel ingress example
├── index.html          # Main HTML structure
├── css/
│   └── style.css       # All styling (modern CSS, no framework)
├── js/
│   ├── main.js         # Three.js + GSAP animations
│   └── lib/
│       ├── three.min.js
│       ├── gsap.min.js
│       └── ScrollTrigger.min.js
├── images/             # Portfolio images
├── worker.js           # Cloudflare Worker static file handler
├── wrangler.toml       # Worker configuration
├── package.json        # npm scripts
└── scripts/
    ├── deploy.sh       # Full deploy: upload + deploy
    └── upload-assets.sh # Upload static files to KV
```

## Browser Support

- Chrome 85+, Firefox 78+, Safari 14+, Edge 85+
- Three.js requires WebGL 2.0 support
- Mobile browsers supported with reduced particle count
