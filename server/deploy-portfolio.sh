#!/usr/bin/env bash
#
# Pull the latest master of this repository and publish the static site.
# Invoked by deploy-webhook.py (systemd unit deploy-webhook.service) and safe
# to run by hand for debugging:
#
#   sudo -u deploy bash /srv/portofolio/server/deploy-portfolio.sh
#
# This checkout is managed by the deploy service: never edit files in it.
# If you add a new top-level asset directory, add it to the cp line below and
# mirror the change in server/nginx/dream-team.works.conf.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/portofolio}"
WEBROOT="${WEBROOT:-/var/www/dream-team.works}"
BRANCH="${BRANCH:-master}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# One deploy at a time; the lock lives in .git/ so checkout/clean never touches it.
exec 9>"$REPO_DIR/.git/deploy.lock"
if ! flock -n 9; then
    log "another deploy is already running - aborting"
    exit 1
fi

cd "$REPO_DIR"

log "fetching origin/$BRANCH"
git fetch --prune origin "$BRANCH"
git checkout --force -B "$BRANCH" "origin/$BRANCH"
git clean -fd
log "checkout now at $(git rev-parse --short HEAD) ($(git log -1 --pretty=%s))"

# Stage exactly what the site needs, then mirror it into the webroot.
# Everything else in the repo (scripts/, server/, docs, ...) stays out of the webroot.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -a index.html css js images "$STAGE"/

mkdir -p "$WEBROOT"
log "syncing to $WEBROOT"
# -c: compare checksums, not just size+mtime. rsync's quick check has
# one-second mtime granularity, so two deploys landing in the same second
# (or same-size edits) would otherwise be silently skipped.
rsync -ac --delete \
    --filter='P .well-known/***' \
    "$STAGE"/ "$WEBROOT"/

log "done: deployed $(git rev-parse --short HEAD)"
