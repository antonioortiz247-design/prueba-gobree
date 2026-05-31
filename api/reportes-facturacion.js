const { json, requireAuth, supabaseFetch, cleanString } = require('../lib/facturacion-common');

const views = {
  ventas_anio: 'v_ventas_por_anio',
  ventas_mes: 'v_ventas_por_mes',
  ventas_cliente: 'v_ventas_por_cliente',
  facturas_cliente: 'v_facturas_por_cliente',
  medidas: 'v_medidas_mas_vendidas',
  bandas: 'v_bandas_mas_vendidas',
  clientes_frecuentes: 'v_clientes_frecuentes',
  capturadas_usuario: 'v_facturas_por_usuario'
};

function csv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((row) => cols.map((c) => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
}

module.exports = async (req, res) => {
  const format = cleanString(req.query?.format || 'json', 20);
  const session = requireAuth(req, res, format === 'json' ? 'view' : 'export');
  if (!session) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const tipo = cleanString(req.query?.tipo || 'ventas_mes', 60);
  const view = views[tipo] || views.ventas_mes;
  try {
    const { data } = await supabaseFetch(`/rest/v1/${view}?select=*&limit=5000`);
    if (format === 'csv' || format === 'excel') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tipo}.csv"`);
      return res.end(csv(data || []));
    }
    if (format === 'pdf') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(`<html><body><h1>Reporte ${tipo}</h1><pre>${JSON.stringify(data || [], null, 2)}</pre><script>window.print()</script></body></html>`);
    }
    json(res, 200, { ok: true, tipo, rows: data || [] });
  } catch (e) {
    json(res, e.status || 500, { ok: false, error: e.message, detail: e.data });
  }
};
