#!/bin/bash
# ============================================================
# RetroRisk GRC Platform — Installation Script
# Retrobyte Cybersecurity
# Run as root on a fresh Kali Linux / Debian server
# Usage: bash install.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ____      _             ____  _     _    "
echo " |  _ \ ___| |_ _ __ ___|  _ \(_)___| | __"
echo " | |_) / _ \ __| '__/ _ \ |_) | / __| |/ /"
echo " |  _ <  __/ |_| | |  __/  _ <| \__ \   < "
echo " |_| \_\___|\__|_|  \___|_| \_\_|___/_|\_\\"
echo -e "${NC}"
echo "  Retrobyte Cybersecurity — GRC Platform Installer"
echo "  ================================================="
echo ""

# ── Collect configuration ─────────────────────────────────────
echo -e "${YELLOW}Step 1: Configuration${NC}"
echo ""

read -p "Enter your domain (e.g. retrorisk.retrobytecybersecurity.org): " DOMAIN
read -p "Enter your email (for SSL certificate): " EMAIL
read -p "Enter install directory [/opt/retrorisk]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/opt/retrorisk}
read -s -p "Enter database password (you choose): " DB_PASSWORD
echo ""

echo ""
echo -e "${GREEN}✓ Configuration collected${NC}"
echo ""

# ── Generate secrets ──────────────────────────────────────────
echo -e "${YELLOW}Step 2: Generating secrets${NC}"

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

echo -e "${GREEN}✓ Secrets generated${NC}"
echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}  SAVE YOUR ENCRYPTION KEY — YOU CANNOT RECOVER IT IF LOST${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  ENCRYPTION_KEY: $ENCRYPTION_KEY"
echo ""
echo -e "${RED}  Store this in your password manager RIGHT NOW before continuing.${NC}"
echo ""
read -p "Press Enter once you have saved the encryption key..."
echo ""

# ── Install Docker ────────────────────────────────────────────
echo -e "${YELLOW}Step 3: Installing Docker${NC}"

if systemctl is-active --quiet docker 2>/dev/null; then
    echo -e "${GREEN}✓ Docker already running${NC}"
else
    apt-get update -qq
    apt-get install -y docker.io docker-compose-plugin 2>/dev/null || \
    apt-get install -y docker.io docker-compose 2>/dev/null
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}✓ Docker installed and started${NC}"
fi
echo ""

# ── Create .env file ──────────────────────────────────────────
echo -e "${YELLOW}Step 4: Creating environment configuration${NC}"

cat > "$INSTALL_DIR/.env" << EOF
DB_NAME=retrorisk
DB_USER=retrorisk_user
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
FRONTEND_URL=https://$DOMAIN
REACT_APP_API_URL=https://$DOMAIN/api
EOF

echo -e "${GREEN}✓ .env file created${NC}"
echo ""

# ── Remove version from docker-compose.yml ────────────────────
sed -i '/^version:/d' "$INSTALL_DIR/docker-compose.yml" 2>/dev/null || true

# ── Install npm dependencies ──────────────────────────────────
echo -e "${YELLOW}Step 5: Installing dependencies${NC}"

cd "$INSTALL_DIR/backend"
npm install --silent
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

cd "$INSTALL_DIR/frontend"
npm install --silent
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
echo ""

# ── SSL Certificate ───────────────────────────────────────────
echo -e "${YELLOW}Step 6: Getting SSL certificate${NC}"

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${GREEN}✓ Certificate already exists${NC}"
else
    apt-get install -y certbot python3-certbot-nginx -qq
    certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive
    echo -e "${GREEN}✓ SSL certificate obtained${NC}"
fi
echo ""

# ── Configure Nginx ───────────────────────────────────────────
echo -e "${YELLOW}Step 7: Configuring Nginx${NC}"

cp "$INSTALL_DIR/HOST_NGINX_BLOCK.conf" "/etc/nginx/sites-available/retrorisk"
ln -sf /etc/nginx/sites-available/retrorisk /etc/nginx/sites-enabled/retrorisk

# Replace domain placeholder if any
sed -i "s|retrorisk.retrobytecybersecurity.org|$DOMAIN|g" /etc/nginx/sites-available/retrorisk

nginx -t && systemctl reload nginx
echo -e "${GREEN}✓ Nginx configured${NC}"
echo ""

# ── Build and start Docker stack ─────────────────────────────
echo -e "${YELLOW}Step 8: Building and starting RetroRisk${NC}"
echo "  This will take 3-5 minutes..."
echo ""

cd "$INSTALL_DIR"
docker compose build --no-cache
docker compose up -d

echo -e "${GREEN}✓ RetroRisk stack started${NC}"
echo ""

# ── Wait for database ─────────────────────────────────────────
echo -e "${YELLOW}Step 9: Waiting for database to be ready${NC}"
sleep 10

until docker compose exec -T postgres psql -U retrorisk_user -d retrorisk -c "SELECT 1" &>/dev/null; do
    echo "  Waiting for PostgreSQL..."
    sleep 3
done
echo -e "${GREEN}✓ Database ready${NC}"
echo ""

# ── Run migrations ────────────────────────────────────────────
echo -e "${YELLOW}Step 10: Running database migrations${NC}"

for stage in 2 3 4 5 6 7; do
    echo "  Running stage${stage}.sql..."
    cat "$INSTALL_DIR/database/stage${stage}.sql" | \
        docker compose exec -T postgres psql -U retrorisk_user -d retrorisk > /dev/null
done

echo -e "${GREEN}✓ All migrations complete${NC}"
echo ""

# ── Set admin password ────────────────────────────────────────
echo -e "${YELLOW}Step 11: Setting admin password${NC}"
echo ""
read -s -p "Choose your admin password (min 12 characters): " ADMIN_PASSWORD
echo ""

ADMIN_HASH=$(cd "$INSTALL_DIR/backend" && node -e "const b=require('bcrypt'); b.hash('$ADMIN_PASSWORD', 12).then(h => console.log(h));")

docker compose exec -T postgres psql -U retrorisk_user -d retrorisk \
    -c "UPDATE users SET password_hash = '$ADMIN_HASH' WHERE username = 'admin';" > /dev/null

echo -e "${GREEN}✓ Admin password set${NC}"
echo ""

# ── Set up SSL auto-renewal ───────────────────────────────────
echo -e "${YELLOW}Step 12: Setting up SSL auto-renewal${NC}"

(crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet && systemctl reload nginx") | crontab -

echo -e "${GREEN}✓ Auto-renewal configured${NC}"
echo ""

# ── Verify installation ───────────────────────────────────────
echo -e "${YELLOW}Step 13: Verifying installation${NC}"

sleep 3
HEALTH=$(curl -s http://127.0.0.1:8080/health)
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✓ API is responding${NC}"
else
    echo -e "${RED}✗ API health check failed — check: docker compose logs backend${NC}"
fi
echo ""

# ── Done ──────────────────────────────────────────────────────
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  RetroRisk installation complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  URL:      https://$DOMAIN"
echo "  Username: admin"
echo "  Password: (the one you just set)"
echo ""
echo "  Useful commands:"
echo "    docker compose ps                    — check container status"
echo "    docker compose logs -f backend       — view backend logs"
echo "    docker compose down                  — stop everything"
echo "    docker compose up -d                 — start everything"
echo "    cd $INSTALL_DIR && git pull && docker compose up -d --build  — update"
echo ""
echo -e "${RED}  Remember: Your ENCRYPTION_KEY must be kept safe.${NC}"
echo -e "${RED}  If lost, all encrypted client data becomes unreadable.${NC}"
echo ""
