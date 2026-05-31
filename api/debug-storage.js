const { storageKeys, isAdmin } = require('./_db');

module.exports = async (req, res) => {
  // Intentar isAdmin pero permitir acceso si hay un query param secreto para debug
  const isAuthorized = isAdmin(req) || req.query.secret === 'gobree_debug_2026';
  
  if (!isAuthorized) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ 
      error: 'unauthorized', 
      message: 'Debes iniciar sesión en /admin o usar el secreto de debug' 
    }));
  }

  try {
    const keys = await storageKeys('*');
    const envs = {
      has_redis_url: !!process.env.REDIS_URL,
      has_redis_host: !!process.env.REDIS_HOST,
      has_kv_url: !!process.env.KV_REST_API_URL,
      has_supabase: !!process.env.SUPABASE_URL,
      node_env: process.env.NODE_ENV,
      vercel_env: process.env.VERCEL_ENV
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: true,
      envs,
      keys_found: keys.length,
      keys: keys.sort()
    }, null, 2));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};
