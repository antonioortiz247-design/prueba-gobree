const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// 1. Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// 2. Utilidades de Autenticación (Reutilizadas de admin-check.js)
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

module.exports = {
  supabase,
  isAdmin,
  parseCookies
};
