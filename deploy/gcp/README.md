# GCP VM (cheap multi-service edge)

Defaults target project `gcp-decode-uniwa-20250918` (your active `gcloud` config), VM name `prostructure-http`, zone `europe-west1-b`, machine `e2-medium` (upgrade/downgrade via `MACHINE_TYPE`).

## One-time

1. **Provision** (installs Docker on boot):

   ```bash
   ./deploy/gcp/provision-vm.sh
   ```

2. After ~60 seconds, **deploy the current stack** (Python app + Caddy on port 80):

   ```bash
   ./deploy/gcp/deploy-to-vm.sh
   ```

3. Open `http://EXTERNAL_IP/` (printed by the scripts).

GCP’s default VPC rules **`http-server`** / **`https-server`** open **80** / **443** when those network tags are set (the provision script adds them).

## Cheaper VM

```bash
MACHINE_TYPE=e2-small PREEMPTIBLE=1 ./deploy/gcp/provision-vm.sh
```

Preemptible VMs are much cheaper but can stop with short notice.

## Adding Node (or anything else)

1. Uncomment the `nodeapp` service in `deploy/docker-compose.yml` and add your app under e.g. `deploy/apps/node-demo/`.
2. Edit `deploy/Caddyfile`: add `handle_path` routes to `reverse_proxy` the new service.
3. Run `./deploy/gcp/deploy-to-vm.sh` again.

## HTTPS later

Reserve a DNS name pointing at the VM IP, uncomment `443:443` in `deploy/docker-compose.yml`, and switch the top of the Caddyfile to a `{domain}` site block (Caddy will obtain certificates automatically).
