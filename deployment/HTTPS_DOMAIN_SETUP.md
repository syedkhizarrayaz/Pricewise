# HTTPS for `aipricewise.com` (Hostinger DNS + server)

You already pointed **Hostinger DNS** at your droplet. On the server you **do not** terminate TLS inside the Node container by default; you put **nginx** (or Caddy) in front on ports **80** and **443**, get a **Let’s Encrypt** certificate, and **reverse-proxy** to the backend on `127.0.0.1:3001`.

Use **lowercase** hostnames everywhere: `aipricewise.com`, `www.aipricewise.com`.

---

## 1. Confirm DNS (from your laptop)

Wait a few minutes after saving DNS at Hostinger, then:

```bash
dig +short aipricewise.com A
dig +short www.aipricewise.com A
```

Both should return your **server public IPv4**. If empty or wrong, fix the **A record** (and **CNAME** for `www` if you use that) in Hostinger until this matches.

---

## 2. On the server — open firewall ports

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp   # optional; only needed for direct IP:3001 testing
sudo ufw status
```

If you use **DigitalOcean Cloud Firewall**, also allow **HTTP (80)** and **HTTPS (443)** inbound to the droplet.

---

## 3. Install nginx and Certbot (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 4. Choose how the API is exposed

### Option A — API on the **root** domain (recommended if this host is API-only)

Browser calls: `https://aipricewise.com/api/health`, `https://aipricewise.com/api/grocery/...`

### Option B — API on a **subdomain**

Example: `https://api.aipricewise.com/api/health`

Then at Hostinger add an **A** record: `api` → same server IP (in addition to `@` and `www` if you use them).

The nginx `server_name` and Certbot `-d` flags change accordingly (examples below use **Option A**; Option B notes are inline).

---

## 5. Create nginx site (Option A: `aipricewise.com` + `www`)

Create a new site file:

```bash
sudo nano /etc/nginx/sites-available/aipricewise.com
```

Paste (adjust only if you use **api** subdomain — see §5.1):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name aipricewise.com www.aipricewise.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and test:

```bash
sudo ln -sf /etc/nginx/sites-available/aipricewise.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # optional: removes default site if it conflicts
sudo nginx -t
sudo systemctl reload nginx
```

Quick check (HTTP only, before TLS):

```bash
curl -sS -H "Host: aipricewise.com" http://127.0.0.1/api/health
```

(If that fails, ensure Docker is running: `docker ps` and `curl http://127.0.0.1:3001/api/health`.)

### 5.1 Option B — only `api.aipricewise.com`

Use `server_name api.aipricewise.com;` and obtain a cert only for `api.aipricewise.com` in §6.

---

## 6. Obtain HTTPS certificate (Let’s Encrypt)

**DNS must already point to this server** or validation fails.

```bash
sudo certbot --nginx -d aipricewise.com -d www.aipricewise.com
```

Follow prompts (email, agree to terms). Certbot edits nginx to add **SSL** and usually adds **HTTP → HTTPS** redirect.

For **api** subdomain only:

```bash
sudo certbot --nginx -d api.aipricewise.com
```

Renewal is installed automatically (`certbot renew` timer). Test:

```bash
sudo certbot renew --dry-run
```

---

## 7. Verify HTTPS and API

```bash
curl -sS https://aipricewise.com/api/health
curl -sSI https://aipricewise.com/api/health   # inspect headers / redirect
```

From your laptop (same commands with the real domain).

---

## 8. Backend / Docker — what to change

### 8.1 Container must still listen on 3001 on the host

Your existing `docker run -p 3001:3001` is correct. Nginx talks to **127.0.0.1:3001**; you do **not** need to expose 3001 to the public internet once nginx is in front (you can remove `3001` from UFW and stop publishing the port if you only access via nginx—optional hardening).

### 8.2 CORS (`FRONTEND_URL`)

In `backend/src/server.ts`, CORS uses `process.env.FRONTEND_URL || '*'`.

- If you use **`*`**, browsers will accept your web app origin as long as credentials rules match your client config.
- For production, set **`FRONTEND_URL`** in **`.env`** to your **real web app origin** (where the React/Capacitor app is served), for example:
  - `https://app.aipricewise.com`
  - or your Vercel/Netlify URL  
  **Not** necessarily the same as the API domain unless the static app is hosted there.

Rebuild the Docker image after changing `.env`:

```bash
cd /opt/pricewise
docker build -f deployment/digitalocean/Dockerfile -t pricewise-backend:latest .
docker stop pricewise-backend && docker rm pricewise-backend
docker run -d --name pricewise-backend -p 3001:3001 --restart unless-stopped pricewise-backend:latest
```

### 8.3 Frontend / mobile env

Point the client base URL to HTTPS, e.g.:

- `https://aipricewise.com` (Option A), or  
- `https://api.aipricewise.com` (Option B)

Ensure `VITE_*` / `EXPO_PUBLIC_*` (whatever this repo uses) has **no trailing slash** unless your client code expects it.

---

## 9. Optional hardening

- **Fail2ban** on SSH/nginx (optional).
- **HSTS** is often added by Certbot nginx snippets; leave on once you are sure HTTPS works.
- If you **stop** publishing port 3001 publicly, use only `-p 127.0.0.1:3001:3001` in `docker run` so the API is reachable only from localhost (nginx). Example:

  ```bash
  docker run -d --name pricewise-backend \
    -p 127.0.0.1:3001:3001 \
    --restart unless-stopped \
    pricewise-backend:latest
  ```

---

## 10. Troubleshooting

| Issue | What to check |
|-------|----------------|
| Certbot fails “connection refused” | Port **80** open to the world; nginx running; DNS points to this machine |
| `502 Bad Gateway` | `docker ps`, `curl http://127.0.0.1:3001/api/health`, nginx `error.log` |
| Wrong site / default nginx page | `sites-enabled` symlink, `server_name`, `nginx -t` |
| CORS errors in browser | `FRONTEND_URL` matches the **page** origin exactly (scheme + host + port) |
| Works on Wi‑Fi but not mobile | DNS not propagated; try mobile data; recheck A record |

---

## 11. Hostinger checklist (DNS only — you said this is done)

- **A** `@` → server IPv4  
- **A** `www` → same IP **or** **CNAME** `www` → `aipricewise.com`  
- For API subdomain: **A** `api` → same IP  
- Remove or avoid conflicting records for the same name

---

## Related

- Full deploy flow: [`DEPLOYMENT_STEP_BY_STEP.md`](./DEPLOYMENT_STEP_BY_STEP.md)  
- Longer DO guide: [`DIGITALOCEAN_DEPLOYMENT.md`](./DIGITALOCEAN_DEPLOYMENT.md) (may include extra nginx examples)
