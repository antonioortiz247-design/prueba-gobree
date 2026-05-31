const { json, requireAuth, readJson, supabaseFetch, cleanString, writeAudit } = require('../lib/facturacion-common');

function cleanCliente(input) {
  return {
    nombre: cleanString(input.nombre, 220),
    rfc: cleanString(input.rfc, 20).toUpperCase(),
    direccion: cleanString(input.direccion, 500),
    telefono: cleanString(input.telefono, 60),
    email: cleanString(input.email, 180),
    contacto_principal: cleanString(input.contacto_principal, 180),
    notas: cleanString(input.notas, 1000)
  };
}

module.exports = async (req, res) => {
  const session = requireAuth(req, res, req.method === 'GET' ? 'view' : req.method === 'DELETE' ? 'delete' : req.method === 'PATCH' ? 'edit' : 'create');
  if (!session) return;
  try {
    if (req.method === 'GET') {
      const q = cleanString(req.query?.q || '', 120).replace(/[%*]/g, '');
      const id = cleanString(req.query?.id || '', 80);
      let path = '/rest/v1/clientes?select=*,facturas(id,total,fecha,folio)&order=nombre.asc&limit=100';
      if (id) path = `/rest/v1/clientes?select=*,facturas(id,total,fecha,folio,oc,codigo_interno)&id=eq.${encodeURIComponent(id)}&limit=1`;
      else if (q) path += `&or=(nombre.ilike.${encodeURIComponent(`*${q}*`)},rfc.ilike.${encodeURIComponent(`*${q}*`)})`;
      const { data } = await supabaseFetch(path);
      return json(res, 200, { ok: true, clientes: data || [] });
    }

    const body = await readJson(req);
    if (req.method === 'POST') {
      const cliente = cleanCliente(body);
      if (!cliente.nombre) return json(res, 400, { ok: false, error: 'nombre_required' });
      const { data } = await supabaseFetch('/rest/v1/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(cliente)
      });
      await writeAudit(session, 'crear', 'clientes', data && data[0] && data[0].id, cliente);
      return json(res, 201, { ok: true, cliente: data && data[0] });
    }
    if (req.method === 'PATCH') {
      const id = cleanString(body.id, 80);
      if (!id) return json(res, 400, { ok: false, error: 'id_required' });
      const cliente = cleanCliente(body);
      const { data } = await supabaseFetch(`/rest/v1/clientes?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(cliente)
      });
      await writeAudit(session, 'editar', 'clientes', id, cliente);
      return json(res, 200, { ok: true, cliente: data && data[0] });
    }
    if (req.method === 'DELETE') {
      const id = cleanString(body.id, 80);
      if (!id) return json(res, 400, { ok: false, error: 'id_required' });
      await supabaseFetch(`/rest/v1/clientes?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await writeAudit(session, 'eliminar', 'clientes', id, {});
      return json(res, 200, { ok: true });
    }
    json(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    json(res, e.message === 'missing_supabase_env' ? 500 : (e.status || 500), { ok: false, error: e.message, detail: e.data });
  }
};
