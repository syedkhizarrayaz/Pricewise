# Pricewise backend: step-by-step deployment, verify, and debug

This guide covers deploying the **Node backend** (Docker image from `deployment/digitalocean/Dockerfile`) to a Linux server (e.g. DigitalOcean), including **rsync**, **directory layout**, **build/run**, **verification**, and **common failures**.

---

## 1. What you are deploying

| Item | Detail |
|------|--------|
| **Image** | Multi-stage Node 20 image: installs deps, runs `npm run build` in `backend/`, runs `node /app/backend/dist/server.js` |
| **Port** | **3001** (HTTP API) |
| **Health** | `GET http://<host>:3001/api/health` |
| **Env** | Built from a **`.env` file at the Docker build context root** (`COPY .env /app/.env`). Runtime loads `/app/.env` (see `backend/src/loadEnv.ts`). |

**Build context directory** (on your laptop or on the server) must contain:

- `backend/` — full backend source (no need to upload `node_modules` or `dist` if you build in Docker)
- `.env` — secrets for **build** copy (see §6)
- `deployment/digitalocean/Dockerfile` — used with `-f`

Correct layout:

```text
/opt/pricewise/   (or any folder you use as context)
├── .env
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   └── src/
└── deployment/
    └── digitalocean/
        └── Dockerfile
```

---

## 2. Prerequisites

### On the server

- Ubuntu 22.04+ (or similar) with **Docker** installed
- **OpenSSH** and your SSH key or password
- Optional: `ufw` for firewall

### On your laptop

- Repo clone: **Pricewise** project root
- SSH private key (example: `~/.ssh/pricewisekey`) with permissions `chmod 600`

### API keys in `.env`

At minimum, keys used by the **simplified** grocery pipeline (adjust to match your real `backend` env): e.g. HasData, OpenAI, optional Gemini, optional Redis, etc. If `.env` is missing at **image build** time, `docker build` fails on `COPY .env`.

---

## 3. Scenario A — Deploy with Git (recommended when repo is available)

### 3.1 On the server

```bash
sudo mkdir -p /opt/pricewise
sudo chown -R "$USER":"$USER" /opt/pricewise   # if you do not deploy as root
cd /opt
```

If **first time**:

```bash
git clone <YOUR_REPO_URL> pricewise
cd pricewise
```

If **already cloned**:

```bash
cd /opt/pricewise
git pull origin main    # or your default branch
```

### 3.2 Add `.env` on the server

`.env` is usually **not** in git. Create it on the server:

```bash
nano /opt/pricewise/.env
# paste keys, save
chmod 600 /opt/pricewise/.env
```

### 3.3 Build and run (Docker)

```bash
cd /opt/pricewise
docker build -f deployment/digitalocean/Dockerfile -t pricewise-backend:latest .
```

If your server only has `digitalocean/Dockerfile` (wrong layout), fix layout first (§5) or use `-f digitalocean/Dockerfile` only if that path exists **and** `backend/` is still next to it.

```bash
docker stop pricewise-backend 2>/dev/null || true
docker rm pricewise-backend 2>/dev/null || true

docker run -d --name pricewise-backend \
  -p 3001:3001 \
  --restart unless-stopped \
  pricewise-backend:latest
```

### 3.4 Verify (Scenario A)

Go to **§9 Verification checklist**.

---

## 4. Scenario B — Deploy with rsync from your Mac (correct commands)

Run these from your **Pricewise repository root** (the folder that contains `backend/` and `deployment/`).

### 4.1 Shell line continuations (avoid rsync “stat” errors)

- Put **nothing** after the `\` except a newline (no space after `\`).
- Bad: `rsync ... \␠` ← space after backslash creates empty arguments and `(l)stat: No such file or directory`.

### 4.2 Never merge two sources into one destination root

**Wrong** (flattens `backend` + `deployment` into `/opt/pricewise/` and breaks `backend/`):

```bash
rsync ... ./backend/ ./deployment/digitalocean/ root@HOST:/opt/pricewise/
```

**Right** — **two rsync commands**, each with its own **target subdirectory**:

```bash
SSH="ssh -i $HOME/.ssh/pricewisekey"
HOST="root@YOUR_SERVER_IP"          # replace
DEST="/opt/pricewise"

rsync -avz --delete -e "$SSH" \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  ./backend/ "${HOST}:${DEST}/backend/"

rsync -avz --delete -e "$SSH" \
  ./deployment/digitalocean/ "${HOST}:${DEST}/deployment/digitalocean/"
