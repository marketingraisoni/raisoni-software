export const logger = {
  info: (msg, meta = '') => {
    console.log(`[INFO]  ${new Date().toISOString()} - ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (msg, meta = '') => {
    console.warn(`[WARN]  ${new Date().toISOString()} - ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  error: (msg, meta = '') => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  success: (msg, meta = '') => {
    console.log(`[OK]    ${new Date().toISOString()} - ${msg}`, meta ? JSON.stringify(meta) : '');
  }
};
