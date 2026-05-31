const { json, requireAuth, supabaseFetch } = require('../lib/facturacion-common');

module.exports = async (req, res) => {
  const session = requireAuth(req, res, 'view');
  if (!session) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const year = new Date().getUTCFullYear();
    const month = String(new Date().getUTCMonth() + 1).padStart(2, '0');
    const [summary, topClientes, topMedidas, topBandas, ultimas, pendientes] = await Promise.all([
      supabaseFetch(`/rest/v1/v_facturacion_dashboard?select=*`).catch(() => ({ data: [] })),
      supabaseFetch(`/rest/v1/v_clientes_frecuentes?select=*&limit=8`).catch(() => ({ data: [] })),
      supabaseFetch(`/rest/v1/v_medidas_mas_vendidas?select=*&limit=8`).catch(() => ({ data: [] })),
      supabaseFetch(`/rest/v1/v_bandas_mas_vendidas?select=*&limit=8`).catch(() => ({ data: [] })),
      supabaseFetch(`/rest/v1/facturas?select=id,folio,fecha,total,estatus,clientes(nombre)&order=created_at.desc&limit=8`).catch(() => ({ data: [] })),
      supabaseFetch(`/rest/v1/facturas?select=id,folio,fecha,total,clientes(nombre)&estatus=eq.Pendiente&order=fecha.desc&limit=8`).catch(() => ({ data: [] }))
    ]);
    const base = summary.data && summary.data[0] ? summary.data[0] : {};
    json(res, 200, { ok: true, year, month, summary: base, topClientes: topClientes.data, topMedidas: topMedidas.data, topBandas: topBandas.data, ultimas: ultimas.data, pendientes: pendientes.data });
  } catch (e) {
    json(res, e.status || 500, { ok: false, error: e.message, detail: e.data });
  }
};
