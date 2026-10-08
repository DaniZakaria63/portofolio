# Deploying the portfolio (danizakaria.tech) to the server

How the site gets from a push to `master` onto the server:

```
GitHub push to master
└─ GitHub Actions  (.github/workflows/deploy.yml)
   └─ rsync over SSH  (deploy key, pinned host key)
      └─ <server-ip>:/var/www/danizakaria.tech
         └─ nginx → Cloudflare Tunnel → visitors
```

- CI pushes a snapshot of the static site (`index.html`, `css/`, `js/`, `images/`); the server needs no git, no Python, no webhook.
- The webroot becomes an **exact mirror** of those files — anything else in it (except `.well-known/`) is deleted on each deploy.
- Cloudflare stays in front of the site; the existing Workers/KV deploy (`npm run upload` / `npm run deploy`) is untouched.

Everything below is one-time setup. Commands marked **server** run over SSH on the server, **local** on your machine.

## 0. Prerequisites

- **server**: sudo SSH access via the server IP, `rsync`, and `nginx`.
- **local**: `ssh`, `ssh-keygen`, `scp`, and optionally the `gh` CLI for secrets.

## 1. Server setup

### 1a. The deploy user and webroot

```bash
# server
sudo useradd --create-home --shell /bin/bash deploy
sudo install -d -o deploy -g deploy -m 755 /var/www/danizakaria.tech
```

### 1b. CI key pair

```bash
# local - generate a key dedicated to CI (no passphrase so Actions can use it)
ssh-keygen -t ed25519 -N '' -C 'github-actions-deploy' -f deploy_key
cat deploy_key.pub
```

```bash
# server - install the public key for the deploy user
# (paste the line printed by "cat deploy_key.pub" above)
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
echo 'ssh-ed25519 AAAA... github-actions-deploy' | sudo tee -a /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Test the key from your machine:

```bash
# local
ssh -i deploy_key deploy@<server-ip> 'echo ok'
```

### 1c. Pin the host key

```bash
# local - collect the server's host keys
ssh-keyscan -p 22 <server-ip> > known_hosts      # use -p <port> if not 22
```

Verify they match the server before trusting them:

```bash
# server
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub    # repeat for rsa/ecdsa if present
# local
ssh-keygen -lf known_hosts
# the fingerprints must match
```

## 2. GitHub secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | server IP (or hostname) |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | full contents of `deploy_key` (the private half) |
| `DEPLOY_KNOWN_HOSTS` | full contents of `known_hosts` from step 1c |
| `DEPLOY_PORT` | SSH port — optional, defaults to `22` |

Or with `gh` (run where the files are):

```bash
gh auth login    # once
gh secret set DEPLOY_HOST --body '<server-ip>'
gh secret set DEPLOY_USER --body 'deploy'
gh secret set DEPLOY_PORT --body '22'          # skip if using port 22
gh secret set DEPLOY_SSH_KEY < deploy_key
gh secret set DEPLOY_KNOWN_HOSTS < known_hosts
```

## 3. How the workflow deploys

`.github/workflows/deploy.yml` runs on every push to `master` (and manually via Actions → Deploy → Run workflow):

1. checks out the repo;
2. writes `DEPLOY_SSH_KEY` / `DEPLOY_KNOWN_HOSTS` into `~/.ssh` on the runner (missing secrets fail the job with a clear error);
3. stages `index.html css js images`, then rsyncs the stage to `/var/www/danizakaria.tech/`.

rsync flags in use: `--delete` mirrors the webroot, `.well-known/` is protected, `-c` compares checksums (so same-size edits can never be skipped), `-i` lists exactly what changed in the log. The job is green only if rsync succeeds.

## 4. Serve the site with nginx (fixes the current 521)

Copy the configs from your local checkout:

```bash
# local
scp server/nginx/security-headers.conf <admin-user>@<server-ip>:/tmp/
scp server/nginx/dream-team.works.conf  <admin-user>@<server-ip>:/tmp/
```

```bash
# server
sudo cp /tmp/security-headers.conf /etc/nginx/snippets/portfolio-security-headers.conf
sudo cp /tmp/dream-team.works.conf  /etc/nginx/sites-available/dream-team.works.conf
sudo ln -s /etc/nginx/sites-available/dream-team.works.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

- If you run another web server (Caddy, Apache), point its document root at `/var/www/danizakaria.tech` and mirror the headers/caching from the nginx config.
- Cloudflare SSL/TLS mode: with the tunnel the origin is plain HTTP on localhost, so **Flexible** works. For end-to-end TLS, install a Cloudflare Origin Certificate and use **Full (strict)**.
- The tunnel route for the site hostname must point at nginx — see `server/cloudflared/ingress-example.yml`.

If the site still returns 521 afterwards:

```bash
# server
systemctl status cloudflared
cloudflared tunnel list
curl -sI -H 'Host: danizakaria.tech' http://127.0.0.1/   # nginx answering locally?
```

## 5. First deploy

Merge the workflow to `master`, then push (or run Actions → Deploy → Run workflow).

Verify:

- the Actions run is green and its rsync output lists the transferred files;
- on the server: `ls -la /var/www/danizakaria.tech`;
- `curl -sI https://danizakaria.tech` → 200.

## Day-to-day

- **Push to master → live in seconds.** The webroot mirrors `index.html css js images` only; repo docs/scripts never land there. Even doc-only pushes trigger a deploy — that's a cheap no-change rsync.
- **Manual deploy:** Actions → Deploy → Run workflow.
- **Rollback:** revert the bad commit on `master` and push (deploys always mirror master).
- **Rotate the SSH key:** generate a new pair, replace the line in `/home/deploy/.ssh/authorized_keys`, update `DEPLOY_SSH_KEY`.
- **Server rebuilt / new host key:** refresh `DEPLOY_KNOWN_HOSTS` with a new `ssh-keyscan`.
- The published set lives in the workflow; if you add asset directories, update both the workflow and the cache rules in `server/nginx/dream-team.works.conf`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Permission denied (publickey)` | key missing from `authorized_keys` or wrong user — test with `ssh -i deploy_key deploy@<ip> 'echo ok'` |
| `Host key verification failed` | `DEPLOY_KNOWN_HOSTS` is stale — re-run `ssh-keyscan` and update the secret |
| `rsync: command not found` | install rsync on the server (`sudo apt install rsync`) |
| Deploy green but site unchanged | confirm you pushed to `master`, and that nginx `root` is `/var/www/danizakaria.tech` |
| HTTP 521 after deploy | tunnel/nginx issue — see step 4 diagnostics |

## Security notes

- The SSH key is scoped to the `deploy` user only; revoke access by removing its `authorized_keys` line.
- GitHub-hosted runners use dynamic Azure IP ranges, so firewall allowlisting by IP isn't practical — rely on key-only auth (disable password authentication in sshd, optionally add fail2ban).
- Optionally scope the key further with `restrict,command="rrsync -wo /var/www/danizakaria.tech"` in `authorized_keys`; test a deploy afterwards (rrsync may reject the `--filter` option — drop it if so).
- The host key is pinned via `DEPLOY_KNOWN_HOSTS`, so there is no trust-on-first-use window.
