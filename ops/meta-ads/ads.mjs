#!/usr/bin/env node
// CLI de anuncios de GoyCaz Labs sobre la Marketing API de Meta.
//
// Regla de la casa: todo lo que se crea nace PAUSADO. Aca se gasta plata real,
// asi que nada sale al aire sin que alguien lo revise en el Administrador de
// anuncios y lo active a proposito.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { config, requireEnv } from './lib/config.mjs';
import { graph, getAll, GraphError } from './lib/graph.mjs';

const COMANDOS = {
  doctor: { fn: doctor, ayuda: 'Verifica token, version de API y accesos' },
  discover: { fn: discover, ayuda: 'Lista tus IDs y arma el bloque del .env' },
  geo: { fn: geo, ayuda: 'Busca claves de ubicacion: ads geo Miraflores' },
  intereses: { fn: intereses, ayuda: 'Busca intereses de segmentacion' },
  lanzar: { fn: lanzar, ayuda: 'Crea campana + conjunto + anuncio (pausado)' },
  listar: { fn: listar, ayuda: 'Muestra las campanas y su estado' },
  metricas: { fn: metricas, ayuda: 'Resultados: gasto, mensajes, costo por mensaje' },
  pausar: { fn: pausar, ayuda: 'Pausa una campana: ads pausar <id>' },
  activar: { fn: activar, ayuda: 'Activa una campana: ads activar <id>' },
};

// ---------------------------------------------------------------- comandos

async function doctor() {
  titulo('Revision de acceso');

  // El orden importa: cada paso solo tiene sentido si el anterior paso.
  const yo = await graph.get('me', { fields: 'id,name' });
  ok(`Token valido — ${yo.name ?? 'usuario del sistema'} (${yo.id})`);
  ok(`Graph API ${config.version} responde`);

  if (config.appId && config.appSecret) {
    const { data } = await graph.get('debug_token', {
      input_token: config.accessToken,
      access_token: `${config.appId}|${config.appSecret}`,
    });

    const caduca = data?.expires_at
      ? new Date(data.expires_at * 1000).toLocaleString('es-PE')
      : 'nunca (token de usuario del sistema)';

    ok(`Caduca: ${caduca}`);

    const scopes = data?.scopes ?? [];
    const necesarios = ['ads_management', 'ads_read', 'business_management', 'pages_show_list'];
    const faltan = necesarios.filter((s) => !scopes.includes(s));

    ok(`Permisos: ${scopes.join(', ') || '(no reportados)'}`);
    if (faltan.length) aviso(`Faltarian permisos: ${faltan.join(', ')}`);
  } else {
    nota('Pon META_APP_ID y META_APP_SECRET para ver permisos y caducidad exactos.');
  }

  if (!config.adAccountId) {
    aviso('Sin META_AD_ACCOUNT_ID todavia. Corre: npm run ads discover');
    return;
  }

  const cuenta = await graph.get(config.adAccountId, {
    fields: 'name,account_status,currency,timezone_name,amount_spent,balance,disable_reason',
  });

  // account_status 1 es la unica situacion en la que se puede publicar.
  const activa = cuenta.account_status === 1;
  const linea = `Cuenta "${cuenta.name}" — ${cuenta.currency}, ${cuenta.timezone_name}`;

  activa ? ok(linea) : aviso(`${linea} — estado ${cuenta.account_status} (no activa)`);
  ok(`Gastado historico: ${dinero(cuenta.amount_spent, cuenta.currency)}`);

  if (config.pageId) {
    const pagina = await graph.get(config.pageId, { fields: 'name,link' });
    ok(`Pagina: ${pagina.name}`);
  }

  console.log('\nTodo listo para lanzar.');
}

