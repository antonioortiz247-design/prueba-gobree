const { supabase, isAdmin } = require('./_supabase');

module.exports = async (req, res) => {
  if (!isAdmin(req)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
  }

  if (!supabase) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'Supabase no configurado' }));
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(100);

      if (error) throw error;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, data }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
};
