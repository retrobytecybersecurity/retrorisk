# RetroRisk — Stage 1 Deployment Guide
# Retrobyte Cybersecurity | retrorisk.retrobytecybersecurity.org

## Prerequisites
- Kali Linux VPS on Linode
- Docker installed (confirmed)
- Domain DNS A record for `retrorisk.retrobytecybersecurity.org` pointing to your Linode IP
- Ports 80 and 443 open in your firewall

---

## Step 1 — Copy Files to Server

```bash
# On your local machine, zip and transfer the project
zip -r retrorisk.zip retrorisk/
scp retrorisk.zip user@YOUR_LINODE_IP:/opt/
ssh user@YOUR_LINODE_IP
cd /opt && unzip retrorisk.zip && cd retrorisk
```

---

## Step 2 — Generate Your Encryption Key and Secrets

```bash
# Generate JWT secret (64 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate AES-256 encryption key (MUST be exactly 64 hex chars = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**CRITICAL: Store your ENCRYPTION_KEY offline (password manager, encrypted note).
If you lose this key, all encrypted client data becomes unreadable.**

---

## Step 3 — Create Your .env File

```bash
cp .env.example .env
nano .env
```

Fill in:
- `DB_PASSWORD` — strong random password
- `JWT_SECRET` — from Step 2
- `ENCRYPTION_KEY` — from Step 2 (exactly 64 hex chars)

---

## Step 4 — Get SSL Certificate (Before Starting Docker)

Certbot must run on the host to obtain the certificate before nginx starts.

```bash
# Install certbot if not present
apt-get install -y certbot

# Create webroot directory
mkdir -p /var/www/certbot

# Get certificate (DNS must be pointing to this server)
certbot certonly --standalone \
  -d retrorisk.retrobytecybersecurity.org \
  --email your@email.com \
  --agree-tos \
  --non-interactive
```

---

## Step 5 — Start the Stack

```bash
# Build and start all containers
docker compose up -d --build

# Watch logs
docker compose logs -f
```

---

## Step 6 — Verify Everything is Running

```bash
# Check all containers are up
docker compose ps

# Test API health
curl https://retrorisk.retrobytecybersecurity.org/health

# Check database initialized correctly
docker compose exec postgres psql -U retrorisk_user -d retrorisk -c "\dt"
```

---

## Step 7 — Change the Default Admin Password

The database seeds a default admin account:
- Username: `admin`
- Password: `ChangeMe123!`

**Log in immediately and change this password:**

```bash
# Connect to database
docker compose exec postgres psql -U retrorisk_user -d retrorisk

# Generate a new bcrypt hash (run on your local machine)
node -e "const b=require('bcrypt'); b.hash('YourNewPassword', 12).then(h => console.log(h));"

# Update in postgres
UPDATE users SET password_hash = 'PASTE_HASH_HERE' WHERE username = 'admin';
\q
```

---

## Step 8 — Set Up Certificate Auto-Renewal

```bash
# Add to crontab
crontab -e

# Add this line (runs renewal check twice daily)
0 0,12 * * * certbot renew --quiet && docker compose exec nginx nginx -s reload
```

---

## Useful Commands

```bash
# Stop everything
docker compose down

# Stop and remove volumes (DELETES ALL DATA)
docker compose down -v

# Rebuild a single service
docker compose up -d --build backend

# View backend logs
docker compose logs -f backend

# Access database
docker compose exec postgres psql -U retrorisk_user -d retrorisk

# Backup database
docker compose exec postgres pg_dump -U retrorisk_user retrorisk > backup_$(date +%Y%m%d).sql
```

---

## Architecture Overview

```
Internet
   │
   ▼
Nginx (443/80) — TLS termination, rate limiting
   │
   ├──/api/*──▶ Node.js Backend (port 3001)
   │               │
   │               ▼
   │           PostgreSQL (AES-256 encrypted columns)
   │
   └──/*──────▶ React Frontend (built static files)
```

---

## What's in Stage 1

✅ Login screen (branded RetroRisk)
✅ Admin dashboard with reminders and health overview
✅ Client list with search and health indicators
✅ Client onboarding (3-step modal) with IG level, cadences
✅ One-time link generation for client credential delivery
✅ Account activation flow
✅ AES-256 column encryption for all PII
✅ JWT authentication with 8-hour expiry
✅ Audit logging (immutable)
✅ Rate limiting on login (5 attempts/15 min)
✅ Offboarding flow with 30-day retention and deletion task
✅ Client portal shell (login works, modules are Coming Soon)

## Stage 2 Preview — Vulnerability Scanning Module
- Nessus CSV import
- Deduplication by finding
- Scope tagging
- Trend graph by severity
- Scan comparison (delta view)
- XLSX export
