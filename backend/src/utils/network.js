import os from 'os';

/**
 * Retrieves all active non-internal IPv4 LAN addresses
 * Useful for displaying server connection URL to other PCs on the Wi-Fi/LAN
 */
export function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          address: net.address,
          netmask: net.netmask
        });
      }
    }
  }

  return addresses;
}

/**
 * Returns primary LAN IP address or 127.0.0.1 fallback
 */
export function getPrimaryLanIp() {
  const ips = getLocalIpAddresses();
  // Filter out VPN and virtual adapter interfaces (e.g. CloudflareWARP, VirtualBox, vEthernet, Tailscale)
  const physicalIps = ips.filter(ip => {
    const name = (ip.interface || '').toLowerCase();
    return !name.includes('warp') && 
           !name.includes('virtual') && 
           !name.includes('vethernet') && 
           !name.includes('tailscale') &&
           !name.includes('wsl');
  });

  const candidates = physicalIps.length > 0 ? physicalIps : ips;
  
  // Prefer common physical LAN ranges: 192.168.x.x first, then 10.x.x.x
  const standardLan = candidates.find(ip => ip.address.startsWith('192.168.')) ||
                      candidates.find(ip => ip.address.startsWith('10.')) ||
                      candidates[0];

  return standardLan ? standardLan.address : '127.0.0.1';
}
