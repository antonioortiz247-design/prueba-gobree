const crypto = require('crypto');

const ROLE_PERMISSIONS = {
  administrador: ['create', 'edit', 'delete', 'import', 'export', 'manage_users', 'audit', 'view', 'download'],
  capturista: ['create', 'edit', 'upload', 'view', 'download'],
  consulta: ['search', 'view', 'download']
};

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function signTs(ts, secret) {
  return base64url(crypto.createHmac('sha256', secret).update(ts).digest());
}

function parseCookies(cookieHeader) {
  const out = {};
  for (const part of String(cookieHeader || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function getSession(req) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminSecret = process.env.ADMIN_SECRET || adminPassword;
  if (!adminPassword || !adminSecret) return null;
  const token = parseCookies(req.headers.cookie).gobree_admin;
  const [ts, sig] = String(token || '').split('.');
  if (!ts || !sig) return null;
  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 7 * 24 * 60 * 60 * 1000) return null;
  if (!safeEqual(sig, signTs(ts, adminSecret))) return null;
  const role = normalizeRole(process.env.GOBREE_FACTURAS_DEFAULT_ROLE || 'administrador');
  return { user: process.env.GOBREE_FACTURAS_USER || 'admin', role, permissions: ROLE_PERMISSIONS[role] || [] };
}

function normalizeRole(role) {
  const value = String(role || '').toLowerCase().trim();
  if (value === 'capturista') return 'capturista';
  if (value === 'consulta') return 'consulta';
  return 'administrador';
}

function requireAuth(req, res, permission) {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  if (permission && !session.permissions.includes(permission) && session.role !== 'administrador') {
    json(res, 403, { ok: false, error: 'forbidden', required: permission });
    return null;
  }
  return session;
}

async function readJson(req, limit = 5_000_000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limit) reject(new Error('payload_too_large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch (e) { reject(new Error('invalid_json')); }
    });
  });
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('missing_supabase_env');
  return { url, key };
}

async function supabaseFetch(path, options = {}) {
  const { url, key } = supabaseConfig();
  const headers = Object.assign({ apikey: key, Authorization: `Bearer ${key}` }, options.headers || {});
  const response = await fetch(`${url}${path}`, Object.assign({}, options, { headers }));
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = text; }
  }
  if (!response.ok) {
    const err = new Error('supabase_request_failed');
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return { data, headers: response.headers, status: response.status };
}

function cleanString(value, max = 500) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDate(value) {
  const text = cleanString(value, 40);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

function eqParam(field, value) {
  const v = cleanString(value, 180);
  return v ? `&${field}=eq.${encodeURIComponent(v)}` : '';
}

function ilikeParam(field, value) {
  const v = cleanString(value, 180).replace(/[%*]/g, '');
  return v ? `&${field}=ilike.${encodeURIComponent(`*${v}*`)}` : '';
}

async function writeAudit(session, action, tableName, recordId, changes) {
  try {
    await supabaseFetch('/rest/v1/audit_logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        usuario: session.user,
        rol: session.role,
        accion: action,
        tabla: tableName,
        registro_id: recordId ? String(recordId) : null,
        cambios: changes || {}
      })
    });
  } catch (e) {}
}

module.exports = {
  ROLE_PERMISSIONS,
  json,
  requireAuth,
  readJson,
  supabaseFetch,
  cleanString,
  toNumber,
  toDate,
  eqParam,
  ilikeParam,
  writeAudit
};
