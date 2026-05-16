# RetroRisk — Installation Guide
**Retrobyte Cybersecurity | GRC Management Platform**

---

## Prerequisites

- Kali Linux or Debian server (Linode VPS recommended)
- A domain with a DNS A record pointing to your server IP
- Root access
- Ports 80 and 443 open

---

## Option A — Automated Install (Recommended)

```bash
git clone https://github.com/YOURUSERNAME/retrorisk.git /opt/retrorisk
cd /opt/retrorisk
bash install.sh
```

Follow the prompts. The script handles everything automatically.

---

## Option B — Manual Install

### Step 1 — Get the Code

```bash
git clone https://github.com/YOURUSERNAME/retrorisk.git /opt/retrorisk
cd /opt/retrorisk
```

Or transfer the zip:
```bash
scp retrorisk-final.zip root@YOUR_SERVER_IP:/opt/
ssh root@YOUR_SERVER_IP
cd /opt && unzip retrorisk-final.zip && cd retrorisk
```

---

### Step 2 — Install Docker

```bash
apt-get update
apt-get install -y docker.io docker-compose-plugin
systemctl start docker
systemctl enable docker
```

Verify:
```bash
docker --version
docker compose version
```

---

### Step 3 — Install npm Dependencies

```bash
cd /opt/retrorisk/backend && npm install
cd /opt/retrorisk/frontend && npm install
```

---

### Step 4 — Create Your .env File

```bash
cd /opt/retrorisk
cp .env.example .env
```

Generate your secrets:
```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Encryption Key (SAVE THIS OFFLINE — losing it = losing all client data)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit the file:
```bash
nano .env
```

Fill in:
```
DB_NAME=retrorisk
DB_USER=retrorisk_user
DB_PASSWORD=YourStrongPasswordHere
JWT_SECRET=paste_jwt_secret_here
ENCRYPTION_KEY=paste_encryption_key_here
FRONTEND_URL=https://yourdomain.com
REACT_APP_API_URL=https://yourdomain.com/api
```

Save with `Ctrl+X` → `Y` → `Enter`.

> **CRITICAL:** Save your ENCRYPTION_KEY in a password manager. If you lose it, all encrypted client data (contact info, notes) becomes permanently unreadable.

---

### Step 5 — Get SSL Certificate

Make sure your domain DNS A record is pointing to your server IP first.

If Nginx is already running (e.g. you have another site):
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com --email you@email.com --agree-tos --non-interactive
```

If nothing is on port 80:
```bash
certbot certonly --standalone -d yourdomain.com --email you@email.com --agree-tos --non-interactive
```

---

### Step 6 — Configure Nginx

```bash
cp /opt/retrorisk/HOST_NGINX_BLOCK.conf /etc/nginx/sites-available/retrorisk
ln -sf /etc/nginx/sites-available/retrorisk /etc/nginx/sites-enabled/retrorisk
nginx -t && systemctl reload nginx
```

---

### Step 7 — Build and Start the Stack

```bash
cd /opt/retrorisk
docker compose build --no-cache
docker compose up -d
```

Check all 4 containers are running:
```bash
docker compose ps
```

You should see `postgres`, `backend`, `frontend`, and `nginx` all showing `Up`.

---

### Step 8 — Run Database Migrations

```bash
cd /opt/retrorisk
for stage in 2 3 4 5 6 7; do
  echo "Running stage${stage}.sql..."
  cat database/stage${stage}.sql | docker compose exec -T postgres psql -U retrorisk_user -d retrorisk
done
```

Each stage should print `CREATE TABLE`, `CREATE INDEX`, etc. with no errors.

---

### Step 9 — Set Admin Password

```bash
cd /opt/retrorisk/backend
node -e "const b=require('bcrypt'); b.hash('YourAdminPassword', 12).then(h => console.log(h));"
```

Copy the hash output, then open the postgres shell:
```bash
cd /opt/retrorisk
docker compose exec -it postgres psql -U retrorisk_user -d retrorisk
```

Inside the postgres prompt paste:
```sql
UPDATE users SET password_hash = '$2b$12$YOURHASHHERE' WHERE username = 'admin';
\q
```

> **Important:** Run this inside the postgres shell (`docker compose exec -it postgres psql ...`) not as a shell command. This avoids the `$` sign being interpreted by bash.

---

### Step 10 — Set Up SSL Auto-Renewal

```bash
(crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
```

---

### Step 11 — Verify Installation

```bash
curl http://127.0.0.1:8080/health
```

Should return: `{"status":"ok","service":"retrorisk-api"}`

Then open your browser: `https://yourdomain.com`

Log in with username `admin` and the password you set.

---

## Useful Commands

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart stack
docker compose restart

# Stop everything
docker compose down

# Start everything
docker compose up -d

# Update from GitHub
cd /opt/retrorisk
git pull
docker compose up -d --build

# Access database directly
docker compose exec -it postgres psql -U retrorisk_user -d retrorisk

# Backup database
docker compose exec postgres pg_dump -U retrorisk_user retrorisk > backup_$(date +%Y%m%d).sql
```

---

## Troubleshooting

**Containers not starting:**
```bash
docker compose logs
```

**API not responding:**
```bash
docker compose logs backend
```

**Database connection issues:**
```bash
docker compose logs postgres
```

**Nginx errors:**
```bash
nginx -t
journalctl -u nginx -n 50
```

**Frontend not loading:**
```bash
docker compose logs frontend
```

---

## File Structure

```
/opt/retrorisk/
├── .env                    # Your secrets (never commit this)
├── .env.example            # Template
├── docker-compose.yml      # Container definitions
├── install.sh              # Automated installer
├── HOST_NGINX_BLOCK.conf   # Add to host Nginx
├── INSTALL.md              # This guide
├── backend/
│   ├── src/
│   │   ├── controllers/    # Business logic
│   │   ├── middleware/     # Auth, validation
│   │   ├── routes/         # API endpoints
│   │   └── utils/          # Encryption, PDF, parsers
│   └── data/
│       ├── cis-v8-safeguards.json        # CIS framework data
│       └── nist-csf2-subcategories.json  # NIST framework data
├── frontend/
│   └── src/
│       ├── pages/          # Full page components
│       ├── components/     # Reusable UI components
│       ├── hooks/          # React hooks
│       └── utils/          # API client
├── database/
│   ├── init.sql            # Base schema (auto-runs on first boot)
│   ├── stage2.sql          # Vulnerability tables
│   ├── stage3.sql          # Pentest tables
│   ├── stage4.sql          # Phishing tables
│   ├── stage5.sql          # CIS assessment tables
│   ├── stage6.sql          # NIST assessment tables
│   └── stage7.sql          # Roadmap tables
└── nginx/
    └── nginx.conf          # Internal Docker Nginx config
```

---

## Security Notes

- All client PII is encrypted at rest with AES-256-GCM
- JWT tokens expire after 8 hours
- Login is rate limited to 5 attempts per 15 minutes
- All changes are recorded in an immutable audit log
- Client data is isolated — no cross-client data access
- TLS 1.2/1.3 only, enforced at the Nginx layer
