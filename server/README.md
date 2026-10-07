# Deploying to dream-team.works

How the site gets from a push to `master` onto the server:

```
GitHub push to master
└─ GitHub Actions  (.github/workflows/deploy.yml)
   └─ POST https://deploy.dream-team.works/deploy  + bearer token
      └─ Cloudflare edge ──► cloudflared tunnel ──► 127.0.0.1:8090
         └─ deploy-webhook.service (systemd, user "deploy")
            └─ server/deploy-portfolio.sh
               ├─ git fetch + reset to origin/master   (read-only deploy key)
               └─ rsync index.html css js images ──► /var/www/dream-team.works
```

- The server pulls from GitHub itself; no inbound SSH from CI is needed.
- The deploy endpoint is only reachable through the Cloudflare Tunnel and requires the bearer token.
- Cloudflare stays in front of the site; the existing Workers/KV deploy (`npm run upload` / `npm run deploy`) is untouched.

Everything below is one-time setup. Commands are written for the machine you SSH to the server from — run them on the server itself (through your tunnel SSH as usual).

## 0. Prerequisites on the server

- SSH access with sudo, plus `git`, `python3`, `rsync`, `flock` (util-linux) — all present on recent Ubuntu/Debian.
- `nginx` when you get to step 5.
- Outbound internet (the tunnel already implies this).

## 1. One-time server setup

### 1a. Deploy user and directories

```bash
sudo useradd --create-home --shell /bin/bash deploy
sudo install -d -o deploy -g deploy -m 755 /srv/portofolio
sudo install -d -o deploy -g deploy -m 755 /var/www/dream-team.works
```

### 1b. Read-only deploy key for GitHub

The repository is private, so the server authenticates with a repository deploy key (read-only).

```bash
sudo install -d -o deploy -g deploy -m 700 /etc/portofolio
sudo -u deploy ssh-keygen -t ed25519 -N '' -C 'deploy@dream-team.works' -f /etc/portofolio/deploy_key
sudo -u deploy sh -c 'ssh-keyscan -t ed25519 github.com > /etc/portofolio/known_hosts 2>/dev/null'
cat /etc/portofolio/deploy_key.pub
```

Add the printed key at GitHub: repository → **Settings → Deploy keys → Add deploy key** (leave "Allow write access" unchecked).

### 1c. Clone the repository and pin SSH settings

```bash
sudo -u deploy env GIT_SSH_COMMAND="ssh -i /etc/portofolio/deploy_key -o IdentitiesOnly=yes -o UserKnownHostsFile=/etc/portofolio/known_hosts -o StrictHostKeyChecking=yes" \
  git clone git@github.com:DaniZakaria63/portofolio.git /srv/portofolio

sudo -u deploy git -C /srv/portofolio config core.sshCommand \
  "ssh -i /etc/portofolio/deploy_key -o IdentitiesOnly=yes -o UserKnownHostsFile=/etc/portofolio/known_hosts -o StrictHostKeyChecking=yes"

sudo -u deploy git -C /srv/portofolio fetch origin
```

`sudo -u deploy git -C /srv/portofolio log --oneline -1` should show the latest `master`. This checkout belongs to the deploy service — don't edit files in it (`deploy-portfolio.sh` resets and cleans it on every deploy).

## 2. Deploy webhook service

### 2a. Token and environment file

```bash
token="$(openssl rand -hex 32)"

sudo install -m 600 /dev/null /etc/deploy-webhook.env
sudo tee /etc/deploy-webhook.env >/dev/null <<EOF
DEPLOY_TOKEN=$token
PORT=8090
DEPLOY_TIMEOUT=300
BRANCH=master
REPO_DIR=/srv/portofolio
WEBROOT=/var/www/dream-team.works
DEPLOY_SCRIPT=/srv/portofolio/server/deploy-portfolio.sh
EOF

echo "deploy token (save it for step 4): $token"
```

If you lose the token later: regenerate it, update `/etc/deploy-webhook.env`, restart the service, and update the GitHub secret.

### 2b. Install and start the unit

```bash
sudo cp /srv/portofolio/server/systemd/deploy-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now deploy-webhook
systemctl status deploy-webhook --no-pager
```

### 2c. Local smoke test

```bash
token="$(sudo sed -n 's/^DEPLOY_TOKEN=//p' /etc/deploy-webhook.env)"

curl -s http://127.0.0.1:8090/healthz                                    # -> {"ok": true}
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8090/deploy   # -> 401
curl -s -X POST http://127.0.0.1:8090/deploy -H "Authorization: Bearer $token"  # -> real deploy
```

