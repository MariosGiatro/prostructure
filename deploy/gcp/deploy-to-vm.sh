#!/usr/bin/env bash
# Pack the app (Dockerfile + assets + compose) and deploy to the GCE VM.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT="${GCP_PROJECT:-$(gcloud config get-value project)}"
ZONE="${GCP_ZONE:-europe-west1-b}"
INSTANCE="${GCP_INSTANCE:-prostructure-http}"

echo "Waiting for SSH on ${INSTANCE}..."
ssh_ok=""
for _ in $(seq 1 60); do
  if gcloud compute ssh "$INSTANCE" --project="$PROJECT" --zone="$ZONE" --command=true >/dev/null 2>&1; then
    ssh_ok=1
    break
  fi
  sleep 5
done
if [[ -z "${ssh_ok}" ]]; then
  echo "ERROR: SSH never became ready."
  exit 1
fi

echo "Waiting for Docker..."
docker_ok=""
for _ in $(seq 1 60); do
  if gcloud compute ssh "$INSTANCE" --project="$PROJECT" --zone="$ZONE" \
    --command="sudo docker compose version >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1"; then
    docker_ok=1
    break
  fi
  sleep 5
done
if [[ -z "${docker_ok}" ]]; then
  echo "ERROR: Docker is not ready yet; wait and re-run ./deploy/gcp/deploy-to-vm.sh"
  exit 1
fi

TMP="$(mktemp)"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

(
  cd "$REPO_ROOT"
  COPYFILE_DISABLE=1 tar czf "$TMP" \
    Dockerfile pyproject.toml uv.lock \
    server.py index.html style.css app.js \
    media \
    deploy/Caddyfile deploy/docker-compose.yml
)

echo "Cleaning up old bundle on VM..."
gcloud compute ssh "$INSTANCE" \
  --project="$PROJECT" --zone="$ZONE" \
  --command="sudo rm -f /tmp/bundle.tgz" || true

echo "Uploading bundle to ${INSTANCE} (${ZONE})..."
gcloud compute scp "$TMP" "${INSTANCE}:/tmp/bundle.tgz" \
  --project="$PROJECT" --zone="$ZONE"

echo "Building and starting stack..."
gcloud compute ssh "$INSTANCE" \
  --project="$PROJECT" \
  --zone="$ZONE" \
  --command="sudo bash -lc 'set -euo pipefail
mkdir -p /srv/prostructure
tar xzf /tmp/bundle.tgz -C /srv/prostructure
cd /srv/prostructure/deploy
docker compose build --pull
docker compose up -d'"

IP="$(gcloud compute instances describe "$INSTANCE" \
  --zone="$ZONE" \
  --project="$PROJECT" \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"

echo ""
echo "Live at http://${IP}/"