async function discover() {
  titulo('Tus activos en Meta');
  const env = {};

  const negocios = await intentar('negocios', () =>
    getAll('me/businesses', { fields: 'id,name' }),
  );

  for (const n of negocios ?? []) {
    console.log(`  Negocio  ${n.name} — ${n.id}`);
  }
  if (negocios?.length === 1) env.META_BUSINESS_ID = negocios[0].id;

  const cuentas = await intentar('cuentas publicitarias', () =>
    getAll('me/adaccounts', {
      fields: 'id,account_id,name,account_status,currency,timezone_name',
    }),
  );

  for (const c of cuentas ?? []) {
    const estado = c.account_status === 1 ? 'activa' : `estado ${c.account_status}`;
    console.log(`  Cuenta   ${c.name} — ${c.account_id} (${c.currency}, ${estado})`);
  }
  if (cuentas?.length === 1) env.META_AD_ACCOUNT_ID = cuentas[0].account_id;

  // Un usuario del sistema no siempre ve /me/accounts; por negocio si.
  let paginas = await intentar('paginas', () =>
    getAll('me/accounts', { fields: 'id,name,instagram_business_account{id,username}' }),
  );

  if (!paginas?.length && env.META_BUSINESS_ID) {
    paginas = await intentar('paginas del negocio', () =>
      getAll(`${env.META_BUSINESS_ID}/owned_pages`, {
        fields: 'id,name,instagram_business_account{id,username}',
      }),
    );
  }

  for (const p of paginas ?? []) {
    const ig = p.instagram_business_account;
    console.log(`  Pagina   ${p.name} — ${p.id}${ig ? ` · IG @${ig.username} (${ig.id})` : ''}`);
  }

  if (paginas?.length === 1) {
    env.META_PAGE_ID = paginas[0].id;
    const ig = paginas[0].instagram_business_account;
    if (ig) env.META_INSTAGRAM_ID = ig.id;
  }

  if (env.META_BUSINESS_ID) {
    const wabas = await intentar('WhatsApp', () =>
      getAll(`${env.META_BUSINESS_ID}/owned_whatsapp_business_accounts`, {
        fields: 'id,name',
      }),
    );
    for (const w of wabas ?? []) console.log(`  WhatsApp ${w.name} — ${w.id}`);
  }

  const encontrados = Object.entries(env);

  if (encontrados.length) {
    titulo('Pega esto en ops/meta-ads/.env');
    for (const [k, v] of encontrados) console.log(`${k}=${v}`);
  } else {
    nota('Hay mas de una opcion por tipo: elige a mano de la lista de arriba.');
  }
}

async function geo(args) {
  const q = args._.join(' ') || 'Lima';
  const { data } = await graph.get('search', {
    type: 'adgeolocation',
    location_types: ['city', 'region', 'country'],
    q,
    limit: 15,
  });

  titulo(`Ubicaciones para "${q}"`);
  for (const g of data ?? []) {
    console.log(`  ${g.key.padEnd(12)} ${g.type.padEnd(8)} ${g.name}, ${g.country_name}`);
  }
  nota('Usa la clave (primera columna) con: npm run ads lanzar -- --geo <clave>');
}

async function intereses(args) {
  const q = args._.join(' ');
  if (!q) throw new Error('Dime que buscar: npm run ads intereses odontologia');

  const { data } = await graph.get('search', {
    type: 'adinterest',
    q,
    limit: 20,
  });

  titulo(`Intereses para "${q}"`);
  for (const i of data ?? []) {
    console.log(`  ${String(i.id).padEnd(18)} ${i.name} — ${miles(i.audience_size_lower_bound)} personas`);
  }
}