The last command performs an actual deploy — watch it with `journalctl -u deploy-webhook -f` and check that `/var/www/dream-team.works` fills up.

## 3. Publish the endpoint through the Cloudflare Tunnel

Add the ingress rules to your tunnel config (see `server/cloudflared/ingress-example.yml` for the full example; keep the catch-all last):

```yaml
ingress:
  - hostname: deploy.dream-team.works
    service: http://127.0.0.1:8090
  - hostname: dream-team.works
    service: http://127.0.0.1:80
  - hostname: www.dream-team.works
    service: http://127.0.0.1:80
  - service: http_status:404
```

Create the DNS record for the deploy hostname (once) and restart the tunnel:

```bash
cloudflared tunnel route dns <tunnel-name> deploy.dream-team.works
sudo systemctl restart cloudflared
```

Test from anywhere:

```bash
curl -s https://deploy.dream-team.works/healthz
curl -s -X POST https://deploy.dream-team.works/deploy -H "Authorization: Bearer <token>"
```

> Note: `dream-team.works` currently answers 521 ("Web Server Is Down"), which means the tunnel route or origin for the site hostname isn't serving yet. Step 5 fixes that — until then, only the `deploy.` hostname needs to work.

## 4. GitHub secrets

Add two repository secrets (Settings → Secrets and variables → Actions → New repository secret):

| Name | Value |
|---|---|
| `DEPLOY_WEBHOOK_URL` | `https://deploy.dream-team.works/deploy` |
| `DEPLOY_WEBHOOK_TOKEN` | the token from step 2a |

Or with the `gh` CLI on your machine:

```bash
gh auth login   # once
gh secret set DEPLOY_WEBHOOK_URL --body "https://deploy.dream-team.works/deploy"
gh secret set DEPLOY_WEBHOOK_TOKEN   # paste the token when prompted
```

## 5. Serve the site with nginx (this also fixes the 521)

```bash
sudo cp /srv/portofolio/server/nginx/security-headers.conf /etc/nginx/snippets/portfolio-security-headers.conf
sudo cp /srv/portofolio/server/nginx/dream-team.works.conf  /etc/nginx/sites-available/dream-team.works.conf
sudo ln -s /etc/nginx/sites-available/dream-team.works.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

- If you already run another web server (Caddy, Apache), just point its document root at `/var/www/dream-team.works` and mirror the headers/caching from the nginx config.
- Cloudflare SSL/TLS mode: with the tunnel the origin is plain HTTP on localhost, so **Flexible** works. (Edge ↔ Cloudflare and Cloudflare ↔ tunnel are encrypted; only tunnel → localhost is plain.) For end-to-end TLS, install a Cloudflare Origin Certificate and use **Full (strict)**.

If the site still 521s afterwards:

```bash
systemctl status cloudflared
cloudflared tunnel list
curl -sI -H 'Host: dream-team.works' http://127.0.0.1/   # nginx answering locally?
```

## 6. First CI deploy

Merge the workflow to `master`, then push (or use Actions → Deploy → Run workflow).

Verify:

- The GitHub Actions run is green and its log shows the deploy script output.
- `curl -sI https://dream-team.works` returns 200.
- On the server: `journalctl -u deploy-webhook -n 50 --no-pager`.

## Day-to-day

- **Push to master → live in seconds.** Only `index.html`, `css/`, `js/`, `images/` reach the webroot; everything else in the repo (`scripts/`, `server/`, docs) is ignored by the rsync stage. Every push triggers a deploy, even doc-only ones — harmless, it's just an idempotent sync.
- **Manual deploy:** `sudo -u deploy bash /srv/portofolio/server/deploy-portfolio.sh`
- **Rollback:** revert the bad commit on `master` and push (deploys always reflect `master`). For an emergency hotfix, edit files directly in `/var/www/dream-team.works` — the next deploy will overwrite them.
- **Rotate the token:** `openssl rand -hex 32` → update `/etc/deploy-webhook.env` → `sudo systemctl restart deploy-webhook` → update the GitHub secret.

## Security notes

- The bearer token is the only app-level auth on the endpoint; GitHub stores it encrypted and curl sends it in a header (not in URLs or logs).
- Optional hardening: put `deploy.dream-team.works` behind **Cloudflare Access** (Zero Trust → Access → Applications, self-hosted) with a service token, then extend the workflow step with:
  ```yaml
  -H "CF-Access-Client-Id: ${{ secrets.CF_ACCESS_CLIENT_ID }}" \
  -H "CF-Access-Client-Secret: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}"
  ```
  Requests without the service token then never reach the webhook at all.
- The deploy key is read-only and the webhook listens on `127.0.0.1` only.
