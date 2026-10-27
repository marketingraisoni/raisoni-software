# Raisoni ERP

One server PC stores all data and serves the app. Every other PC uses the desktop app or a browser.

```
Desktop app / browser (any PC)  ──►  http://192.168.1.125:2000  (server PC: PM2 backend + UI + MongoDB)
```

Environments: **development** (your own PC, own database) and **production** (the server PC).

Always run `npm` commands from the project root, never inside `frontend/`.

## Development PC

```powershell
npm install
npm run dev            # backend http://localhost:9090 + frontend http://localhost:9091, one terminal
```

- Open http://localhost:9091. Uses the local `raisoni_software_development` database, never production data.
- No MongoDB service installed? Run `npm run mongodb:download` once; the backend then starts a bundled database.
- `npm run dev:backend` / `npm run dev:frontend` run each half alone.
- `npm run desktop:dev` opens the desktop window against your dev frontend.

## Server PC (192.168.1.125)

First time:

```powershell
npm ci
copy .env.production.example .env.production   # then set a random JWT_SECRET
npm run mongodb:download                         # only if the MongoDB service is not installed
npm run pm2:deploy                               # build UI + start backend on port 2000
npm run pm2:autostart                            # restart PM2 when this user logs on
npm run server:firewall                          # Administrator PowerShell: allow port 2000 from LAN
```

Every update:

```powershell
git pull
npm ci
npm run pm2:deploy
```

Check: `npm run pm2:status`, `npm run pm2:logs`, http://127.0.0.1:2000/api/health

Keep `frontend/.env.production` free of `VITE_API_URL` / `VITE_SOCKET_URL` so the UI uses the server it is loaded from.

## Desktop app (.exe)

```powershell
npm run dist                                              # release/Raisoni-ERP-Setup-<version>.exe
node scripts/package-electron.cjs --server=http://<ip>:2000   # different server address
```

The installer contains no backend or database; it opens the server's UI, so server updates reach every PC without
reinstalling. If the server is unreachable it shows a waiting screen and reconnects automatically.

To point an installed app at another server without rebuilding, create `%APPDATA%\Raisoni ERP\server.json`:

```json
{ "serverUrl": "http://192.168.1.50:2000" }
```
