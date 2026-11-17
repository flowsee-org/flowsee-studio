#!/usr/bin/env bash
set -Eeuo pipefail
APP=/var/www/flowsee-studio
STATE=/var/lib/flowsee-studio-preview
[[ $EUID -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
NODE=$(command -v node)
[[ $NODE != /root/* ]] || { echo 'Studio needs a system Node 22+ executable accessible to its service user.' >&2; exit 1; }
"$NODE" -e 'if(Number(process.versions.node.split(".")[0])<22) throw Error("Studio requires Node 22+. Run the production deployment script.")'
cd "$APP"
DATA_DIR=$("$NODE" --env-file-if-exists=.env --input-type=module -e 'import {resolve} from "node:path"; console.log(resolve(process.env.STUDIO_DATA_DIR || ".local"))')
[[ $DATA_DIR == "$APP/.local" || $DATA_DIR == /var/lib/flowsee-studio || $DATA_DIR == "$STATE/.local" ]] || { echo 'Unrecognized data directory; refusing to change it.' >&2; exit 1; }
[[ -f "$DATA_DIR/db.json" && ! -L "$DATA_DIR" ]] || { echo 'Existing Studio database is required; refusing to create an empty replacement.' >&2; exit 1; }
# Read only the user count. Never print account records, hashes, tokens or environment values.
"$NODE" --input-type=module -e 'import {readFileSync} from "node:fs"; const db=JSON.parse(readFileSync(process.argv[1])); if(!Array.isArray(db.users)||db.users.length===0) throw Error("Existing Studio user directory is missing");' "$DATA_DIR/db.json"
install -d -m 700 "$STATE/backups"
BACKUP="$STATE/backups/api-$(date +%Y%m%d-%H%M%S)"
cp -a "$DATA_DIR" "$BACKUP"
id flowsee-studio >/dev/null 2>&1 || useradd --system --user-group --no-create-home --shell /usr/sbin/nologin flowsee-studio
chown -R --no-dereference flowsee-studio:flowsee-studio "$DATA_DIR"
chmod 700 "$DATA_DIR"
[[ ! -f "$APP/.env" ]] || chmod 600 "$APP/.env"
UNIT=/etc/systemd/system/flowsee-studio-api.service
[[ ! -f "$UNIT" ]] || cp -p "$UNIT" "$BACKUP.service"
cat > "$UNIT" <<EOF
[Unit]
Description=Flowsee Studio API
After=network.target
[Service]
Type=simple
User=flowsee-studio
Group=flowsee-studio
WorkingDirectory=$APP
EnvironmentFile=-$APP/.env
ExecStart=/usr/bin/env HOST=127.0.0.1 PORT=3000 STUDIO_DATA_DIR=$DATA_DIR $NODE $APP/backend/server.mjs
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now flowsee-studio-api.service
systemctl restart flowsee-studio-api.service
for attempt in $(seq 1 20); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/api/health | grep -q '"status":"ok"'; then
    echo 'Studio API is healthy; existing data was preserved.'
    exit 0
  fi
  sleep 1
done
echo 'Studio API did not become healthy. Check journalctl -u flowsee-studio-api.service.' >&2
exit 1
