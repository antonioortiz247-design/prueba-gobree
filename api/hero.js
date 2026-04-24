const crypto = require('crypto');

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
      const raw = await kv(['GET', 'heroImages']);
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
      res.end(JSON.stringify({ ok: false }));
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
      await kv(['SET', 'heroImages', JSON.stringify(cleaned)]);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: e.message || 'kv_failed' }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false }));
};
