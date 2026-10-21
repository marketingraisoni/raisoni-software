# Raisoni Software Demo — Local Area Network (LAN) Setup Guide

This guide provides simple, step-by-step instructions for connecting multiple Windows computers to the same database over your office or warehouse Wi-Fi router, **without requiring an internet connection**.

```
                   ┌────────────────────────────────────────┐
                   │          Wi-Fi / LAN Router            │
                   │      (No Internet Access Needed)       │
                   └──────────────────┬─────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
    │  SERVER PC (Host)│    │   CLIENT PC #1   │    │   CLIENT PC #2   │
    │  IP: 192.168.1.50│    │  IP: 192.168.1.51│    │  IP: 192.168.1.52│
    │                  │    │                  │    │                  │
    │ • Node.js Server │    │ • Raisoni App    │    │ • Raisoni App    │
    │ • MongoDB Server │    │ • Connects to:   │    │ • Connects to:   │
    │ • Central Data   │    │   192.168.1.50   │    │   192.168.1.50   │
    └──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## Step 1: Designate One Computer as the "Central Server"

Choose one reliable computer that will stay turned on during business hours (e.g., manager's PC or main billing counter).

1. Ensure the computer is connected to your Wi-Fi or Ethernet router.
2. Open PowerShell in the project directory on this computer and start the server:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/start-server.ps1
   ```
3. The server terminal will immediately display the LAN address, for example:
   ```text
   Designated Server LAN Addresses for Client PCs:
     -> http://192.168.1.50:3000/api  (Wi-Fi)
   ```
4. Note down this IP address (e.g., `192.168.1.50`).

---

## Step 2: Configure Windows Firewall on the Server PC

Windows Firewall protects incoming connections. You must allow incoming traffic on port 3000 on the **Private Network** only:

1. Press **Win + X** and select **Terminal (Admin)** or **Windows PowerShell (Admin)**.
2. Run this single PowerShell command:
   ```powershell
   New-NetFirewallRule -DisplayName "Raisoni Software Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
   ```
3. Ensure your Wi-Fi network profile is set to **Private** (not Public):
   - Go to Windows **Settings > Network & internet > Wi-Fi**.
   - Click your connected Wi-Fi network and select **Private network**.

> [!IMPORTANT]
> Never disable Windows Firewall globally. The rule above safely restricts access to TCP port 3000 on your private office network only.

---

## Step 3: Connect Client Computers

On every other computer connected to the same Wi-Fi router:

1. Launch the **Raisoni Software Demo** application.
2. On the login screen, click the server connection link at the bottom:
   `Server: http://127.0.0.1:3000/api`
3. In the input box, enter the Server PC's IP address:
   ```text
   http://192.168.1.50:3000/api
   ```
   *(Replace 192.168.1.50 with your actual Server PC IP)*
4. Click **Test Connection**. You should see a green confirmation:
   `Successfully connected to Raisoni Software Demo (v1.0.0)`
5. Click **Save & Connect**.
6. Log in with your assigned username and password.

---

## Step 4: Verify Multi-PC Shared Operations

To verify that both computers are communicating with the same central database:

1. On **Client PC #1**, create a new customer or new order.
2. On **Client PC #2**, observe the live update occur automatically via WebSockets, or click the **Reload** button in the top bar.
3. The new customer or order will be immediately visible on both screens!

---

## Wi-Fi Router Settings: Client Isolation / AP Isolation

If Client PCs cannot connect even after configuring the firewall:

1. Log into your Wi-Fi router administration page (typically `http://192.168.1.1` or `http://192.168.0.1`).
2. Navigate to **Wireless Settings > Advanced**.
3. Check the setting named **"AP Isolation"**, **"Client Isolation"**, or **"Guest Isolation"**.
4. **Ensure this setting is DISABLED (OFF)**.
   *(When enabled, AP Isolation prevents Wi-Fi devices from communicating with one another).*
