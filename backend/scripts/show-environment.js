import { config } from '../src/config/env.js';

console.log(JSON.stringify({
  environment: config.env,
  host: config.host,
  port: config.port,
  databaseName: config.databaseName,
  dataDir: config.dataDir,
  embeddedDatabase: config.useEmbedded,
  embeddedFallback: config.useEmbeddedFallback
}, null, 2));
