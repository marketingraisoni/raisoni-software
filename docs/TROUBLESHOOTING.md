# Raisoni Software Demo — Troubleshooting Guide

This guide covers common runtime scenarios, network diagnostics, and remediation steps for Raisoni Software Demo.

---

## 1. Client PC Cannot Connect to Server PC

### Symptom
When testing the server connection from a Client PC, you receive:
`Failed to connect to http://192.168.1.50:3000/api: Connection timed out or Connection refused`

### Diagnostic Steps
1. **Run Network Diagnostics:**
   On the Client PC, open PowerShell and run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/check-network.ps1 -TargetUrl "http://192.168.1.50:3000/api"
   ```
   *(Replace with the actual Server PC IP address).*

2. **Verify Server Process:**
   On the Server PC, verify that the Node.js backend is active:
   ```powershell
   Get-Process -Name node
   ```

3. **Check Windows Firewall on the Server PC:**
   The Server PC must allow incoming connections on TCP port 3000 for Private networks.
   Open PowerShell as Administrator on the **Server PC** and execute:
   ```powershell
   New-NetFirewallRule -DisplayName "Raisoni Software Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
   ```

4. **Verify Windows Network Profile is "Private":**
   If Windows assigns your Wi-Fi connection as "Public Network", Windows Firewall blocks peer-to-peer traffic.
   - Go to Windows **Settings > Network & internet > Wi-Fi**.
   - Click on your active Wi-Fi network.
   - Set Network profile type to **Private network**.

5. **Disable Wi-Fi Router "AP Isolation" / "Client Isolation":**
   Many guest and commercial Wi-Fi access points have **"AP Isolation"** enabled by default. This security feature prevents devices connected to the same Wi-Fi router from discovering or talking to each other.
   - Log into your router's admin portal.
   - Disable **AP Isolation** / **Client Isolation**.

---

## 2. MongoDB Service Issues & Fallback Mode

### Symptom
Server logs display:
`Could not connect to external MongoDB: connect ECONNREFUSED 127.0.0.1:27017`

### Explanation & Resolution
1. **Embedded In-Memory Fallback:**
   Raisoni Software Demo contains built-in zero-configuration database fallback (`USE_EMBEDDED_MONGODB_FALLBACK=true`). When local MongoDB service is not running, the application automatically launches an isolated embedded database instance so you can continue testing without interruption.

2. **Starting MongoDB Community Server as a Windows Service:**
   For permanent production storage on the Server PC:
   ```powershell
   # Start the service
   Start-Service MongoDB

   # Verify service status
   Get-Service MongoDB
   ```

3. **Checking MongoDB Default Storage Path:**
   MongoDB Community Server stores active production data in:
   `C:\Program Files\MongoDB\Server\<version>\data\`

---

## 3. Stock Deduction & Order Concurrency Errors

### Symptom
Submitting an order returns HTTP 400:
`Insufficient stock for 'Product Name'. Available: 2, Requested: 5`

### Resolution
- The backend strictly validates available inventory at the exact moment of order placement using atomic conditions (`$inc` with `$gte`).
- If another cashier or client PC purchased the last available units simultaneously, the transaction will safely reject the order rather than allowing negative inventory.
- To replenish stock, navigate to the **Inventory** tab and click **Adjust Stock Manually** to record an audited intake movement.

---

## 4. Resetting Administrator Access

If administrator credentials are forgotten:
1. On the Server PC, run the idempotent seeder with the `--reset` flag:
   ```powershell
   node backend/scripts/seed.js
   ```
2. The initial administrator account will be refreshed:
   - Username: `admin`
   - Password: `Admin@123`