async function lanzar(args) {
  requireEnv('accessToken', 'adAccountId', 'pageId', 'whatsappNumber');

  const nombre = args.nombre ?? `GoyCaz — diagnostico gratis`;
  const presupuesto = Number(args.presupuesto ?? 10);
  const titular = args.titular ?? 'Diagnostico gratis de 10 minutos';
  const texto =
    args.texto ??
    'Tus clientes escriben de noche y nadie responde hasta el dia siguiente. ' +
      'Instalamos un asistente que contesta en segundos, a cualquier hora. ' +
      'Escribenos y te decimos en 10 minutos si te sirve.';
  const descripcion = args.descripcion ?? 'Software e IA que si llegan a produccion';

  if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
    throw new Error('--presupuesto debe ser un numero de unidades por dia (ej. 10)');
  }

  const cuenta = await graph.get(config.adAccountId, {
    fields: 'currency,account_status',
  });

  if (cuenta.account_status !== 1) {
    throw new Error(
      `La cuenta publicitaria no esta activa (estado ${cuenta.account_status}). ` +
        'Revisa el metodo de pago antes de lanzar.',
    );
  }

  // Meta cobra en unidades menores: 10 USD son 1000.
  const diario = Math.round(presupuesto * 100);

  const geoKey = args.geo ?? (await buscarLima());
  titulo('Creando la campana (todo queda PAUSADO)');

  const campana = await graph.post(`${config.adAccountId}/campaigns`, {
    name: `${nombre} — campana`,
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    special_ad_categories: [],
  });
  ok(`Campana ${campana.id}`);

  const conjunto = await graph.post(`${config.adAccountId}/adsets`, {
    name: `${nombre} — Lima 25-64`,
    campaign_id: campana.id,
    status: 'PAUSED',
    daily_budget: diario,
    billing_event: 'IMPRESSIONS',
    // El par que define "que me escriban por WhatsApp".
    optimization_goal: 'CONVERSATIONS',
    destination_type: 'WHATSAPP',
    promoted_object: { page_id: config.pageId },
    targeting: {
      geo_locations: { cities: [{ key: geoKey, radius: 25, distance_unit: 'kilometer' }] },
      age_min: 25,
      age_max: 64,
      // Publicamos solo donde el clic a WhatsApp funciona bien.
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed', 'story'],
      instagram_positions: ['stream', 'story', 'explore'],
    },
  });
  ok(`Conjunto ${conjunto.id} — ${dinero(diario, cuenta.currency)}/dia`);

  const linkData = {
    message: texto,
    name: titular,
    description: descripcion,
    link: `https://api.whatsapp.com/send?phone=${config.whatsappNumber}`,
    call_to_action: {
      type: 'WHATSAPP_MESSAGE',
      value: { app_destination: 'WHATSAPP' },
    },
  };

  if (args.imagen) {
    linkData.image_hash = await subirImagen(args.imagen);
    ok(`Imagen subida (${basename(args.imagen)})`);
  } else {
    aviso('Sin --imagen: el anuncio queda sin creativo visual y no podra activarse.');
  }

  const storySpec = { page_id: config.pageId, link_data: linkData };
  if (config.instagramId) storySpec.instagram_user_id = config.instagramId;

  const creativo = await graph.post(`${config.adAccountId}/adcreatives`, {
    name: `${nombre} — creativo`,
    object_story_spec: storySpec,
    degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_OUT' } } },
  });
  ok(`Creativo ${creativo.id}`);

  const anuncio = await graph.post(`${config.adAccountId}/ads`, {
    name: `${nombre} — anuncio`,
    adset_id: conjunto.id,
    creative: { creative_id: creativo.id },
    status: 'PAUSED',
  });
  ok(`Anuncio ${anuncio.id}`);

  console.log(
    `\nRevisalo en https://adsmanager.facebook.com/adsmanager/manage/campaigns` +
      `?act=${config.adAccountId.replace('act_', '')}\n` +
      `Cuando estes conforme: npm run ads activar ${campana.id}`,
  );
}

