const crypto = require('crypto');
const { createClient, commandOptions } = require('redis');

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

async function readRaw(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('payload_too_large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => reject(new Error('read_failed')));
  });
}

function safeFilename(name) {
  const raw = String(name || '').slice(0, 120);
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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

  let client;
  try {
    client = await getRedisClient();
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        error: 'missing_storage_env',
        storage: 'redis',
        required: ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_USERNAME', 'REDIS_PASSWORD', 'REDIS_TLS']
      })
    );
    return;
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType || (!contentType.startsWith('image/') && !contentType.startsWith('video/'))) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'invalid_content_type' }));
    return;
  }

  const maxBytes = contentType.startsWith('video/') ? 12_000_000 : 8_000_000;
  let body;
  try {
    body = await readRaw(req, maxBytes);
  } catch (e) {
    res.statusCode = e.message === 'payload_too_large' ? 413 : 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: e.message }));
    return;
  }

  if (!body || !body.length) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'empty_body' }));
    return;
  }

  const filenameHeader = req.headers['x-filename'];
  let filename;
  try {
    filename = safeFilename(decodeURIComponent(String(filenameHeader || 'media')));
  } catch (e) {
    filename = safeFilename(String(filenameHeader || 'media'));
  }

  const id = base64url(crypto.randomBytes(16));
  const dataKey = `media:${id}`;
  const metaKey = `mediaMeta:${id}`;
  const meta = JSON.stringify({ filename, contentType, size: body.length, createdAt: Date.now() });

  try {
    await client.set(dataKey, body);
    await client.set(metaKey, meta);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'storage_failed' }));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, id, url: `/api/media?id=${id}` }));
};
