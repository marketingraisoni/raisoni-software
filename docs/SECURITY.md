# Raisoni Software Demo — Security & Hardening Architecture

This document describes the security protocols, encryption mechanisms, authentication flows, and network boundary protections implemented in **Raisoni Software Demo**.

---

## 1. Authentication & Token Security

- **Password Hashing:** Passwords are never stored in plaintext. They are salted and hashed using `bcryptjs` with 10 salt rounds before being written to MongoDB.
- **JSON Web Tokens (JWT):** Authenticated requests use cryptographically signed JWT tokens signed with `HMAC-SHA256` using a 64-character secret generated on the Server PC.
- **Short-Lived Sessions:** Tokens expire automatically after 8 hours (`JWT_EXPIRES_IN=8h`).
- **No Embedded Credentials:** The packaged frontend and Electron EXE contain zero hardcoded secrets, connection strings, or administrator passwords.
- **Rate Limiting:** Authentication endpoints are protected against brute-force attacks via `express-rate-limit`, limiting login attempts to 20 attempts per 15 minutes per IP address.

---

## 2. Role-Based Access Control (RBAC)

Authorization is strictly enforced in backend middleware (`roleMiddleware.js`), not simply by disabling frontend buttons:

| Permission Level | Permitted Operations |
| :--- | :--- |
| **Admin** | Full system control: User management, application configuration, catalog CRUD, customer CRUD, order management, inventory adjustments, and database maintenance. |
| **Manager** | Operational management: Product creation & modification, customer management, order creation & status updates, manual stock adjustments. User administration is blocked (HTTP 403). |
| **Staff** | Operator level: Read catalog, view orders, create new customers, and submit sales orders. Deletions and user modifications are strictly rejected (HTTP 403). |

---

## 3. Network Architecture & Boundary Safety

- **Private Network Only:** Windows Firewall rule explicitly targets the `Private` profile. The server must never be exposed on public Wi-Fi.
- **Database Boundary:** MongoDB Community Server binds exclusively to `localhost` (`127.0.0.1:27017`). The MongoDB port is **never** exposed to client computers on the network.
- **Controlled API Bridge:** All client PCs communicate exclusively through the authenticated Node.js REST API on port 3000.
- **CORS Protection:** Configurable CORS restricts origins and validates cross-origin request headers.
- **Helmet Headers:** HTTP security headers are injected using `helmet` to mitigate clickjacking, MIME-sniffing, and cross-site injection.

---

## 4. Electron Desktop Sandbox Security

The Electron runtime is configured following Electron Security Best Practices:
- `contextIsolation: true`: Isolates renderer scripts from Electron internals.
- `nodeIntegration: false`: Renderer has zero access to Node.js `fs`, `child_process`, or direct disk APIs.
- `sandbox: true`: Chromium process-level sandboxing enabled.
- **Navigation Lockdown:** Unsafe external navigation or window opening is strictly blocked; external URLs are routed through `shell.openExternal`.

---

## 5. Audit Trail & Data Integrity

- **Immutable Movement History:** All product stock deductions, manual additions, and cancellations write immutable `InventoryMovement` records with timestamp, previous stock, quantity delta, new stock, and the acting user ID.
- **Action Auditing:** Critical operations (logins, user creations, order cancellations, setting changes) are recorded in the `AuditLog` collection.
- **Server-Side Validation:** Prices, subtotal calculations, tax amounts, and discounts are recomputed and validated authoritatively on the backend using `Zod` schemas. Frontend input values are never blindly trusted.