```

### 4.3 Optional: sync `.env` from laptop

Only if you **have** a root `.env` next to `backend/`:

```bash
test -f .env && rsync -avz -e "$SSH" ./.env "${HOST}:${DEST}/.env"
```

If you do not keep `.env` on the laptop, create it on the server (`nano /opt/pricewise/.env`).

### 4.4 Build and run on server

SSH to the server, then same as §3.3–3.4 (from `/opt/pricewise`).

### 4.5 Verify (Scenario B)

Go to **§9**.

---

## 5. Scenario C — You already ran a bad rsync (flat files under `/opt/pricewise`)

### 5.1 Symptoms

Under `/opt/pricewise` you see **`src/`**, **`package.json`**, **`Dockerfile`**, **`digitalocean/`** at the **top level**, and maybe **`backend/`** duplicated or inconsistent.

### 5.2 Fix layout (do not delete until you know `backend/` is good)

1. **Re-sync** using §4.2 so you have:

   - `/opt/pricewise/backend/...`
   - `/opt/pricewise/deployment/digitalocean/Dockerfile`

2. **If** you have a stray top-level `digitalocean/` (no `deployment/` parent):

   ```bash
   cd /opt/pricewise
   mkdir -p deployment
   mv digitalocean deployment/digitalocean
   ```

3. **After** `backend/` is confirmed complete, you may remove duplicate top-level junk (careful):

   ```bash
   cd /opt/pricewise
   # Only if these are duplicates of backend/ — verify first:
   # rm -rf src database scripts
   ```

4. Ensure **`.env`** exists at `/opt/pricewise/.env`.

### 5.3 Build

```bash
cd /opt/pricewise
docker build -f deployment/digitalocean/Dockerfile -t pricewise-backend:latest .
```

If `deployment/digitalocean/` does not exist but `digitalocean/Dockerfile` does:

```bash
docker build -f digitalocean/Dockerfile -t pricewise-backend:latest .
```

Prefer fixing folders to match the repo (`deployment/digitalocean/`) so docs and CI stay consistent.

---

## 6. `.env` and Docker build

| Step | Requirement |
|------|----------------|
| **Build** | File `.env` must exist in the **build context root** (same directory as `backend/`). The Dockerfile has `COPY .env /app/.env`. |
| **Missing .env** | `docker build` fails with a COPY error. |
| **Runtime** | Container reads `/app/.env` (mapped from image). To change secrets without rebuild, you would need to change the Dockerfile to use `docker run --env-file` and remove `COPY .env` (optional future improvement). |

---

## 7. Docker build (detailed)

### 7.1 Commands

```bash
cd /opt/pricewise
docker build -f deployment/digitalocean/Dockerfile -t pricewise-backend:latest .
```

### 7.2 BuildKit / buildx warning

Messages like “legacy builder is deprecated… install buildx” are **warnings**. Install buildx if you want; the build can still succeed.

### 7.3 Typical build failure: Dockerfile path

**Error:** `lstat /opt/pricewise/deployment: no such file or directory`

**Cause:** `-f deployment/digitalocean/Dockerfile` but folder `deployment/digitalocean/` is missing.

**Fix:** §4.2 or §5.2.

### 7.4 Typical build failure: `COPY .env`

**Cause:** No `.env` in context root.

**Fix:** Create `/opt/pricewise/.env`, rebuild.

---

## 8. Docker run (detailed)

### 8.1 Stop old container

```bash
docker stop pricewise-backend 2>/dev/null || true
docker rm pricewise-backend 2>/dev/null || true
```

### 8.2 Start

```bash
docker run -d --name pricewise-backend \
  -p 3001:3001 \
  --restart unless-stopped \
  pricewise-backend:latest
```

### 8.3 Port already in use

```bash
sudo lsof -i :3001
# stop conflicting process or use -p 3002:3001 and update firewall/client
```

---

## 9. Verification checklist

Run on the **server**:

### 9.1 Container running

```bash
docker ps --filter name=pricewise-backend
```

Expect **STATUS** `Up` …

### 9.2 Logs (no crash loop)

```bash
docker logs --tail 100 pricewise-backend
```

Look for startup messages; errors often show missing `OPENAI_API_KEY`, `HASDATA_*`, etc.

### 9.3 Health endpoint

```bash
curl -sS http://127.0.0.1:3001/api/health | jq .
# or without jq:
curl -sS http://127.0.0.1:3001/api/health
```

### 9.4 From your laptop (replace IP)

```bash
curl -sS http://YOUR_SERVER_IP:3001/api/health
```

If this fails but §9.3 works, check **firewall** (§10).

### 9.5 Optional grocery smoke test

```bash
curl -sS -X POST http://127.0.0.1:3001/api/grocery/compare-unified \
  -H 'Content-Type: application/json' \
  -d '{"items":["milk 1 gallon"],"address":"123 Main St, Austin, TX 78701","zipCode":"78701"}' | head -c 500
