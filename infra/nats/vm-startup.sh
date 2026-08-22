#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Private NATS VM Bootstrap v1.0.0                       ║
# ║  Installs a digest-pinned NATS Core server and resolves TLS     ║
# ║  plus authentication material from GCP Secret Manager.         ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
# ╚══════════════════════════════════════════════════════════════════╝

set -Eeuo pipefail
umask 077

readonly PROJECT_ID="heady-ai"
readonly BOOTSTRAP_BUCKET="heady-ai-nats-bootstrap-us-east1"
readonly BOOTSTRAP_OBJECT="nats-server-v2.14.3-amd64.deb"
readonly BOOTSTRAP_SHA256="e0c053fc2abe991f17b2be794897bb3f94ca1857bf886498c741ba69fb62522a"
readonly METADATA_ROOT="http://metadata.google.internal/computeMetadata/v1"
readonly NATS_CONFIG_DIR="/etc/nats"
readonly NATS_SECRET_DIR="/var/lib/heady-nats/secrets"
readonly NATS_PACKAGE="/var/tmp/${BOOTSTRAP_OBJECT}"
readonly NATS_PORT="4222"

metadata_token() {
  curl --fail --silent --show-error \
    --header "Metadata-Flavor: Google" \
    "${METADATA_ROOT}/instance/service-accounts/default/token" \
    | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
}

download_bootstrap_object() {
  local access_token
  access_token="$(metadata_token)"
  curl --fail --silent --show-error \
    --header "Authorization: Bearer ${access_token}" \
    "https://storage.googleapis.com/download/storage/v1/b/${BOOTSTRAP_BUCKET}/o/${BOOTSTRAP_OBJECT}?alt=media" \
    --output "${NATS_PACKAGE}"
  printf '%s  %s\n' "${BOOTSTRAP_SHA256}" "${NATS_PACKAGE}" | sha256sum --check --status
}

fetch_secret() {
  local secret_name="$1"
  local destination="$2"
  local access_token
  access_token="$(metadata_token)"
  curl --fail --silent --show-error \
    --header "Authorization: Bearer ${access_token}" \
    "https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secret_name}/versions/latest:access" \
    | /usr/bin/python3 -c 'import base64,json,sys; sys.stdout.buffer.write(base64.b64decode(json.load(sys.stdin)["payload"]["data"]))' \
    > "${destination}"
}

download_bootstrap_object
dpkg --install "${NATS_PACKAGE}"

if ! id --user nats >/dev/null 2>&1; then
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin nats
fi

install --directory --mode 0750 --owner root --group nats "${NATS_CONFIG_DIR}" "${NATS_SECRET_DIR}"
fetch_secret "NATS_TOKEN" "${NATS_SECRET_DIR}/token"
fetch_secret "NATS_TLS_SERVER_CERT" "${NATS_SECRET_DIR}/server-cert.pem"
fetch_secret "NATS_TLS_SERVER_KEY" "${NATS_SECRET_DIR}/server-key.pem"
chown root:nats "${NATS_SECRET_DIR}"/*
chmod 0440 "${NATS_SECRET_DIR}"/*

{
  printf 'server_name: "heady-event-bus"\n'
  printf 'host: "0.0.0.0"\n'
  printf 'port: %s\n' "${NATS_PORT}"
  printf 'authorization {\n'
  printf '  token: "%s"\n' "$(<"${NATS_SECRET_DIR}/token")"
  printf '  timeout: 2.618\n'
  printf '}\n'
  printf 'tls {\n'
  printf '  cert_file: "%s/server-cert.pem"\n' "${NATS_SECRET_DIR}"
  printf '  key_file: "%s/server-key.pem"\n' "${NATS_SECRET_DIR}"
  printf '  timeout: 1.618\n'
  printf '}\n'
} > "${NATS_CONFIG_DIR}/heady.conf"
chown root:nats "${NATS_CONFIG_DIR}/heady.conf"
chmod 0440 "${NATS_CONFIG_DIR}/heady.conf"

{
  printf '[Unit]\n'
  printf 'Description=Heady Private NATS Core\n'
  printf 'After=network-online.target\n'
  printf 'Wants=network-online.target\n\n'
  printf '[Service]\n'
  printf 'Type=simple\n'
  printf 'User=nats\n'
  printf 'Group=nats\n'
  printf 'ExecStartPre=/usr/bin/nats-server -t --config %s/heady.conf\n' "${NATS_CONFIG_DIR}"
  printf 'ExecStart=/usr/bin/nats-server --config %s/heady.conf\n' "${NATS_CONFIG_DIR}"
  printf 'ExecReload=/bin/kill -HUP $MAINPID\n'
  printf 'Restart=on-failure\n'
  printf 'RestartSec=1618ms\n'
  printf 'NoNewPrivileges=true\n'
  printf 'PrivateTmp=true\n'
  printf 'ProtectSystem=strict\n'
  printf 'ProtectHome=true\n'
  printf 'ProtectKernelTunables=true\n'
  printf 'ProtectKernelModules=true\n'
  printf 'ProtectControlGroups=true\n'
  printf 'RestrictSUIDSGID=true\n'
  printf 'LockPersonality=true\n'
  printf 'MemoryDenyWriteExecute=true\n'
  printf 'SystemCallArchitectures=native\n\n'
  printf '[Install]\n'
  printf 'WantedBy=multi-user.target\n'
} > /etc/systemd/system/heady-nats.service
chmod 0644 /etc/systemd/system/heady-nats.service

systemctl daemon-reload
systemctl enable heady-nats.service
systemctl restart heady-nats.service
systemctl is-active --quiet heady-nats.service

for NATS_UNUSED_UNIT in ssh.service exim4.service; do
  if systemctl list-unit-files "${NATS_UNUSED_UNIT}" --no-legend 2>/dev/null | grep --quiet "${NATS_UNUSED_UNIT}"; then
    systemctl disable --now "${NATS_UNUSED_UNIT}"
  fi
done

logger --tag heady-nats '{"level":"info","service":"heady-event-bus","status":"ready","transport":"tls","durability":"best-effort"}'
