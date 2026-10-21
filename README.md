# Raisoni Software Demo — Complete Offline LAN Desktop ERP

An enterprise-grade, offline-capable Windows desktop business and inventory management software engineered for shared Local Area Networks (LAN) over Wi-Fi, without requiring an active internet connection.

Built with **React + Vite**, **Electron**, **Node.js + Express**, **Socket.IO**, and **MongoDB Community Server**.

---

## 1. Architectural Highlights

- **Shared LAN Architecture:** One PC acts as the central server (running Node.js and MongoDB). Multiple other Windows PCs run the installed desktop application over the local Wi-Fi router, reading and updating the exact same database in real-time.
- **100% Offline Capable:** Zero cloud dependencies, zero external API calls. Runs seamlessly on local office or warehouse networks.
- **Real-Time LAN Synchronization:** Powered by Socket.IO with automatic reconnection and fallback polling. When an order is placed on one computer, all other connected PCs reflect stock changes instantly.
- **Atomic Concurrency Protection:** Inventory is reserved with atomic conditional checks (`$inc` with `$gte`) and automatic compensating rollbacks on standalone MongoDB (or native multi-document transactions on replica sets).
- **Hardened Desktop Security:** Electron with `contextIsolation: true`, `nodeIntegration: false`, process-level sandboxing, and no shell execution from renderer code.
- **Role-Based Access Control (RBAC):** Granular permissions for Administrator, Manager, and Staff enforced authoritatively by backend middleware.
- **Automated Windows Packaging:** Produces a Windows NSIS `.exe` installer via Electron Builder.

---

## 2. Project Directory Structure

```text
raisoni-software-demo/
├── frontend/                     # React + Vite desktop UI
│   ├── src/
│   │   ├── components/common/    # Reusable FormInput, FormSelect, Button, Modal, etc.
│   │   ├── layouts/              # Sidebar & top header layout
│   │   ├── pages/                # Dashboard, Customers, Products, Orders, Inventory, Users, Settings
│   │   ├── services/             # API client & Socket.IO LAN manager
│   │   ├── context/              # Auth & session context
│   │   ├── App.jsx               # Application root
│   │   ├── index.css             # Enterprise design system tokens
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   └── vite.config.js            # Relative base configured for Electron
├── backend/                      # Node.js + Express REST API
│   ├── src/
│   │   ├── config/               # Database connection & env loader
│   │   ├── models/               # Mongoose schemas (User, Customer, Product, Order, Inventory, Audit)
│   │   ├── controllers/          # Business logic & calculations
│   │   ├── routes/               # API endpoints
│   │   ├── middleware/           # Auth, RBAC, Zod validation, and safe error handler
│   │   ├── services/             # Atomic stock service & audit logging
│   │   ├── validators/           # Zod input schemas
│   │   ├── sockets/              # Socket.IO LAN broadcast manager
│   │   └── utils/                # Network detector & logger
│   ├── scripts/
│   │   ├── seed.js               # Idempotent demo data seeder
│   │   └── backup.js             # Database snapshot backup utility
│   ├── tests/
│   │   └── api.test.js           # 14 automated unit & integration tests
│   └── server.js                 # Server entry point
├── desktop/                      # Electron desktop runtime
│   ├── main.cjs                  # Main process with single-instance lock & security
│   └── preload.cjs               # Context-isolated safe bridge
├── scripts/                      # PowerShell automation tools
│   ├── setup.ps1                 # Automated prerequisite check & dependency install
│   ├── start-server.ps1          # Central server launch with LAN IP discovery
│   ├── start-demo.ps1            # Single-PC and client demo launcher
│   ├── build-exe.ps1             # Tests, frontend build, and NSIS installer creation
│   ├── check-network.ps1         # Network diagnostics tool
│   └── backup-database.ps1       # Timestamped database backup script
├── data/                         # Local storage & backup archive directory
│   ├── backups/
│   └── .gitkeep
├── docs/                         # Detailed documentation guides
│   ├── INSTALLATION.md           # Installation & prerequisites guide
│   ├── LAN-SETUP.md              # Non-technical Wi-Fi & LAN setup guide
│   ├── TROUBLESHOOTING.md        # Diagnostics & common issue fixes
│   └── SECURITY.md               # Security hardening & audit trail architecture
├── release/                      # Generated Windows EXE installer & unpacked build
│   ├── Raisoni Software Demo Setup 1.0.0.exe
│   └── win-unpacked/
├── .env.example                  # Environment configuration template
├── .env                          # Local environment secrets (auto-generated)
├── .gitignore
├── package.json                  # Root project scripts & workspaces
└── README.md
```

---

## 3. Quick Start (First-Time Setup)

