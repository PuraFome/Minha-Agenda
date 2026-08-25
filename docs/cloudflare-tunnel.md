# Cloudflare Tunnel Setup Runbook — Minha Agenda Backend

This runbook explains how to expose the local NestJS backend (`server/`, port
`3000`) through a **stable HTTPS URL** (`https://api.<yourdomain>`) that is
reachable from your phone and from the deployed Angular frontend.

It uses a **named Cloudflare Tunnel** with a **custom domain** (stable URL,
required for phone access). A **quick tunnel** is also documented for fast
dev-only smoke tests (random URL per restart — not stable).

> All domain references below use the placeholder `<yourdomain>`. Replace it
> with the domain you actually buy (e.g. `minha-agenda.com`). Do **not** commit
> a real domain into source files — `environment.ts` already ships the
> placeholder `https://api.yourdomain.com` and you only edit your local
> `server/.env` (gitignored).

---

## 0. Prerequisites

- A machine running the backend (`npm run start:dev` in `server/`, listening on
  `http://localhost:3000`).
- `cloudflared` installed (see step 3).
- A Cloudflare account (free tier is enough).
- About ~$10/year for a domain (step 1).

The backend already uses the global prefix `api`, so routes look like:

- `GET  /api/auth/google`   — start Google OAuth
- `GET  /api/auth/callback` — OAuth callback (used in redirect URIs below)
- `POST /api/auth/logout`
- `DELETE /api/auth/account`
- `GET  /api/me`
- `GET|PUT /api/data/:collection`

---

## 1. Buy a domain (~$10/yr)

Pick any registrar. Cheap, privacy-friendly options:

- **Cloudflare Registrar** (often at-cost, free WHOIS privacy)
- **Porkbun**, **Namecheap**, **Google Domains successor**

Example: buy `minha-agenda.com`. You do **not** need hosting — only the domain
and its DNS.

---

## 2. Add the domain to Cloudflare (free)

1. Log in to <https://dash.cloudflare.com> → **Add a Site**.
2. Enter your domain (e.g. `minha-agenda.com`).
3. Choose the **Free** plan.
4. Cloudflare shows the DNS records it imported. Leave them.
5. Cloudflare displays two **nameservers** (e.g. `natalia.ns.cloudflare.com`,
   `rick.ns.cloudflare.com`).
6. At your registrar, replace the domain's nameservers with Cloudflare's two
   nameservers.
7. Wait for the NS change to propagate (minutes to 24h; usually fast). Cloudflare
   emails you when the site is **Active**.

---

## 3. Install `cloudflared`

**Linux (Debian/Ubuntu/WSL):**

```bash
# Download the latest stable binary
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

**macOS:**

```bash
brew install cloudflared
```

**Windows:**

```powershell
winget install --id Cloudflare.cloudflared
```

(Other platforms: see <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>)

---

## 4. Authenticate `cloudflared`

This opens a browser and links the CLI to your Cloudflare account:

```bash
cloudflared login
```

A browser tab appears — pick the domain you added in step 2 and **Authorize**.
This writes a cert to `~/.cloudflared/cert.pem`.

---

## 5. Create the named tunnel

```bash
cloudflared tunnel create minha-agenda
```

Output includes a **Tunnel ID** (a UUID) and a credentials file at
`~/.cloudflared/<tunnel-id>.json`. Save the Tunnel ID — you need it for the
config file in step 7.

---

## 6. Route a DNS name to the tunnel

Point `api.<yourdomain>` at the tunnel (creates a CNAME automatically):

```bash
cloudflared tunnel route dns minha-agenda api.<yourdomain>
```

Example with a real domain:

```bash
cloudflared tunnel route dns minha-agenda api.minha-agenda.com
```

Verify in the Cloudflare dashboard → **DNS** that an `api` CNAME now exists
pointing to `<tunnel-id>.cfargotunnel.com`.

---

## 7. Configure the tunnel ingress

Create `~/.cloudflared/config.yml` so the tunnel knows where to send traffic.
Replace `<tunnel-id>` with the UUID from step 5 and `<yourdomain>` with your
domain:

```yaml
tunnel: <tunnel-id>
credentials-file: /home/<user>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.<yourdomain>
    service: http://localhost:3000
  - service: http_status:404
