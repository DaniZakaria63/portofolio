#!/usr/bin/env python3
"""Tiny authenticated deploy webhook.

Listens on 127.0.0.1 (configurable port) and runs the deploy script when it
receives ``POST /deploy`` with the correct bearer token. It is meant to be
reached only through the Cloudflare Tunnel, never exposed directly.

Configuration comes from environment variables (see deploy-webhook.env.example):
  DEPLOY_TOKEN     shared secret; GitHub Actions sends it as "Authorization: Bearer ..."
  DEPLOY_SCRIPT    path to the deploy script to run
  PORT             listen port (default 8090)
  DEPLOY_TIMEOUT   max seconds a deploy may run (default 300)
"""

import hmac
import json
import logging
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get("DEPLOY_TOKEN", "")
SCRIPT = os.environ.get("DEPLOY_SCRIPT", "/srv/portofolio/server/deploy-portfolio.sh")
PORT = int(os.environ.get("PORT", "8090"))
TIMEOUT = int(os.environ.get("DEPLOY_TIMEOUT", "300"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("deploy-webhook")


class Handler(BaseHTTPRequestHandler):
    server_version = "deploy-webhook/1.0"

    def log_message(self, fmt, *args):
        log.info("%s %s", self.address_string(), fmt % args)

    def _reply(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _discard_body(self):
        """Read and drop the request body so keep-alive connections stay in sync."""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length > 0:
            self.rfile.read(length)

    def do_GET(self):
        if self.path.rstrip("/") in ("", "/healthz"):
            return self._reply(200, {"ok": True})
        return self._reply(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        self._discard_body()
        if self.path.rstrip("/") != "/deploy":
            return self._reply(404, {"ok": False, "error": "not found"})

        expected = "Bearer " + TOKEN
        supplied = self.headers.get("Authorization", "")
        if not TOKEN or not hmac.compare_digest(supplied.encode(), expected.encode()):
            log.warning("rejected unauthorized deploy request from %s", self.address_string())
            return self._reply(401, {"ok": False, "error": "unauthorized"})

        log.info("deploy triggered")
        try:
            result = subprocess.run(
                ["/bin/bash", SCRIPT],
                capture_output=True,
                text=True,
                timeout=TIMEOUT,
            )
        except subprocess.TimeoutExpired:
            log.error("deploy timed out after %ss", TIMEOUT)
            return self._reply(504, {"ok": False, "error": "deploy timed out"})

        output = (result.stdout + result.stderr).strip().splitlines()
        tail = "\n".join(output[-40:])
        if result.returncode != 0:
            log.error("deploy failed rc=%s\n%s", result.returncode, tail)
            return self._reply(500, {"ok": False, "rc": result.returncode, "output": tail})

        log.info("deploy finished ok\n%s", tail)
        return self._reply(200, {"ok": True, "output": tail})


if __name__ == "__main__":
    if not TOKEN:
        log.error("DEPLOY_TOKEN is not set - all deploy requests will be rejected")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    log.info("deploy webhook listening on 127.0.0.1:%s", PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
