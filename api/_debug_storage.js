const { storageKeys, isAdmin } = require('./_db');

module.exports = async (req, res) => {
  // Solo para admin para no exponer datos
  if (!isAdmin(req)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'unauthorized' }));
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
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      envs,
      keys_found: keys.length,
      keys: keys.sort()
    }, null, 2));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};
