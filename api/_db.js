const { createClient: createSupabase } = require('@supabase/supabase-js');
const { createClient: createRedis } = require('redis');

// --- SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) supabase = createSupabase(supabaseUrl, supabaseKey);

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
  return data.result;
}

async function getRedisClient() {
  if (redisClient) return redisClient;
  if (redisConnecting) return redisConnecting;
  redisConnecting = (async () => {
    const redisUrl = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST;
    const port = Number(process.env.REDIS_PORT || 6379);
    const username = process.env.REDIS_USERNAME || process.env.REDIS_USER;
    const password = process.env.REDIS_PASSWORD || process.env.REDIS_PASS;
    if (!redisUrl && !host) throw new Error('missing_redis_env');
    const useTls = process.env.REDIS_TLS === 'true' || (port !== 6379) || String(host || '').includes('cloud.redislabs.com');
    const client = redisUrl ? createRedis({ url: redisUrl }) : createRedis({
      username: username || undefined, password: password || undefined,
      socket: { host, port, tls: useTls, servername: useTls ? host : undefined }
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
  if (kvUrl && process.env.KV_REST_API_TOKEN) return kv(['GET', key]);
  const client = await getRedisClient();
  return client.get(key);
}

async function storageSet(key, value) {
  const kvUrl = process.env.KV_REST_API_URL;
  if (kvUrl && process.env.KV_REST_API_TOKEN) return kv(['SET', key, value]);
  const client = await getRedisClient();
  return client.set(key, value);
}

async function storageKeys(pattern) {
  const kvUrl = process.env.KV_REST_API_URL;
  if (kvUrl && process.env.KV_REST_API_TOKEN) return kv(['KEYS', pattern]);
  const client = await getRedisClient();
  return client.keys(pattern);
}

async function storageDel(key) {
  const kvUrl = process.env.KV_REST_API_URL;
  if (kvUrl && process.env.KV_REST_API_TOKEN) return kv(['DEL', key]);
  const client = await getRedisClient();
  return client.del(key);
}

// --- AUTH ---
function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(p => {
    const [k, v] = p.split('=');
    if (k && v) out[k.trim()] = decodeURIComponent(v.trim());
  });
  return out;
}

function isAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET || pass;
  if (!pass || !secret) return false;
  const { gobree_admin: token } = parseCookies(req.headers.cookie);
  if (!token) return false;
  const [ts, sig] = token.split('.');
  if (!ts || !sig) return false;
  const age = Date.now() - Number(ts);
  if (age < 0 || age > 7 * 24 * 60 * 60 * 1000) return false;
  const expected = require('crypto').createHmac('sha256', secret).update(ts).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return sig === expected;
}

async function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 5_000_000) reject('large'); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject('json'); } });
  });
}

module.exports = { supabase, isAdmin, storageGet, storageSet, storageKeys, storageDel, getBody };
