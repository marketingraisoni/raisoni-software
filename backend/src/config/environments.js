export const ENVIRONMENT_NAMES = Object.freeze([
  'development',
  'production'
]);

export const ENVIRONMENT_DEFAULTS = Object.freeze({
  development: Object.freeze({
    port: 9090,
    databaseName: 'raisoni_software_development'
  }),
  production: Object.freeze({
    port: 2000,
    databaseName: 'raisoni_software_production'
  })
});

export function resolveEnvironmentName(value) {
  const normalized = String(value || 'development').trim().toLowerCase();
  if (!ENVIRONMENT_NAMES.includes(normalized)) {
    throw new Error(
      `Invalid APP_ENV "${value}". Expected one of: ${ENVIRONMENT_NAMES.join(', ')}.`
    );
  }
  return normalized;
}
