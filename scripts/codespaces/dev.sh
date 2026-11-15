#!/usr/bin/env bash
# Start the actual application with private, persistent development services.
set -euo pipefail
umask 077
cd "$(git rev-parse --show-toplevel)"
: "${CODESPACE_NAME:?Run this command inside the GitHub Codespace}"
if [[ "${CODESPACES:-}" != true ]]; then echo "A GitHub Codespace is required." >&2; exit 1; fi
port=${1:-4189}
if [[ ! "$port" =~ ^[0-9]{4,5}$ ]] || (( port < 1024 || port > 65535 )); then echo "Invalid port" >&2; exit 1; fi
if [[ "$(node -p 'process.versions.node.split(".")[0]')" != 22 ]]; then
  export NVM_DIR="${NVM_DIR:-/usr/local/share/nvm}"
  . "$NVM_DIR/nvm.sh" --no-use
  nvm use 22
fi
state="$HOME/.local/share/prescore-codespace-dev"
mkdir -p "$state/storage" "$state/tls"
chmod 700 "$state" "$state/storage" "$state/tls"
if [[ ! -s "$state/db-password" ]]; then openssl rand -hex 32 > "$state/db-password"; fi
if [[ ! -s "$state/auth-secret" ]]; then openssl rand -hex 48 > "$state/auth-secret"; fi
if [[ ! -s "$state/tls/cert.pem" ]]; then
  openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 -subj '/CN=Prescore local development SMTP' \
    -addext 'subjectAltName=IP:127.0.0.1,DNS:localhost' -keyout "$state/tls/key.pem" -out "$state/tls/cert.pem" 2>/dev/null
fi
pg=prescore-codespace-dev-db
mail=prescore-codespace-dev-mail
# Every database command below uses this container or its loopback-only published port.
if ! docker container inspect "$pg" >/dev/null 2>&1; then
  POSTGRES_PASSWORD="$(cat "$state/db-password")" docker run -d --name "$pg" \
    -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD -e POSTGRES_DB=prescore_codespace_dev \
    -e POSTGRES_USER=prescore_dev -v prescore-codespace-dev-pgdata:/var/lib/postgresql/data postgres:16 >/dev/null
else
  docker start "$pg" >/dev/null
fi
if ! docker container inspect "$mail" >/dev/null 2>&1; then
  docker run -d --name "$mail" --user "$(id -u):$(id -g)" -p 127.0.0.1:11025:1025 -p 127.0.0.1:18025:8025 \
    -v "$state/tls:/tls:ro" -e MP_SMTP_TLS_CERT=/tls/cert.pem -e MP_SMTP_TLS_KEY=/tls/key.pem \
    -e MP_SMTP_REQUIRE_STARTTLS=true axllent/mailpit:v1.27 >/dev/null
else
  docker start "$mail" >/dev/null
fi
for try in {1..60}; do
  if docker exec "$pg" pg_isready -q -d prescore_codespace_dev -U prescore_dev; then break; fi
  sleep 1
done
# Checko is inherited only from the Codespaces environment.
export DATABASE_URL="postgresql://prescore_dev:$(cat "$state/db-password")@127.0.0.1:55432/prescore_codespace_dev"
export AUTH_SECRET="$(cat "$state/auth-secret")"
export PRESCORE_STORAGE_ROOT="$state/storage" PRESCORE_RUNTIME_MODE=development NODE_ENV=development
export PRESCORE_BASE_URL="https://$CODESPACE_NAME-$port.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
export SMTP_HOST=127.0.0.1 SMTP_PORT=11025 SMTP_SECURE=false SMTP_FROM=prescore@development.invalid
export NODE_EXTRA_CA_CERTS="$state/tls/cert.pem"
unset SMTP_USER SMTP_PASSWORD
export BILLING_PROVIDER=DISABLED BILLING_SETTLEMENT_PROVIDER=DISABLED BILLING_LIVE_ENABLED=false AI_PROVIDER=local
export NEXT_TELEMETRY_DISABLED=1
npm run db:migrate
npm run db:verify
exec npm run dev -- --port "$port"
