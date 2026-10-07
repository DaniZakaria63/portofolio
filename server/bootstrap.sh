#!/usr/bin/env bash
#
# One-shot server setup for the dream-team.works portfolio.
#
# Installs nginx + rsync, creates the "deploy" user and webroot, installs the
# nginx vhost and security headers, and starts nginx. Idempotent: safe to re-run.
#
# Usage (on the server):
#   sudo bash /tmp/bootstrap.sh
#   sudo bash /tmp/bootstrap.sh --ci-pubkey 'ssh-ed25519 AAAA... github-actions-deploy'
#
# The script expects bootstrap.sh, security-headers.conf and dream-team.works.conf
# to sit next to each other (see server/README.md step 4).
set -euo pipefail

CI_PUBKEY=""
while [ $# -gt 0 ]; do
    case "$1" in
        --ci-pubkey)
            [ $# -ge 2 ] || { echo "--ci-pubkey needs a value" >&2; exit 1; }
            CI_PUBKEY="$2"
            shift 2
            ;;
        *)
            echo "usage: $0 [--ci-pubkey 'ssh-ed25519 ...']" >&2
            exit 1
            ;;
    esac
done

[ "$(id -u)" -eq 0 ] || { echo "run as root: sudo bash $0" >&2; exit 1; }

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
WEBROOT=/var/www/dream-team.works

echo "==> installing nginx and rsync"
if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq nginx rsync
elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx rsync
elif command -v yum >/dev/null 2>&1; then
    yum install -y nginx rsync
else
    echo "no supported package manager (apt/dnf/yum) found" >&2
    exit 1
fi

echo "==> creating deploy user and webroot"
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
install -d -o deploy -g deploy -m 755 "$WEBROOT"

if [ -n "$CI_PUBKEY" ]; then
    echo "==> installing CI public key for the deploy user"
    install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
    touch /home/deploy/.ssh/authorized_keys
    grep -qF "$CI_PUBKEY" /home/deploy/.ssh/authorized_keys \
        || printf '%s\n' "$CI_PUBKEY" >> /home/deploy/.ssh/authorized_keys
    chown deploy:deploy /home/deploy/.ssh/authorized_keys
    chmod 600 /home/deploy/.ssh/authorized_keys
fi

echo "==> installing nginx configs"
[ -f "$SRC_DIR/security-headers.conf" ] \
    || { echo "security-headers.conf not found in $SRC_DIR - copy it next to this script" >&2; exit 1; }
[ -f "$SRC_DIR/dream-team.works.conf" ] \
    || { echo "dream-team.works.conf not found in $SRC_DIR - copy it next to this script" >&2; exit 1; }

install -d /etc/nginx/snippets
install -m 644 "$SRC_DIR/security-headers.conf" /etc/nginx/snippets/portfolio-security-headers.conf

if [ -d /etc/nginx/sites-available ]; then
    # Debian/Ubuntu layout
    install -d /etc/nginx/sites-enabled
    install -m 644 "$SRC_DIR/dream-team.works.conf" /etc/nginx/sites-available/dream-team.works.conf
    ln -sf ../sites-available/dream-team.works.conf /etc/nginx/sites-enabled/dream-team.works.conf
    rm -f /etc/nginx/sites-enabled/default
else
    # RHEL/Fedora layout
    install -m 644 "$SRC_DIR/dream-team.works.conf" /etc/nginx/conf.d/dream-team.works.conf
fi

if [ ! -f "$WEBROOT/index.html" ]; then
    echo "==> writing placeholder index.html (replaced by the first deploy)"
    cat > "$WEBROOT/index.html" <<'EOF'
<!doctype html>
<meta charset="utf-8">
<title>dream-team.works</title>
<body style="margin:0;background:#11172a;color:#dfe5ec;font:13px ui-monospace,monospace;display:grid;place-content:center;height:100vh">
  deployment in progress - the first CI deploy will replace this page
</body>
EOF
    chown deploy:deploy "$WEBROOT/index.html"
fi

if command -v restorecon >/dev/null 2>&1; then
    # SELinux systems need the httpd content label on the webroot
    restorecon -R "$WEBROOT" >/dev/null 2>&1 || true
fi

echo "==> checking and starting nginx"
nginx -t
if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now nginx
    systemctl reload nginx
else
    service nginx restart
fi

echo
echo "nginx is now serving $WEBROOT on port 80."
echo "Local check:   curl -sI http://127.0.0.1"
echo
echo "Next steps:"
echo "  1. Make sure the Cloudflare Tunnel routes dream-team.works to nginx."
echo "     Add to the tunnel config (see server/cloudflared/ingress-example.yml):"
echo "         - hostname: dream-team.works"
echo "           service: http://127.0.0.1:80"
echo "     then: sudo systemctl restart cloudflared"
echo "  2. If Cloudflare reaches this server directly (no tunnel), open port 80:"
echo "         sudo ufw allow 80/tcp"
echo "  3. CI: install the deploy key (--ci-pubkey or server/README.md step 1b),"
echo "     set the GitHub secrets, and merge the deploy workflow to master."
echo "     Full runbook: server/README.md"
