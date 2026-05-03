#!/usr/bin/env bash
# Create an Ubuntu VM with Docker installed (cheap default: e2-medium in EU).
#
# Env overrides: GCP_PROJECT, GCP_ZONE, GCP_INSTANCE, MACHINE_TYPE, PREEMPTIBLE=1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${GCP_PROJECT:-$(gcloud config get-value project)}"
ZONE="${GCP_ZONE:-europe-west1-b}"
INSTANCE="${GCP_INSTANCE:-prostructure-http}"
MTYPE="${MACHINE_TYPE:-e2-medium}"

if [[ "${PREEMPTIBLE:-}" == "1" ]]; then
  echo "Using preemptible VM (may restart; cheapest)."
fi

if gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --project="$PROJECT" &>/dev/null; then
  echo "VM ${INSTANCE} already exists in ${ZONE} — skipping create."
else
  _create_vm() {
    gcloud compute instances create "$INSTANCE" \
      --project="$PROJECT" \
      --zone="$ZONE" \
      --machine-type="$MTYPE" \
      --boot-disk-size=30GB \
      --boot-disk-type=pd-balanced \
      --image-family=ubuntu-2204-lts \
      --image-project=ubuntu-os-cloud \
      --tags=http-server,https-server \
      --metadata-from-file=startup-script="${SCRIPT_DIR}/startup.sh" \
      "$@"
  }
  if [[ "${PREEMPTIBLE:-}" == "1" ]]; then
    _create_vm --preemptible
  else
    _create_vm
  fi
fi

IP="$(gcloud compute instances describe "$INSTANCE" \
  --zone="$ZONE" \
  --project="$PROJECT" \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"

echo ""
echo "VM: ${INSTANCE}  zone: ${ZONE}  external IP: ${IP}"
echo "Wait ~60s for Docker install, then from repo root:"
echo "  ./deploy/gcp/deploy-to-vm.sh"
echo "Open: http://${IP}/"