async function listar() {
  requireEnv('accessToken', 'adAccountId');

  const campanas = await getAll(`${config.adAccountId}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,daily_budget,created_time',
  });

  if (!campanas.length) {
    nota('No hay campanas todavia. Crea una con: npm run ads lanzar');
    return;
  }

  titulo(`Campanas (${campanas.length})`);
  for (const c of campanas) {
    const marca = c.effective_status === 'ACTIVE' ? '●' : '○';
    console.log(`  ${marca} ${c.name}`);
    console.log(`    ${c.id} · ${c.effective_status} · ${c.objective}`);
  }
}

async function metricas(args) {
  requireEnv('accessToken', 'adAccountId');

  const preset = args.rango ?? 'last_7d';
  const filas = await getAll(`${config.adAccountId}/insights`, {
    level: 'campaign',
    date_preset: preset,
    fields: 'campaign_name,spend,impressions,reach,clicks,ctr,actions,cost_per_action_type',
  });

  if (!filas.length) {
    nota(`Sin datos en ${preset}. Si recien lanzaste, Meta tarda unas horas.`);
    return;
  }

  titulo(`Resultados — ${preset}`);
  for (const f of filas) {
    // Lo unico que importa para este negocio es cuanto cuesta una conversacion.
    const msgs = accion(f.actions, 'onsite_conversion.total_messaging_connection');
    const costo = accion(f.cost_per_action_type, 'onsite_conversion.total_messaging_connection');

    console.log(`\n  ${f.campaign_name}`);
    console.log(`    Gasto        ${f.spend}`);
    console.log(`    Alcance      ${miles(f.reach)} personas · ${miles(f.impressions)} impresiones`);
    console.log(`    Clics        ${miles(f.clicks)} (CTR ${Number(f.ctr ?? 0).toFixed(2)}%)`);
    console.log(`    Mensajes     ${msgs ?? 0}`);
    console.log(`    Costo/mensaje ${costo ? Number(costo).toFixed(2) : '—'}`);
  }
}

function pausar(args) {
  return cambiarEstado(args, 'PAUSED');
}

function activar(args) {
  return cambiarEstado(args, 'ACTIVE');
}

async function cambiarEstado(args, status) {
  const id = args._[0];
  if (!id) throw new Error('Falta el ID. Sacalo de: npm run ads listar');

  await graph.post(id, { status });
  ok(`${id} ahora esta ${status === 'ACTIVE' ? 'ACTIVA' : 'PAUSADA'}`);

  if (status === 'ACTIVE') {
    nota('Los anuncios y el conjunto tambien deben estar activos para publicar.');
  }
}

// ----------------------------------------------------------------- apoyo

async function buscarLima() {
  const { data } = await graph.get('search', {
    type: 'adgeolocation',
    location_types: ['city'],
    q: 'Lima',
    limit: 10,
  });

  const lima = (data ?? []).find((g) => g.country_code === 'PE');
  if (!lima) {
    throw new Error('No pude resolver Lima. Pasa --geo <clave> (mirala con: npm run ads geo Lima)');
  }

  return lima.key;
}

async function subirImagen(ruta) {
  const bytes = readFileSync(ruta).toString('base64');
  const res = await graph.post(`${config.adAccountId}/adimages`, {
    bytes,
    name: basename(ruta),
  });

  const imagenes = res.images ?? {};
  const primera = Object.values(imagenes)[0];

  if (!primera?.hash) throw new Error('Meta no devolvio el hash de la imagen.');
  return primera.hash;
}

function accion(lista, tipo) {
  return (lista ?? []).find((a) => a.action_type === tipo)?.value;
}

const dinero = (minor, moneda) =>
  `${(Number(minor ?? 0) / 100).toFixed(2)} ${moneda ?? ''}`.trim();
const miles = (n) => Number(n ?? 0).toLocaleString('es-PE');

const titulo = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);
const ok = (t) => console.log(`  ✓ ${t}`);
const aviso = (t) => console.log(`  ! ${t}`);
const nota = (t) => console.log(`\n  ${t}`);

async function intentar(que, fn) {
  try {
    return await fn();
  } catch (e) {
    aviso(`No pude leer ${que}: ${e.message.split('\n')[0]}`);
    return null;
  }
}

// Parser de argumentos: --clave valor, --bandera, y sueltos en _.
function parseArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a.startsWith('--')) {
      const clave = a.slice(2);
      const siguiente = argv[i + 1];

      if (siguiente && !siguiente.startsWith('--')) {
        args[clave] = siguiente;
        i++;
      } else {
        args[clave] = true;
      }
    } else {
      args._.push(a);
    }
  }

  return args;
}

function uso() {
  console.log('\nAnuncios de GoyCaz Labs en Meta\n');
  for (const [nombre, { ayuda }] of Object.entries(COMANDOS)) {
    console.log(`  npm run ads ${nombre.padEnd(10)} ${ayuda}`);
  }
  console.log('\nEjemplo:');
  console.log('  npm run ads lanzar -- --presupuesto 10 --imagen ./creativo.jpg\n');
}

const [, , comando, ...resto] = process.argv;
const elegido = COMANDOS[comando];

if (!elegido) {
  uso();
  process.exit(comando ? 1 : 0);
}

try {
  await elegido.fn(parseArgs(resto));
} catch (e) {
  console.error(`\n  ✗ ${e.message}`);
  if (e instanceof GraphError && e.trace) console.error(`    fbtrace_id: ${e.trace}`);
  process.exit(1);
}
