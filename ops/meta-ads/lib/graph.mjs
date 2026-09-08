// Cliente minimo de la Graph API. Node 18+ ya trae fetch, asi que no hay
// dependencias que instalar ni mantener.
import { config } from './config.mjs';

const BASE = 'https://graph.facebook.com';

// Los errores de Meta llegan con codigos numericos y mensajes en ingles que no
// dicen que hacer. Esta tabla convierte los que salen de verdad en el dia a dia
// en una instruccion accionable.
const AYUDA_POR_CODIGO = {
  190: 'El token no sirve: caduco o fue revocado. Genera uno nuevo del usuario del sistema en Business Settings.',
  200: 'Al token le falta un permiso. Revisa que el usuario del sistema tenga ads_management y que la cuenta publicitaria este asignada a el.',
  272: 'El token no tiene acceso a esa cuenta publicitaria. Asignala al usuario del sistema en Business Settings > Usuarios del sistema.',
  294: 'Falta permiso de administrador sobre la pagina de Facebook.',
  803: 'Ese ID no existe o el token no lo puede ver. Corre `npm run ads discover` para confirmar los IDs.',
  2635: 'Estas llamando a una version de la Graph API ya retirada. Sube META_GRAPH_API_VERSION en el .env.',
  4: 'Llegaste al limite de llamadas de la app. Espera unos minutos.',
  17: 'Llegaste al limite de llamadas del usuario. Espera unos minutos.',
  613: 'Llegaste al limite de llamadas de la cuenta publicitaria. Espera unos minutos.',
  100: 'Un parametro esta mal o no aplica a este objetivo de campana.',
};

export class GraphError extends Error {
  constructor(payload, status) {
    const err = payload?.error ?? {};
    // error_user_msg es el mensaje que Meta escribe para humanos; cuando
    // existe es mucho mas util que el message tecnico.
    const base = err.error_user_msg || err.message || `HTTP ${status}`;
    const ayuda = AYUDA_POR_CODIGO[err.code];

    super(ayuda ? `${base}\n  -> ${ayuda}` : base);

    this.name = 'GraphError';
    this.code = err.code;
    this.subcode = err.error_subcode;
    this.trace = err.fbtrace_id;
    this.status = status;
  }
}

async function request(method, path, params = {}, body = null) {
  if (!config.accessToken) {
    throw new Error(
      'Falta META_ACCESS_TOKEN en ops/meta-ads/.env (copia .env.example).',
    );
  }

  const clean = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(`${BASE}/${config.version}/${clean}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(
      key,
      typeof value === 'object' ? JSON.stringify(value) : String(value),
    );
  }

  const init = { method, headers: {} };

  if (body) {
    // La Marketing API acepta JSON en el cuerpo y es mas legible que el
    // form-urlencoded que usan los ejemplos oficiales.
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  // El token viaja en la cabecera, no en la URL: asi no queda escrito en los
  // logs de acceso ni en el historial de la terminal.
  init.headers.Authorization = `Bearer ${config.accessToken}`;

  const res = await fetch(url, init);
  const payload = await res.json().catch(() => ({}));

  if (!res.ok || payload.error) throw new GraphError(payload, res.status);

  return payload;
}

export const graph = {
  get: (path, params) => request('GET', path, params),
  post: (path, body, params) => request('POST', path, params, body),
  del: (path, params) => request('DELETE', path, params),
};

// Recorre las paginas de un listado y devuelve todo junto. Los listados de
// campanas y anuncios pasan de 25 elementos rapido.
export async function getAll(path, params = {}, maxPages = 20) {
  const items = [];
  let page = await graph.get(path, { limit: 100, ...params });
  let n = 0;

  while (page) {
    items.push(...(page.data ?? []));

    const next = page.paging?.next;
    if (!next || ++n >= maxPages) break;

    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    page = await res.json();
    if (page.error) throw new GraphError(page, res.status);
  }

  return items;
}