### Prerequisites (Server Host PC Only)
- **Windows 10 / 11 (64-bit)**
- **Node.js 18+ LTS** (Installed from [nodejs.org](https://nodejs.org/))
- **MongoDB Community Server** (Installed from [mongodb.com](https://www.mongodb.com/try/download/community))

*(Note: Client PCs only need the Windows installer `.exe` and do NOT require Node.js or MongoDB).*

### Step 1: Run Automated Setup
Open PowerShell in the `raisoni-software-demo` directory:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

This automated script installs all dependencies, initializes `.env` with a secure random JWT secret, and seeds 22 customers, 35 products, 16 orders, and 3 initial user roles.

### Step 2: Configured Accounts & Credentials

| Role | Email / Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `raisonijauharis@gmail.com` | `123456` | Full access, user accounts & settings |
| **Manager** | `marketing.raisoni@gmail.com` | `123456` | Catalog, customers, orders, stock adjustments |
| **Administrator** | `divyesh.raisoni@gmail.com` | `123456` | Full access, user accounts & settings |
| **Administrator (Fallback)** | `admin` | `123456` | Full access fallback |
| **Staff Operator** | `staff` | `123456` | Read catalog, create orders & customers |

---

## 4. Operational Modes

### Mode A: Single-PC Demo Mode
Run both backend and the desktop application on the same computer:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-demo.ps1
```

### Mode B: Multi-PC Shared LAN Setup

```
                    ┌─────────────────────────┐
                    │    Wi-Fi / LAN Router   │
                    └────────────┬────────────┘
                                 │
             ┌───────────────────┴───────────────────┐
             ▼                                       ▼
     [ SERVER PC ]                           [ CLIENT PC ]
   IP: 192.168.1.50                        IP: 192.168.1.51
   Runs start-server.ps1                   Runs Installed EXE
   Hosts MongoDB Database                  Connects to 192.168.1.50
```

1. **On the Server PC:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/start-server.ps1
   ```
   Note the displayed LAN IP address (e.g. `http://192.168.1.50:3000/api`).

2. **On the Server PC (Allow Port 3000 in Windows Firewall):**
   Run once in PowerShell as Administrator:
   ```powershell
   New-NetFirewallRule -DisplayName "Raisoni Software Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
   ```

3. **On the Client PC:**
   - Launch the installed Windows desktop application.
   - Click the server connection link at the bottom of the login screen.
   - Enter `http://192.168.1.50:3000/api` and click **Test Connection**, then **Save & Connect**.
   - Log in. Both computers now share the live database.

---

## 5. Building the Windows Installer (`.exe`)

To compile the React frontend, run all tests, and package the Windows NSIS installer:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-exe.ps1
```

The completed installer will be output to:
```text
release/Raisoni Software Demo Setup 1.0.0.exe  (~80.2 MB)
```

The unpacked portable desktop application is also ready in:
```text
release/win-unpacked/Raisoni Software Demo.exe
```

---

## 6. Automated Testing

Execute the 14 automated backend and API tests using the native Node test runner:

```powershell
npm test
```

Tests verify:
- API health probe & database latency checks
- Authentication success, invalid credentials, and JWT issuance
- Unauthorized access rejection (HTTP 401)
- Role-based authorization enforcement (Staff vs Manager vs Admin)
- Customer CRUD and email/phone format validation
- Product CRUD, SKU uniqueness, and category filtering
- Server-side price, discount, and tax calculations
- Real-time stock validation and insufficient stock rejections
- Idempotency key protection preventing duplicate submissions
- Automatic inventory restoration upon order cancellation
- Manual stock adjustments with audit logging
- Real database metric aggregations for the dashboard

---

## 7. Database Backup & Disaster Recovery

### Creating a Backup
Run the backup script to capture a timestamped archive:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-database.ps1
```
Backups are saved to `data/backups/raisoni_backup_<timestamp>.json` (or `.archive` if using native `mongodump`). Previous backups are **never** overwritten or deleted.

---

## 8. Troubleshooting & Diagnostics

Run network diagnostics:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-network.ps1 -TargetUrl "http://192.168.1.50:3000/api"
```

Refer to the detailed guides in the `docs/` folder:
- **[INSTALLATION.md](file:///z:/Divyesh/codes/raisoni-software-demo/docs/INSTALLATION.md)**: Full installation details.
- **[LAN-SETUP.md](file:///z:/Divyesh/codes/raisoni-software-demo/docs/LAN-SETUP.md)**: Non-technical Wi-Fi connection guide.
- **[TROUBLESHOOTING.md](file:///z:/Divyesh/codes/raisoni-software-demo/docs/TROUBLESHOOTING.md)**: Connection and firewall fixes.
- **[SECURITY.md](file:///z:/Divyesh/codes/raisoni-software-demo/docs/SECURITY.md)**: Security and audit trail documentation.

---

## 9. License

Proprietary enterprise software developed for **Raisoni Software Demo**.
