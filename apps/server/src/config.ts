import 'dotenv/config';

const DEFAULT_PORT = 3000;

interface Config {
  port: number;
  nodeEnv: string;
  databasePath: string;
  encryptionKey: string;
  sessionSecret: string;
  cookieSecure: boolean;
  corsOrigin: string;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getSecretWithDevDefault(key: string, nodeEnv: string): string {
  const value = process.env[key];
  if (!value) {
    if (nodeEnv === 'production') {
      throw new Error(`Missing required secret in production: ${key}`);
    }
    return `dev-${key.toLowerCase()}-not-for-production`;
  }
  return value;
}

const nodeEnv = getEnv('NODE_ENV', 'development');

function parseCookieSecure(value: string | undefined, nodeEnv: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return nodeEnv === 'production';
}

export const config: Config = {
  port: Number(getEnv('PORT', String(DEFAULT_PORT))),
  nodeEnv,
  databasePath: getEnv('DATABASE_PATH', './data/wakehub.sqlite'),
  encryptionKey: getSecretWithDevDefault('ENCRYPTION_KEY', nodeEnv),
  sessionSecret: getSecretWithDevDefault('SESSION_SECRET', nodeEnv),
  cookieSecure: parseCookieSecure(process.env['COOKIE_SECURE'], nodeEnv),
  corsOrigin: getEnv('CORS_ORIGIN', 'http://localhost:5173'),
};
