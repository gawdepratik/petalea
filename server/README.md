# PETALEA backend

Node.js + Express API backing the admin panel, product catalog, and (later) order tracking.

## Local development

```
cd server
npm install
cp .env.example .env   # fill in DATABASE_URL etc.
npm run migrate
npm run seed            # only needed once, populates the 12 existing products
npm start
```

Server runs on `http://localhost:4000` by default. Set `EMAIL_DEV_MODE=true` in `.env` to log OTP codes to the console instead of actually sending mail (the real relay connector will reject mail from your laptop's IP anyway — see below).

## Database (Neon.tech)

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the connection string it gives you (starts with `postgres://...`) into `DATABASE_URL`
3. From your machine or the deployed server, run `npm run migrate` then `npm run seed` once against that connection string

Neon's free tier does not expire and does not require IP allow-listing, unlike Render's managed Postgres.

## Outbound email (M365 relay connector)

This backend sends OTP codes and order notifications through an existing Microsoft 365 anonymous relay connector:

```
Host: petalea-in.mail.protection.outlook.com
Port: 25
Auth: none (source IP must be allow-listed instead)
Encryption: STARTTLS
From: no-reply@petalea.in
```

**This connector only accepts mail from an allow-listed source IP.** Before email will actually send:

1. Deploy the backend to a host with a **static** outbound IP (see below — this is why we're not using a typical free-tier PaaS)
2. In [Exchange Admin Center](https://admin.exchange.microsoft.com) → Mail flow → Connectors, edit the connector and add that static IP to its allow list
3. Set `EMAIL_DEV_MODE=false` in production

Until that's done, leave `EMAIL_DEV_MODE=true` — the server will log codes to its console instead of failing.

## Hosting (Azure VM, static IP)

Render/most free PaaS hosts don't offer a static outbound IP, which the mail connector above requires. Recommended setup:

1. Create an Azure VM — `Standard_B1s`, Ubuntu 22.04 LTS is plenty for this scale
2. Attach a **Static** (not Dynamic) Public IP address resource to it
3. Add that IP to the mail connector's allow-list (see above)
4. SSH in and set up the app:

```bash
# Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# Clone the repo and install
git clone https://github.com/gawdepratik/petalea.git
cd petalea/server
npm install --production
cp .env.example .env   # edit with real values, COOKIE_SECURE=true, EMAIL_DEV_MODE=false

npm run migrate
npm run seed

# Run as a service
sudo tee /etc/systemd/system/petalea-api.service > /dev/null <<'EOF'
[Unit]
Description=PETALEA API
After=network.target

[Service]
WorkingDirectory=/home/azureuser/petalea/server
ExecStart=/usr/bin/node src/index.js
Restart=always
EnvironmentFile=/home/azureuser/petalea/server/.env
User=azureuser

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now petalea-api
```

5. Point a subdomain (e.g. `api.petalea.in`) at the VM's static IP, then set up `nginx` as a reverse proxy + TLS:

```bash
sudo tee /etc/nginx/sites-available/petalea-api > /dev/null <<'EOF'
server {
    listen 80;
    server_name api.petalea.in;
    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/petalea-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.petalea.in
```

6. Update `js/config.js` in the frontend with `https://api.petalea.in` and push

## Deploying updates

```bash
cd petalea/server
git pull
npm install --production
npm run migrate   # safe to re-run, uses IF NOT EXISTS
sudo systemctl restart petalea-api
```
