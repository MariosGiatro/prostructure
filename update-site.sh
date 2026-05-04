#!/usr/bin/env bash
# ProStructure Auto-Update Script
# This script pulls the latest code from GitHub and deploys it to the GCP VM.

set -e

# 1. Navigate to the repo root (assuming the script is in the root)
# If the script is run from elsewhere, we find its location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "------------------------------------------"
echo "🚀 Starting ProStructure Site Update"
echo "------------------------------------------"

# 2. Pull latest changes from GitHub
echo "📥 Pulling latest version from GitHub..."
git pull origin main

# 3. Ensure deployment scripts are executable
echo "🔑 Setting permissions..."
chmod +x deploy/gcp/*.sh

# 4. Run the deployment
echo "🚢 Deploying to GCP VM..."
./deploy/gcp/deploy-to-vm.sh

echo "------------------------------------------"
echo "✅ Update Complete!"
echo "------------------------------------------"
