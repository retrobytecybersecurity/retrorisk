# retrorisk
vCISO Style platform to manage everything vulnerability and gap related
THIS TOOL IS STILL IN HEAVY DEVELOPMENT CURRENTLY AS OF 5/19/2026. THIS IS NOT THE MOST UP TO DATE VERSION. I PLAN ON HAVING V1.0.1 done by July 1st, 2026. This tool integrates CIS, NIST CSF, vulnerability reporting, and penetration testing reports to create a hub for clients to review their findings and manage their cybersecurity risk.

Step 1 — Get the code on the server
``` Option A: clone from GitHub (recommended after you push)
ssh user@YOUR_LINODE_IP
git clone https://github.com/YOURUSERNAME/retrorisk.git /opt/retrorisk
cd /opt/retrorisk
```

# Option B: copy the zip directly
```
scp retrorisk-final.zip user@YOUR_LINODE_IP:/opt/
ssh user@YOUR_LINODE_IP
cd /opt && unzip retrorisk-final.zip && mv retrorisk /opt/retrorisk && cd /opt/retrorisk
Step 2 — Generate your secrets
bash# Run these on the server — copy the outputs
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # Encryption key
Step 3 — Create your .env file
bashcp .env.example .env
nano .env
```
Fill in these four values:
```
DB_PASSWORD=choose_a_strong_password
JWT_SECRET=paste_the_64_char_hex_from_step2
ENCRYPTION_KEY=paste_the_32_byte_hex_from_step2
FRONTEND_URL=https://retrorisk.retrobytecybersecurity.org
REACT_APP_API_URL=https://retrorisk.retrobytecybersecurity.org/api
Save your ENCRYPTION_KEY somewhere safe offline. If you lose it, all encrypted client data becomes unreadable.
```
Step 4 — Get the SSL certificate
```
# Port 80 must be free — stop anything using it temporarily if needed
sudo certbot certonly --standalone -d retrorisk.retrobytecybersecurity.org \
  --email your@email.com --agree-tos --non-interactive
```
Step 5 — Add RetroRisk to your host Nginx
``` The file HOST_NGINX_BLOCK.conf inside the zip has the exact block to add
cat HOST_NGINX_BLOCK.conf
```
# Copy the contents into your host nginx config
```sudo nano /etc/nginx/sites-available/retrorisk```
# paste the contents, save

```sudo ln -s /etc/nginx/sites-available/retrorisk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Step 6 — Start the stack
```
bashdocker compose up -d --build
This takes 3-5 minutes the first time — it builds the React app and the Node backend inside Docker.
```
Step 7 — Run all database migrations
```
Stage 1 (init.sql) runs automatically on first boot
# Run the rest manually
for stage in 2 3 4 5 6 7; do
  docker compose exec postgres psql -U retrorisk_user -d retrorisk \
    -f /docker-entrypoint-initdb.d/stage${stage}.sql 2>/dev/null || \
  docker compose exec -T postgres psql -U retrorisk_user -d retrorisk < database/stage${stage}.sql
done
Actually the cleaner way:
bashfor stage in 2 3 4 5 6 7; do
  echo "Running stage${stage}.sql..."
  cat database/stage${stage}.sql | docker compose exec -T postgres \
    psql -U retrorisk_user -d retrorisk
done
```
Step 8 — Change the default admin password
```
 Generate a bcrypt hash for your new password
node -e "const b=require('bcrypt'); b.hash('YourNewPassword!', 12).then(h => console.log(h));"

# Update it in the database
docker compose exec postgres psql -U retrorisk_user -d retrorisk -c \
  "UPDATE users SET password_hash = 'PASTE_HASH_HERE' WHERE username = 'admin';"
```
Step 9 — Verify everything is running
```
bashdocker compose ps          # all 4 containers should show "Up"
curl https://retrorisk.retrobytecybersecurity.org/health   # should return {"status":"ok"}
```
Ongoing Commands
```
View logs
docker compose logs -f backend

# Restart after code changes
docker compose up -d --build

# Stop everything
docker compose down

# Update from GitHub
git pull && docker compose up -d --build
```
