const crypto = require('crypto');
const { createClient } = require('redis');

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function signTs(ts, secret) {
  return base64url(crypto.createHmac('sha256', secret).update(ts).digest());
}

function parseCookies(cookieHeader) {
  const out = {};
  const parts = String(cookieHeader || '').split(';');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function isAdmin(req) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminSecret = process.env.ADMIN_SECRET || adminPassword;
  if (!adminPassword || !adminSecret) return false;

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.gobree_admin;
  if (!token) return false;

  const [ts, sig] = String(token).split('.');
  if (!ts || !sig) return false;

  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 7 * 24 * 60 * 60 * 1000) return false;

  const expected = signTs(ts, adminSecret);
  return safeEqual(sig, expected);
}

async function kv(cmd) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('missing_kv_env');
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cmd)
  });
  const data = await r.json();
  return data.result;
}

let redisClient;
let redisConnecting;

async function getRedisClient() {
  if (redisClient) return redisClient;
  if (redisConnecting) return redisConnecting;

  redisConnecting = (async () => {
    const redisUrl = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST;
    const port = Number(process.env.REDIS_PORT || '');
    const username = process.env.REDIS_USERNAME || process.env.REDIS_USER;
    const password = process.env.REDIS_PASSWORD || process.env.REDIS_PASS;

    if (!redisUrl && !host) throw new Error('missing_redis_env');

    const useTlsEnv = String(process.env.REDIS_TLS || '').toLowerCase();
    const inferredTls =
      (Number.isFinite(port) && port !== 6379) || String(host || '').includes('cloud.redislabs.com');
    const useTls = useTlsEnv ? useTlsEnv === 'true' : inferredTls;

    const client = redisUrl
      ? createClient({ url: redisUrl })
      : createClient({
          username: username || undefined,
          password: password || undefined,
          socket: {
            host,
            port: Number.isFinite(port) ? port : 6379,
            tls: useTls,
            servername: useTls ? host : undefined
          }
        });

    client.on('error', () => {});
    await client.connect();
    redisClient = client;
    return redisClient;
  })();

  return redisConnecting;
}

async function storageGet(key) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) return kv(['GET', key]);

  const client = await getRedisClient();
  return client.get(key);
}

async function storageSet(key, value) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) return kv(['SET', key, value]);

  const client = await getRedisClient();
  return client.set(key, value);
}

function storageBackend() {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  return kvUrl && kvToken ? 'kv' : 'redis';
}

function toPublicStorageError(err) {
  const storage = storageBackend();
  const code = err && err.code ? String(err.code) : '';
  const message = String((err && err.message) || err || '');

  if (message === 'missing_redis_env') {
    return {
      error: 'missing_storage_env',
      storage: 'redis',
      required: ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_USERNAME', 'REDIS_PASSWORD', 'REDIS_TLS']
    };
  }

  if (message === 'missing_kv_env') {
    return {
      error: 'missing_storage_env',
      storage: 'kv',
      required: ['KV_REST_API_URL', 'KV_REST_API_TOKEN']
    };
  }

  const safeDetail =
    message && !/redis(s)?:\/\//i.test(message) && !message.includes('@') ? message.slice(0, 200) : '';

  if (code) {
    return {
      error: 'storage_connection_failed',
      storage,
      code,
      detail: safeDetail || undefined
    };
  }

  return {
    error: 'storage_failed',
    storage,
    detail: safeDetail || undefined
  };
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 200_000) reject(new Error('payload_too_large'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (e) {
        reject(new Error('invalid_json'));
      }
    });
  });
}

const DEFAULT_IMAGES = [
  { url: 'portadagobree.png', alt: 'Línea industrial con bandas transportadoras' },
  { url: 'IndustriaAlimenticia.png', alt: 'Aplicación de bandas en industria alimenticia' },
  { url: 'Logistica.png', alt: 'Sistema de bandas para logística y distribución' }
];

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    let images = DEFAULT_IMAGES;
    try {
      const raw = await storageGet('heroImages');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) images = parsed;
      }
    } catch (e) {}

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    res.end(JSON.stringify({ images }));
    return;
  }

  if (req.method === 'POST') {
    if (!isAdmin(req)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      return;
    }

    let data;
    try {
      data = await readJson(req);
    } catch (e) {
      res.statusCode = e.message === 'payload_too_large' ? 413 : 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: e.message }));
      return;
    }

    const images = Array.isArray(data.images) ? data.images : [];
    const cleaned = images
      .map((img) => ({
        url: String(img.url || '').trim().slice(0, 500),
        alt: String(img.alt || 'Gobree Belt').trim().slice(0, 200)
      }))
      .filter((img) => img.url);

    if (!cleaned.length) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'empty_images' }));
      return;
    }

    try {
      await storageSet('heroImages', JSON.stringify(cleaned));
    } catch (e) {
      const code = e && e.code ? String(e.code) : '';
      const message = String((e && e.message) || '');
      res.statusCode = code || message === 'missing_redis_env' || message === 'missing_kv_env' ? 502 : 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, ...toPublicStorageError(e) }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
};
