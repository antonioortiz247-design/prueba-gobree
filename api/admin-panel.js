const { isAdmin, signTs, sendJSON, getBody } = require('./_db');
const crypto = require('crypto');

function safeEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

module.exports = async (req, res) => {
  const { type } = req.query;

  // --- LOGIN ---
  if (type === 'login' && req.method === 'POST') {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminSecret = process.env.ADMIN_SECRET || adminPassword;
    if (!adminPassword || !adminSecret) {
      return sendJSON(res, { ok: false, error: 'missing_admin_env' }, 500);
    }

    try {
      const data = await getBody(req);
      const password = String(data.password || '');
      if (!safeEqual(password, adminPassword)) {
        return sendJSON(res, { ok: false, error: 'invalid_password' }, 401);
      }
      
      const ts = String(Date.now());
      const sig = signTs(ts, adminSecret);
      const token = `${ts}.${sig}`;
      
      // Cookie simplificada para máxima compatibilidad
      // Quitamos Secure temporalmente por si hay problemas con el SSL del dominio
      res.setHeader('Set-Cookie', [`gobree_admin=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`]);
      return sendJSON(res, { ok: true });
    } catch (e) {
      return sendJSON(res, { ok: false, error: e.message }, 400);
    }
  }

  // --- LOGOUT ---
  if (type === 'logout') {
    res.setHeader('Set-Cookie', ['gobree_admin=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax']);
    return sendJSON(res, { ok: true });
  }

  // --- CHECK ---
  if (type === 'check') {
    const ok = isAdmin(req);
    const cookieHeader = req.headers.cookie || '';
    return sendJSON(res, { 
      ok, 
      has_cookie: cookieHeader.includes('gobree_admin'),
      cookie_preview: cookieHeader ? (cookieHeader.substring(0, 15) + '...') : 'none'
    }, ok ? 200 : 401);
  }

  return sendJSON(res, { error: 'Method Not Allowed' }, 405);
};