```

> The `hostname` line restricts the tunnel to `api.<yourdomain>`; everything
> else returns 404. The backend listens on `localhost:3000` (set `API_PORT` in
> `server/.env` if you changed it).

---

## 8. Run the tunnel

```bash
cloudflared tunnel run minha-agenda
```

You should see logs ending with `Connected to ...` and no errors. Leave this
process running (use a second terminal, `tmux`, or a systemd service for
persistence — see step 11).

Test from your phone (on cellular, not the same Wi-Fi) or another network:

```bash
curl https://api.<yourdomain>/api/me
# Expected: 401 (no session cookie) — proves the tunnel + HTTPS works.
```

---

## 9. Set `API_PUBLIC_URL`

The backend uses `API_PUBLIC_URL` for OAuth `redirect_uri`, CORS, and links.

### 9a. Backend (`server/.env`, gitignored — you fill it)

Copy the template if you haven't:

```bash
cp server/.env.example server/.env
```

Then edit `server/.env` and set:

```bash
API_PUBLIC_URL=https://api.<yourdomain>
```

(`server/.env.example` already documents `API_PUBLIC_URL=` with a comment — do
not commit `server/.env`.)

### 9b. Frontend (`src/environments/environment.ts`)

The production environment file already ships the placeholder:

```ts
export const environment = {
  production: true,
  apiUrl: 'https://api.yourdomain.com',
};
```

Replace `https://api.yourdomain.com` with your real tunnel URL, e.g.
`https://api.minha-agenda.com`. **Use your real domain here only in your local
working copy** — the committed placeholder stays generic so no real domain is
hardcoded into the repo. The dev file `environment.development.ts` keeps
`http://localhost:3000` and is used by `npm start`.

---

## 10. Register the Google OAuth redirect URIs

In **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client
ID (type: Web application)**, add these **Authorized redirect URIs**:

```
https://api.<yourdomain>/api/auth/callback
http://localhost:3000/api/auth/callback
```

- The first is the **production / phone** callback (the tunnel URL). This is
  `${API_PUBLIC_URL}/api/auth/callback`.
- The second is the **local dev** callback (used when `API_PUBLIC_URL` is unset
  / `http://localhost:3000`).

The backend builds the redirect URI as `${API_PUBLIC_URL}/api/auth/callback`
(see `server/src/auth/auth.controller.ts`), so the production URI above must
match exactly.

Also ensure `FRONTEND_ORIGIN` in `server/.env` is set to your frontend origin
(e.g. `https://<user>.github.io`) so CORS allows the browser.

---

## 11. (Optional) Run the tunnel as a service

To keep the tunnel up across reboots, run it as a systemd service (Linux) or a
background process.

**systemd example** (`/etc/systemd/system/cloudflared-minha-agenda.service`):

```ini
[Unit]
Description=Cloudflare Tunnel - minha-agenda
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel run minha-agenda
Restart=on-failure
RestartSec=5
User=<user>

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now cloudflared-minha-agenda
sudo systemctl status cloudflared-minha-agenda
```

---

## 12. Quick tunnel — dev-only smoke test

For a fast, no-setup check (e.g. testing the phone before you buy a domain),
use a **quick tunnel**. It gives a **random** `*.trycloudflare.com` URL that
changes every time you restart it — **not stable**, so it is dev-only:

```bash
cloudflared tunnel --url http://localhost:3000
```

Output includes a line like:

```
https://<random>.trycloudflare.com
```

Use that URL as `API_PUBLIC_URL` temporarily (and as the Google redirect URI)
to smoke-test the phone. Because the URL rotates on every restart, **do not**
rely on it for the deployed frontend — use the named tunnel + custom domain
(steps 1–10) for stable phone access.

---

## Summary checklist

- [ ] Domain bought (~$10/yr) and added to Cloudflare (free).
- [ ] `cloudflared` installed; `cloudflared login` done.
- [ ] `cloudflared tunnel create minha-agenda` (saved Tunnel ID).
- [ ] `cloudflared tunnel route dns minha-agenda api.<yourdomain>` done.
- [ ] `~/.cloudflared/config.yml` ingress → `http://localhost:3000`.
- [ ] `cloudflared tunnel run minha-agenda` connected; `curl /api/me` → 401.
- [ ] `API_PUBLIC_URL=https://api.<yourdomain>` in `server/.env`.
- [ ] `apiUrl` in `environment.ts` updated to the real tunnel URL (local copy).
- [ ] Google OAuth redirect URIs registered (production + localhost).
- [ ] (Optional) systemd service for persistence.

No application source code is changed by this runbook — only `server/.env`
(gitignored) and your local `environment.ts` working copy.
