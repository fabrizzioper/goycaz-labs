// Lee el .env de esta carpeta sin depender de dotenv: son cuatro lineas de
// parseo y asi el CLI no arrastra node_modules al repo del sitio.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;

  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Tolera comillas alrededor del valor, que es como se pega un token.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (value) out[key] = value;
  }

  return out;
}

// Las variables reales del shell ganan sobre el archivo: asi se puede correr
// un comando puntual contra otra cuenta sin editar el .env.
const fileEnv = parseEnvFile(join(ROOT, '.env'));
const env = { ...fileEnv, ...process.env };

export const config = {
  accessToken: env.META_ACCESS_TOKEN || '',
  version: env.META_GRAPH_API_VERSION || 'v26.0',
  businessId: env.META_BUSINESS_ID || '',
  // La Marketing API siempre quiere el prefijo act_; lo normalizamos aca para
  // que en el .env puedas pegar el numero tal cual lo muestra el panel.
  adAccountId: normalizeAdAccount(env.META_AD_ACCOUNT_ID || ''),
  pageId: env.META_PAGE_ID || '',
  instagramId: env.META_INSTAGRAM_ID || '',
  whatsappNumber: (env.META_WHATSAPP_NUMBER || '').replace(/[^\d]/g, ''),
  appId: env.META_APP_ID || '',
  appSecret: env.META_APP_SECRET || '',
};

function normalizeAdAccount(value) {
  const clean = value.trim();
  if (!clean) return '';
  return clean.startsWith('act_') ? clean : `act_${clean.replace(/\D/g, '')}`;
}

export function requireEnv(...keys) {
  const faltan = keys.filter((k) => !config[k]);

  if (faltan.length > 0) {
    const nombres = faltan.map((k) => ENV_NAMES[k] || k).join(', ');
    throw new Error(
      `Falta configurar en ops/meta-ads/.env: ${nombres}\n` +
        'Corre `npm run ads discover` para obtener los IDs.',
    );
  }
}

const ENV_NAMES = {
  accessToken: 'META_ACCESS_TOKEN',
  adAccountId: 'META_AD_ACCOUNT_ID',
  pageId: 'META_PAGE_ID',
  instagramId: 'META_INSTAGRAM_ID',
  businessId: 'META_BUSINESS_ID',
  whatsappNumber: 'META_WHATSAPP_NUMBER',
};