```

Adjust body to match your API (`normalizeGrocerySearchBody` expectations).

---

## 10. Firewall (DigitalOcean / UFW)

On the server:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 3001/tcp
sudo ufw status
sudo ufw enable   # if not already enabled
```

**DigitalOcean cloud firewall:** allow inbound **TCP 3001** to the droplet if you use DO firewalls.

---

## 11. Client / frontend configuration

Point the app at the public backend URL, e.g.:

- `http://YOUR_SERVER_IP:3001`
- Or `https://api.yourdomain.com` if you terminate TLS with nginx/Caddy and proxy to `127.0.0.1:3001`.

Match whatever your `client_app_v2` or Expo config expects (`VITE_`, `EXPO_PUBLIC_`, etc.).

---

## 12. Update cycle (after code changes)

### On laptop (rsync)

Repeat §4.2 (and `.env` if needed).

### On server

```bash
cd /opt/pricewise
docker build -f deployment/digitalocean/Dockerfile -t pricewise-backend:latest .
docker stop pricewise-backend && docker rm pricewise-backend
docker run -d --name pricewise-backend -p 3001:3001 --restart unless-stopped pricewise-backend:latest
docker logs --tail 50 pricewise-backend
curl -sS http://127.0.0.1:3001/api/health
```

---

## 13. Debug reference — errors and actions

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| `(l)stat: No such file or directory` (several, from rsync) | Space after `\` in multiline command, or missing path | Fix continuations (§4.1); confirm each path exists |
| rsync exit **23** | Partial transfer / delete skipped (permissions, I/O) | Fix paths; check remote permissions; avoid `--delete` on parent until layout is correct |
| `lstat .../deployment: no such file or directory` (docker) | Wrong `-f` path vs actual dirs | §5.2 or use `-f digitalocean/Dockerfile` if that is where the file is |
| `COPY .env: not found` | No `.env` in build context | §6 |
| Container **Exited (1)** immediately | Crash on boot | `docker logs pricewise-backend` |
| Health fails, logs show env missing | Incomplete `.env` | Add keys, rebuild (if using `COPY .env`) |
| `curl` works on server, fails from laptop | Firewall / DO security | §10 |
| Old behavior after deploy | Old image still running | `docker ps`; rebuild; `docker rm` + `docker run` with new tag or `--no-cache` build |

### 13.1 Inspect image and shell (advanced)

```bash
docker images | grep pricewise
docker run --rm -it --entrypoint sh pricewise-backend:latest -c "ls -la /app /app/backend/dist | head"
```

---

## 14. Optional: Redis cache

If you use `REDIS_URL` in `.env`, Redis must be reachable from the container. For a Redis container on the same host, use Docker networks or host gateway IP; `redis://localhost:6379` **inside** the backend container is **not** the host’s Redis unless you use `--network host` or link containers.

---

## 15. Related docs in this repo

| File | Contents |
|------|----------|
| `deployment/README.md` | Scripts overview, quick health commands |
| `deployment/DIGITALOCEAN_DEPLOYMENT.md` | Long-form DO guide (DB, nginx, etc.) |
| `deployment/HTTPS_DOMAIN_SETUP.md` | **HTTPS + domain** (Hostinger DNS, nginx, Let’s Encrypt, CORS) |
| `deployment/FILE_TRANSFER_GUIDE.md` | Git, scp, rsync, SFTP options |

---

## 16. Quick command card (copy block)

**Laptop (repo root, paths correct):**

```bash
SSH="ssh -i $HOME/.ssh/pricewisekey"
HOST="root@YOUR_SERVER_IP"
DEST="/opt/pricewise"

rsync -avz --delete -e "$SSH" --exclude node_modules --exclude dist --exclude .git \
  ./backend/ "${HOST}:${DEST}/backend/"
rsync -avz --delete -e "$SSH" \
  ./deployment/digitalocean/ "${HOST}:${DEST}/deployment/digitalocean/"
test -f .env && rsync -avz -e "$SSH" ./.env "${HOST}:${DEST}/.env"
```

**Server:**

```bash
cd /opt/pricewise
test -f .env && test -f deployment/digitalocean/Dockerfile && test -f backend/package.json
docker build -f deployment/digitalocean/Dockerfile -t pricewise-backend:latest .
docker stop pricewise-backend 2>/dev/null; docker rm pricewise-backend 2>/dev/null
docker run -d --name pricewise-backend -p 3001:3001 --restart unless-stopped pricewise-backend:latest
curl -sS http://127.0.0.1:3001/api/health
```

Replace `YOUR_SERVER_IP` and SSH key path as needed.
