const { json, requireAuth } = require('../lib/facturacion-common');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const session = requireAuth(req, res, 'view');
  if (!session) return;
  json(res, 200, { ok: true, session });
};
