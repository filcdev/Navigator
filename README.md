# Petrik Navigator

Tauri v2 + React 19 + TypeScript kiosk app. Runs fullscreen on a kiosk (cage/Wayland), talks to a NestJS backend, and self-updates from GitHub releases.

## Development

```bash
bun install
bun dev          # Vite dev server on http://localhost:1420
bun tauri dev    # run inside the Tauri window
```

The backend URL is resolved at runtime (see [Runtime backend config](#runtime-backend-config)); for local dev it falls back to `http://localhost:8001`.

## Build

### Manual

```bash
# 1. bake in the backend URL (optional; falls back to http://localhost:8001)
echo "VITE_API_BASE_URL=http://10.0.1.127:8001" > .env

# 2. frontend build
bun run build

# 3. full Tauri build + installer + updater signatures
export TAURI_SIGNING_PRIVATE_KEY="$(cat signing.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<key password>"
bunx tauri build
```

Output (Linux): `src-tauri/target/release/bundle/deb/Petrik Navigator_<version>_amd64.deb`, plus `.rpm` and `.sig` files. AppImage may fail locally (needs `linuxdeploy`/FUSE) — the `.deb`/`.rpm` are what get deployed.

Verify compilation only (no bundling/signing):

```bash
bunx tauri build --no-bundle
```

## Release (GitHub Actions)

The `.github/workflows/prod-build.yml` workflow builds on every push to `main`/`tauri` and publishes a **release** when a `v*` tag is pushed.

```bash
./version-bump.sh patch   # or: major | minor
```

This bumps the version in `src-tauri/tauri.conf.json`, commits, tags `vX.Y.Z`, and pushes — triggering the release build (Windows + Linux). Manual equivalent:

```bash
git tag v1.0.1 && git push origin v1.0.1
```

Required repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `VITE_API_BASE_URL` | backend URL baked into the build |
| `TAURI_SIGNING_PRIVATE_KEY` | contents of `signing.key` (`cat signing.key`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | the key's password |

The release uploads the installers + `latest.json`, which the in-app updater polls.

## Kiosk deployment

Three stages: base OS (Ventoy) → backend → provision (Ansible).

### 1. Base OS via Ventoy USB

1. [Install Ventoy](https://www.ventoy.net) on a USB stick.
2. Copy the Debian net-install ISO to the USB root, named `debian-netinst.iso`.
3. Copy `ansible/ventoy/` onto the USB so it becomes `/ventoy/` (i.e. `/ventoy/ventoy.json` + `/ventoy/script/preseed.cfg`).
4. Boot the kiosk from the USB. Debian installs unattended and creates the `ansible` user with the SSH key + passwordless sudo + curl/python.

> Tweak `ansible/ventoy/script/preseed.cfg` for hostname, locale/timezone, and a static IP if you don't use DHCP. The temporary `ChangeMeNow` password is a placeholder.

### 2. Backend

Run the backend in Docker (from the `navigator-main` repo) — it listens on port `8001`:

```bash
docker compose up -d --build
```

Then set the backend URL in `ansible/vars.yml`:

```yaml
backend_url: "http://10.0.1.127:8001"
backend_trust_ssl: true    # false => self-signed, installs backend_ca_cert
```

### 3. Provision with Ansible

Edit `ansible/inventory.ini` to list your kiosk hosts, then:

```bash
cd ansible
ansible-playbook -i inventory.ini site.yml
```

This installs the latest `.deb` from GitHub releases, creates the `kiosk` user, sets up `cage` fullscreen autologin, writes the runtime backend config, and makes the root filesystem read-only (safe for hard power-off).

Override per-run with `--extra-vars`, e.g.:

```bash
ansible-playbook -i inventory.ini site.yml \
  --extra-vars "backend_url='https://api.example.com' backend_trust_ssl=false"
```

### Result

The kiosk boots straight into the fullscreen app on TTY1. New versions are picked up automatically via the updater (or re-run the playbook to reinstall).

## Runtime backend config

The app reads `/etc/navigator/backend.json` (written by Ansible) at startup via the `get_backend_config` Tauri command, and points axios at `backend_url`. `trust_ssl` controls whether a self-signed CA (`backend_ca_cert`) is installed into the system trust store.
