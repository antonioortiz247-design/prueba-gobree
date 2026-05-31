const { isAdmin } = require('./_supabase');
const crypto = require('crypto');

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

module.exports = async (req, res) => {
  const { type } = req.query;

  // --- LOGIN ---
  if (type === 'login' && req.method === 'POST') {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminSecret = process.env.ADMIN_SECRET || adminPassword;
    if (!adminPassword || !adminSecret) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: 'missing_admin_env' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const password = String(data.password || '');
        if (!safeEqual(password, adminPassword)) {
          res.statusCode = 401;
          return res.end(JSON.stringify({ ok: false }));
        }
        const ts = String(Date.now());
        const sig = signTs(ts, adminSecret);
        const token = `${ts}.${sig}`;
        res.setHeader('Set-Cookie', [`gobree_admin=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`]);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }

  // --- LOGOUT ---
  if (type === 'logout') {
    res.setHeader('Set-Cookie', ['gobree_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax']);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  }

  // --- CHECK ---
  if (type === 'check') {
    const ok = isAdmin(req);
    res.statusCode = ok ? 200 : 401;
    return res.end(JSON.stringify({ ok }));
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
};
