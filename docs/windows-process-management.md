# Windows Process Management Runbook — Minha Agenda API + Cloudflare Tunnel

**Goal:** Run the NestJS backend (`server/`) under `pm2` and expose it through a
Cloudflare tunnel (`cloudflared`) as a Windows service, so **both survive a reboot
and run with no logged-in desktop session**.

**Scope:** Process management / deployment only. No application source changes.

**Cross-reference:** Tunnel *creation* (DNS, Cloudflare Zero Trust login,
`cloudflared tunnel create`, ingress config) is documented in
[`docs/cloudflare-tunnel.md`](./cloudflare-tunnel.md) (Task 19). This runbook
assumes a tunnel named `minha-agenda` already exists and focuses on running it
as a Windows service. The minimal commands needed here are repeated inline so
this document is usable even before that file lands.

---

## 0. Prerequisites

- Windows 10/11 (or Windows Server) with a normal admin account.
- **Node.js 22 LTS** installed and on `PATH` (the project targets Node 22.22.2).
- **npm** (ships with Node).
- **Git** (to clone / pull the repo).
- **pm2** installed globally: `npm install -g pm2`
- **cloudflared** installed (download the Windows MSI/zip from the
  [Cloudflare releases page](https://github.com/cloudflare/cloudflared/releases)
  and add it to `PATH`, or `winget install Cloudflare.cloudflared`).
- A populated `server/.env` (see §5). `server/.env` is **gitignored** and never
  committed; `.env.example` is the committed template.

> **WSL note:** If you build inside WSL on a mounted Windows path, `npm run build`
> is slow (~1–3 min) due to the cross-FS overhead. On a real Windows `node`
> install the build is fast. This runbook assumes a **native Windows** Node
> toolchain (not WSL) for the production host.

---

## 1. Build the backend

Open **PowerShell as Administrator** in the project root, then:

```powershell
cd server
npm install        # install deps (only needed once / after pulling changes)
npm run build      # runs `nest build` -> emits dist/main.js
```

Verify the artifact exists:

```powershell
Test-Path dist/main.js   # should print True
```

`npm run build` maps to `nest build` (see `server/package.json`), which compiles
TypeScript to `server/dist/`. The entry point is `dist/main.js`. The app sets a
global route prefix `api` and listens on `process.env.API_PORT` (default `3000`).

> If the schema changed, run migrations once (needs `DATABASE_URL` in `.env`):
> `npm run migrate` (runs `ts-node src/db/migrate.ts`).

---

## 2. Run the API under pm2

Start the compiled app as a managed pm2 process:

```powershell
cd server
pm2 start dist/main.js --name minha-agenda-api
```

This gives you:
- **Crash survival:** pm2 auto-restarts `minha-agenda-api` if it exits
  unexpectedly (default `max_restarts` policy).
- A single command to inspect/control it: `pm2 list`, `pm2 logs minha-agenda-api`,
  `pm2 restart minha-agenda-api`, `pm2 stop minha-agenda-api`.

Persist the process list so it can be resurrected after reboot:

```powershell
pm2 save          # writes ~/.pm2/dump.pm2 (the saved process list)
```

### 2.1 Make pm2 itself survive reboots on Windows

> **Important:** `pm2 startup` only generates a **systemd** unit on Linux. On
> Windows it does **not** create a working auto-start service. Use one of the
> Windows-native paths below.

#### Option A — `pm2-installer` (recommended, least friction)

`pm2-installer` wraps pm2 in a Windows service (via `node-windows`) so pm2 — and
the saved process list — comes back automatically after a reboot, with no login
required.

```powershell
npm install -g pm2-installer
pm2-installer        # installs + starts the "PM2" Windows service
```

After install, reboot and confirm `pm2 list` shows `minha-agenda-api` running
with no user logged in. `pm2-installer` runs `pm2 resurrect` from the saved
`dump.pm2` on service start, so **always `pm2 save` after any change** to the
process list.

#### Option B — NSSM (manual service, no extra npm global)

[NSSM](https://nssm.cc/) (Non-Sucking Service Manager) can run any command as a
Windows service. Point it at `pm2 resurrect` (which restores the saved list):

```powershell
# after `pm2 save` in step 2
nssm install minha-agenda-pm2 "C:\Path\To\pm2.cmd" resurrect
nssm set minha-agenda-pm2 AppDirectory "C:\Users\<you>\.pm2"
nssm start minha-agenda-pm2
```

Replace `C:\Path\To\pm2.cmd` with the result of `where pm2` (typically
`C:\Users\<you>\AppData\Roaming\npm\pm2.cmd`). The service runs at boot under
the `LocalSystem` account, independent of any desktop session.

> Direct alternative: skip pm2 and let NSSM run `node dist/main.js` directly as
> the service. pm2 is preferred here because it adds crash-restart + log
> rotation + a single control surface for the API.

---

## 3. Run cloudflared as a Windows service (tunnel survives reboots)

The tunnel must start at boot **without a logged-in user**. Pick one option.

### 3.1 Option A — Native `cloudflared service install` (simplest)

If the tunnel is already created and its config lives in
`%USERPROFILE%\.cloudflared\config.yml` (with the `minha-agenda` tunnel and
ingress rules — see `docs/cloudflare-tunnel.md`), install it as a service:

```powershell
cloudflared service install
```

This registers a Windows service (`Cloudflared`) that runs
`cloudflared tunnel run` for the configured default tunnel at system startup,
under `LocalSystem`, with no desktop session required.

### 3.2 Option B — NSSM wrapping `cloudflared tunnel run minha-agenda`

If you prefer to name the tunnel explicitly (or the native installer is
unavailable), wrap the run command with NSSM:

```powershell
nssm install minha-agenda-tunnel "C:\Path\To\cloudflared.exe" "tunnel run minha-agenda"
nssm set minha-agenda-tunnel AppDirectory "C:\Users\<you>\.cloudflared"
nssm start minha-agenda-tunnel
```

`minha-agenda` is the tunnel name created in `docs/cloudflare-tunnel.md`. The
service starts at boot under `LocalSystem`.

### 3.3 Option C — Task Scheduler (no extra downloads)

Create a scheduled task that runs at startup, regardless of login:

1. `taskschd.msc` → **Task Scheduler Library** → **Create Task…**
2. **General** tab:
   - Name: `MinhaAgendaTunnel`
   - **Run whether user is logged on or not** ✔
   - **Run with highest privileges** ✔
   - Configure for: Windows 10/11
3. **Triggers** tab → **New…** → Begin the task: **At startup** ✔ → OK.
4. **Actions** tab → **New…** →
   - Action: **Start a program**
   - Program/script: `cloudflared`
   - Arguments: `tunnel run minha-agenda`
   - Start in: `C:\Users\<you>\.cloudflared`
5. **Settings** tab → **If the task fails, restart every:** 1 minute ✔ (resilience).
6. OK, then **Run** it once to validate, and reboot to confirm auto-start.

> All three options run the tunnel under a system/service account, so the public
> URL keeps working after a reboot with nobody logged into the desktop.

---

## 4. Verify after a reboot (no user logged in)

1. Reboot the machine (or stop both services and start them) so you exercise the
   real auto-start path.
2. From the machine (or any machine that can reach it):

```powershell
# API process is up under pm2
pm2 list                       # minha-agenda-api  online

# Local health check (global prefix `api`, port 3000)
curl http://localhost:3000/api/health     # expect HTTP 200

# Tunnel reaches the backend through the public URL
curl https://<your-tunnel-subdomain>.trycloudflare.com/api/health   # expect 200
# or, if you mapped a custom domain in cloudflare-tunnel.md:
curl https://api.<yourdomain.com>/api/health                        # expect 200
```

3. Confirm the Windows services are present and running:

```powershell
Get-Service | Where-Object { $_.Name -like '*pm2*' -or $_.Name -like '*Cloudflared*' -or $_.Name -like '*minha-agenda*' }
```

Expected: the pm2 service (Option A/B) and the tunnel service (Option A/B/C)
show `Running`, and `pm2 list` shows `minha-agenda-api` **without** you having
logged into a desktop session.

### 4.1 Quick troubleshooting

| Symptom | Check |
| --- | --- |
| `pm2 list` empty after reboot | `pm2 save` was not run, or the pm2 Windows service isn't started. Re-run §2.1. |
| `curl /api/health` → connection refused | API_PORT mismatch or `.env` missing `FRONTEND_ORIGIN` (app throws at boot). Check `pm2 logs minha-agenda-api`. |
| Tunnel URL → 502/timeout | `cloudflared` service not running, or ingress points at wrong `localhost:3000`. Check `cloudflared tunnel info minha-agenda`. |
| App aborts at startup | `server/.env` missing `DATABASE_URL` or `FRONTEND_ORIGIN` (fail-fast in `PgService`/`main.ts`). See §5. |

---

## 5. Required `server/.env` values (user-provided, gitignored)

The API reads these from `server/.env` (copy from `server/.env.example`). All are
**user-supplied real resources** — never committed. Fill every one before
starting pm2:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | CockroachDB Cloud connection string (`postgresql://…?sslmode=verify-full`). Required; app fails fast if empty. |
| `GOOGLE_CLIENT_ID` | Google OAuth "Web application" client ID (PKCE + state + nonce). |
| `GOOGLE_CLIENT_SECRET` | Paired OAuth secret. Keep secret; never expose to frontend. |
| `SESSION_SECRET` | Random string signing the session cookie (`openssl rand -base64 48`). |
| `API_PUBLIC_URL` | Public API base URL used in OAuth redirects/CORS (e.g. `https://api.<yourdomain.com>`). |
| `FRONTEND_ORIGIN` | Allowed CORS origin of the frontend (e.g. `https://<user>.github.io`). **Required** — app throws at boot if unset. |
| `API_PORT` | Listen port (default `3000`). |
| `NODE_ENV` | `production` enables secure/sameSite-none cookies + strict CORS. |

After editing `.env`, restart the API so pm2 picks up the new values:

```powershell
pm2 restart minha-agenda-api
pm2 save
```

---

## 6. Operations cheat-sheet

```powershell
# Restart API after a code change (rebuild first)
cd server; npm run build; pm2 restart minha-agenda-api; pm2 save

# Watch logs
pm2 logs minha-agenda-api

# Stop / start the tunnel service
#  (native)  net stop Cloudflared / net start Cloudflared
#  (nssm)    nssm stop minha-agenda-tunnel / nssm start minha-agenda-tunnel
#  (task)    via Task Scheduler, or: Start-ScheduledTask -TaskName MinhaAgendaTunnel

# Full reboot test (no desktop login)
Restart-Computer; # then verify §4 from another machine / after logging in
```

---

## 7. Summary of what runs where

| Component | How it survives reboot | Runs without desktop login? |
| --- | --- | --- |
| `minha-agenda-api` (Node/NestJS) | pm2 + Windows service (`pm2-installer` or NSSM) + `pm2 save` | ✅ |
| Cloudflare tunnel (`cloudflared tunnel run minha-agenda`) | Windows service (native / NSSM) or Task Scheduler startup task | ✅ |

Both are decoupled: pm2 restarts the API on crash; the tunnel service restarts
the tunnel on boot. Together they keep the backend publicly reachable with no
interactive session.
