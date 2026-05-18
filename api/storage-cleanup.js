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

function getQueryParam(url, key) {
  const u = String(url || '');
  const qIndex = u.indexOf('?');
  if (qIndex === -1) return '';
  const query = u.slice(qIndex + 1);
  const parts = query.split('&');
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k === key) {
      try {
        return decodeURIComponent(v || '');
      } catch (e) {
        return String(v || '');
      }
    }
  }
  return '';
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

function usingKvForStructuredData() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function extractMediaIdsFromText(text, outSet) {
  const s = String(text || '');
  const re = /\/api\/media\?id=([A-Za-z0-9_-]+)/g;
  for (;;) {
    const match = re.exec(s);
    if (!match) break;
    outSet.add(match[1]);
  }
}

async function scanKvKeys(maxKeys) {
  const keys = [];
  let cursor = '0';
  const limit = Number.isFinite(Number(maxKeys)) ? Number(maxKeys) : 20000;

  for (let i = 0; i < 200; i++) {
    const result = await kv(['SCAN', cursor, 'MATCH', '*', 'COUNT', 500]);
    const nextCursor = result && result[0] != null ? String(result[0]) : '0';
    const batch = result && Array.isArray(result[1]) ? result[1] : [];
    for (const k of batch) {
      keys.push(String(k));
      if (keys.length >= limit) return { keys, truncated: true };
    }
    cursor = nextCursor;
    if (cursor === '0') break;
  }

  return { keys, truncated: false };
}

async function scanRedisKeys(client, pattern, maxKeys) {
  const keys = [];
  let cursor = '0';
  const limit = Number.isFinite(Number(maxKeys)) ? Number(maxKeys) : 50000;

  for (let i = 0; i < 400; i++) {
    const result = await client.scan(cursor, { MATCH: pattern || '*', COUNT: 500 });
    cursor = result && result.cursor != null ? String(result.cursor) : '0';
    const batch = result && Array.isArray(result.keys) ? result.keys : [];
    for (const k of batch) {
      keys.push(String(k));
      if (keys.length >= limit) return { keys, truncated: true };
    }
    if (cursor === '0') break;
  }

  return { keys, truncated: false };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  if (!isAdmin(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
    return;
  }

  const confirm = String(getQueryParam(req.url, 'confirm') || '').toLowerCase();
  const shouldDelete = confirm === 'true' || confirm === '1' || confirm === 'yes';
  const maxKeys = Number(getQueryParam(req.url, 'maxKeys') || 0) || undefined;

  const keepKv = new Set(['heroImages', 'projectsCards', 'catalogProducts']);
  const referencedMediaIds = new Set();

  let heroRaw = '';
  let projectsRaw = '';
  let productsRaw = '';

  try {
    heroRaw = (await storageGet('heroImages')) || '';
  } catch (e) {}
  try {
    projectsRaw = (await storageGet('projectsCards')) || '';
  } catch (e) {}
  try {
    productsRaw = (await storageGet('catalogProducts')) || '';
  } catch (e) {}

  try {
    const hero = JSON.parse(heroRaw || '[]');
    if (Array.isArray(hero)) {
      hero.forEach((img) => {
        extractMediaIdsFromText(img && img.url, referencedMediaIds);
      });
    }
  } catch (e) {}

  try {
    const projects = JSON.parse(projectsRaw || '[]');
    if (Array.isArray(projects)) {
      projects.forEach((p) => {
        extractMediaIdsFromText(p && p.mediaSrc, referencedMediaIds);
        extractMediaIdsFromText(p && p.mediaPoster, referencedMediaIds);
      });
    }
  } catch (e) {}

  try {
    const products = JSON.parse(productsRaw || '[]');
    if (Array.isArray(products)) {
      products.forEach((p) => {
        extractMediaIdsFromText(p && p.img, referencedMediaIds);
      });
    }
  } catch (e) {}

  const keepRedis = new Set();
  referencedMediaIds.forEach((id) => {
    keepRedis.add(`media:${id}`);
    keepRedis.add(`mediaMeta:${id}`);
  });

  const usesKv = usingKvForStructuredData();
  if (!usesKv) {
    keepRedis.add('heroImages');
    keepRedis.add('projectsCards');
    keepRedis.add('catalogProducts');
  }

  const report = {
    ok: true,
    mode: shouldDelete ? 'delete' : 'dryRun',
    keep: {
      kv: Array.from(keepKv),
      redis: Array.from(keepRedis)
    },
    referencedMedia: {
      idsCount: referencedMediaIds.size,
      sampleIds: Array.from(referencedMediaIds).slice(0, 10)
    },
    kv: null,
    redis: null
  };

  const kvAvailable = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (kvAvailable) {
    let kvKeys = [];
    let truncated = false;
    try {
      const scanned = await scanKvKeys(maxKeys || 20000);
      kvKeys = scanned.keys;
      truncated = scanned.truncated;
    } catch (e) {
      report.kv = { ok: false, error: 'kv_scan_failed' };
      kvKeys = [];
    }

    const toDelete = kvKeys.filter((k) => !keepKv.has(k));
    report.kv = {
      ok: true,
      totalKeys: kvKeys.length,
      deleteCount: toDelete.length,
      truncated,
      deleteSample: toDelete.slice(0, 50)
    };

    if (shouldDelete && toDelete.length) {
      const deleted = [];
      const failed = [];
      for (const key of toDelete) {
        try {
          await kv(['DEL', key]);
          deleted.push(key);
        } catch (e) {
          failed.push(key);
        }
      }
      report.kv.deletedCount = deleted.length;
      report.kv.failedCount = failed.length;
      report.kv.failedSample = failed.slice(0, 50);
    }
  }

  let redisAvailable = false;
  let client;
  try {
    client = await getRedisClient();
    redisAvailable = true;
  } catch (e) {
    redisAvailable = false;
  }

  if (redisAvailable) {
    let redisKeys = [];
    let truncated = false;
    try {
      const scanned = await scanRedisKeys(client, '*', maxKeys || 50000);
      redisKeys = scanned.keys;
      truncated = scanned.truncated;
    } catch (e) {
      report.redis = { ok: false, error: 'redis_scan_failed' };
      redisKeys = [];
    }

    const toDelete = redisKeys.filter((k) => !keepRedis.has(k));
    report.redis = {
      ok: true,
      totalKeys: redisKeys.length,
      deleteCount: toDelete.length,
      truncated,
      deleteSample: toDelete.slice(0, 50)
    };

    if (shouldDelete && toDelete.length) {
      const deleted = [];
      const failed = [];
      for (const key of toDelete) {
        try {
          await client.del(key);
          deleted.push(key);
        } catch (e) {
          failed.push(key);
        }
      }
      report.redis.deletedCount = deleted.length;
      report.redis.failedCount = failed.length;
      report.redis.failedSample = failed.slice(0, 50);
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(report));
};

