# Raisoni Software Demo — Installation & Deployment Guide

This document describes the prerequisites, installation steps, and environment configuration required to set up **Raisoni Software Demo** on Windows PCs.

---

## 1. System Requirements & Architecture

The application operates in two distinct operational models:

| Component | Mode A: Single-PC Demo Mode | Mode B: Multi-PC Shared LAN Deployment |
| :--- | :--- | :--- |
| **Server Host PC** | Runs Node.js backend, MongoDB, and Electron GUI | Designated host PC runs Node.js backend & MongoDB Community Server |
| **Client PCs** | N/A (all operations on 1 PC) | Run the installed Windows `.exe` application connecting to Server PC over Wi-Fi |
| **Internet Access** | **Not Required** after initial dependency install | **Not Required** during everyday operational usage |

---

## 2. Server PC Prerequisites

Only the designated **Server PC** requires Node.js and MongoDB Community Server. Client PCs only require the Windows installer `.exe`.

### 2.1 Install Node.js (v18, v20, or v22 LTS)
1. Download the Windows MSI installer from [https://nodejs.org/](https://nodejs.org/).
2. Run the installer and verify in PowerShell:
   ```powershell
   node -v
   npm -v
   ```

### 2.2 Install MongoDB Community Server on Windows
1. Download the **MongoDB Community Server (MSI)** from [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community).
2. During installation:
   - Select **Complete** setup.
   - Keep **"Install MongoDB as a Service"** checked (Service Name: `MongoDB`).
   - Leave Data Directory as default: `C:\Program Files\MongoDB\Server\<version>\data\`.
   - Leave Log Directory as default: `C:\Program Files\MongoDB\Server\<version>\log\`.
3. Verify that the Windows service is running:
   ```powershell
   Get-Service MongoDB
   ```

> [!NOTE]
> **Embedded Fallback Mode:**
> If MongoDB Community Server is not yet installed or started, Raisoni Software includes an automatic embedded in-memory database fallback (`USE_EMBEDDED_MONGODB_FALLBACK=true` in `.env`). This allows instant evaluation and testing of all features without manual DB configuration.

---

## 3. Automated One-Command Setup

In the project root folder, execute the automated PowerShell setup script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

This automated script:
1. Validates Node.js and Windows prerequisites.
2. Checks MongoDB service availability.
3. Creates a `.env` configuration file with cryptographically secure random secrets (without overwriting existing secrets).
4. Installs all project dependencies for both backend and frontend workspaces.
5. Prompts to seed the database with realistic demo records (22 customers, 35 products, 16 orders, and 3 initial user roles).

---

## 4. Environment Configuration (`.env`)

Configuration parameters are stored in the root `.env` file:

```env
# Server Network Interface
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Database Connection URI
# Local Community Server:
MONGODB_URI=mongodb://127.0.0.1:27017/raisoni_software_demo

# Fallback: allows demo to operate even before MongoDB Windows service is started
USE_EMBEDDED_MONGODB_FALLBACK=true

# Security: Generated 64-char key for JWT authorization
JWT_SECRET=your_cryptographically_secure_random_key_here
JWT_EXPIRES_IN=8h

# CORS configuration: allow LAN subnet access
CORS_ORIGIN=*

# Application Branding
APP_NAME=Raisoni Software Demo
APP_VERSION=1.0.0
```

> [!CAUTION]
> Never commit `.env`, secret tokens, or customer databases to public version control. Keep `.env` strictly on the Server PC.

---

## 5. Default Demo Accounts

Initial seed credentials created for evaluation:

| Email / Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| `raisonijauharis@gmail.com` | `123456` | **Administrator** | Full system control: catalog, orders, stock adjustments, settings, and user management |
| `marketing.raisoni@gmail.com` | `123456` | **Manager** | Full access to customers, catalog, orders, and stock adjustments |
| `divyesh.raisoni@gmail.com` | `123456` | **Administrator** | Full system control: catalog, orders, stock adjustments, settings, and user management |
| `admin` | `Admin@123` | **Administrator** | Full access fallback |
| `staff` | `Staff@123` | **Staff** | Read access, customer creation, and order creation |

*Passwords can be changed at any time in the **Settings** screen.*
