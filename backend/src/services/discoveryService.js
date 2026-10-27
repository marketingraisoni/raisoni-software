import dgram from 'node:dgram';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Must match desktop/main.cjs. Desktop apps broadcast this on the LAN; the server replies
// with its HTTP port so clients can connect without a configured IP address.
const DISCOVERY_REQUEST = 'RAISONI_ERP_DISCOVER_V1';
const DISCOVERY_SERVICE = 'raisoni-erp';

let socket = null;

export function startDiscoveryResponder() {
  if (!config.discoveryEnabled || socket) return;

  socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('message', (message, remote) => {
    if (message.toString('utf8').trim() !== DISCOVERY_REQUEST) return;

    const reply = Buffer.from(
      JSON.stringify({
        service: DISCOVERY_SERVICE,
        environment: config.env,
        port: config.port,
        version: config.appVersion
      })
    );
    socket?.send(reply, remote.port, remote.address);
  });

  // Discovery is a convenience; a failure here must never stop the API from serving.
  socket.on('error', (error) => {
    logger.warn(`LAN discovery disabled: ${error.message}`);
    stopDiscoveryResponder();
  });

  socket.bind(config.discoveryPort, () => {
    logger.info(`LAN discovery listening on UDP ${config.discoveryPort}`);
  });
}

export function stopDiscoveryResponder() {
  if (!socket) return;
  try {
    socket.close();
  } catch {
    // Already closed
  }
  socket = null;
}
