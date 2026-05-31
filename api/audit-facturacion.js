const { json, requireAuth, supabaseFetch } = require('../lib/facturacion-common');

module.exports = async (req, res) => {
  const session = requireAuth(req, res, 'audit');
  if (!session) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const { data } = await supabaseFetch('/rest/v1/audit_logs?select=*&order=fecha.desc&limit=100');
    json(res, 200, { ok: true, logs: data || [] });
  } catch (e) {
    json(res, e.status || 500, { ok: false, error: e.message, detail: e.data });
  }
};
