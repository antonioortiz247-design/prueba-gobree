const { createClient: createSupabase } = require('@supabase/supabase-js');
const { createClient: createRedis, commandOptions } = require('redis');
const crypto = require('crypto');

// --- SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createSupabase(supabaseUrl, supabaseKey);
}

// --- REDIS / KV ---
let redisClient;
let redisConnecting;

async function kv(cmd) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('missing_kv_env');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function getRedisClient() {
  if (redisClient) return redisClient;
  if (redisConnecting) return redisConnecting;
  redisConnecting = (async () => {
    try {
      const redisUrl = process.env.REDIS_URL;
      const host = process.env.REDIS_HOST;
      const port = Number(process.env.REDIS_PORT || 6379);
      const username = process.env.REDIS_USERNAME || process.env.REDIS_USER;
      const password = process.env.REDIS_PASSWORD || process.env.REDIS_PASS;

      if (!redisUrl && !host) return null;

      const useTls = process.env.REDIS_TLS === 'true' || 
                     (port !== 6379 && process.env.REDIS_TLS !== 'false') || 
                     String(host || '').includes('cloud.redislabs.com');
      
      const client = redisUrl ? createRedis({ url: redisUrl }) : createRedis({
        username: username || undefined,
        password: password || undefined,
        socket: { 
          host, 
          port, 
          tls: useTls, 
          servername: useTls ? host : undefined,
          reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
        }
      });

      client.on('error', (err) => console.error('Redis Error:', err));
      await client.connect();
      redisClient = client;
      return redisClient;
    } catch (e) {
      console.error('Redis Connection Error:', e);
      redisConnecting = null;
      return null;
    }
  })();
  return redisConnecting;
}

async function storageGet(key) {
  let res = null;
  const client = await getRedisClient();
  if (client) {
    try {
      res = await client.get(key);
      if (res !== null) return res;
    } catch (e) {
      console.error(`Redis Get Error (${key}):`, e);
    }
  }

  const kvUrl = process.env.KV_REST_API_URL;
  if (kvUrl && process.env.KV_REST_API_TOKEN) {
    try {
      const kvRes = await kv(['GET', key]);
      return typeof kvRes === 'string' ? kvRes : (kvRes ? JSON.stringify(kvRes) : null);
    } catch (e) {
      console.error(`KV Get Error (${key}):`, e);
    }
  }
  return null;
}

async function storageGetBuffer(key) {
  let res = null;
  const client = await getRedisClient();
  if (client) {
    try {
      res = await client.get(commandOptions({ returnBuffers: true }), key);
      if (res !== null) return res;
    } catch (e) {
      console.error(`Redis GetBuffer Error (${key}):`, e);
    }
  }

  const kvUrl = process.env.KV_REST_API_URL;
  if (kvUrl && process.env.KV_REST_API_TOKEN) {
    try {
      const kvRes = await kv(['GET', key]);
      if (kvRes) return Buffer.from(kvRes, 'base64');
    } catch (e) {
      console.error(`KV GetBuffer Error (${key}):`, e);
    }
  }
  return null;
}

async function storageSet(key, value) {
  const client = await getRedisClient();
  if (client) return await client.set(key, value);

  const kvUrl = process.env.KV_REST_API_URL;
  if (kvUrl && process.env.KV_REST_API_TOKEN) {
    const val = Buffer.isBuffer(value) ? value.toString('base64') : value;
    return kv(['SET', key, val]);
  }
  throw new Error('no_storage_configured');
}

async function storageKeys(pattern) {
  const client = await getRedisClient();
  if (client) return await client.keys(pattern);

  const kvUrl = process.env.KV_REST_API_URL;
  if (kvUrl && process.env.KV_REST_API_TOKEN) return kv(['KEYS', pattern]);
  return [];
}

async function storageDel(key) {
  const client = await getRedisClient();
  if (client) return await client.del(key);

  const kvUrl = process.env.KV_REST_API_URL;
  if (kvUrl && process.env.KV_REST_API_TOKEN) return kv(['DEL', key]);
  return 0;
}

// --- UTILS ---
function sendJSON(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 10_000_000) reject(new Error('Payload too large')); });
    req.on('end', () => { 
      try { 
        resolve(JSON.parse(body || '{}')); 
      } catch (e) { 
        reject(new Error('Invalid JSON')); 
      } 
    });
  });
}

// --- AUTH ---
function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(p => {
    const parts = p.split('=');
    if (parts.length >= 2) {
      const k = parts[0].trim();
      const v = parts.slice(1).join('=').trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signTs(ts, secret) {
  return base64url(crypto.createHmac('sha256', secret).update(ts).digest());
}

function isAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET || pass;
  if (!pass || !secret) return false;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.gobree_admin;
  if (!token) return false;
  const [ts, sig] = token.split('.');
  if (!ts || !sig) return false;
  const age = Date.now() - Number(ts);
  if (age < 0 || age > 7 * 24 * 60 * 60 * 1000) return false;
  const expected = signTs(ts, secret);
  return sig === expected;
}

module.exports = { 
  supabase, 
  isAdmin, 
  signTs, 
  storageGet, 
  storageGetBuffer, 
  storageSet, 
  storageKeys, 
  storageDel, 
  getBody,
  sendJSON
};
