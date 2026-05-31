const { json, requireAuth, readJson, supabaseFetch, cleanString, toNumber, toDate, writeAudit } = require('../lib/facturacion-common');

function cleanFactura(input) {
  return {
    folio: cleanString(input.folio, 80),
    fecha: toDate(input.fecha),
    cliente_id: cleanString(input.cliente_id, 80) || null,
    oc: cleanString(input.oc, 120),
    codigo_interno: cleanString(input.codigo_interno, 120),
    subtotal: toNumber(input.subtotal),
    iva: toNumber(input.iva),
    total: toNumber(input.total),
    observaciones: cleanString(input.observaciones, 2000),
    estatus: ['Pendiente', 'Validada', 'Archivada'].includes(input.estatus) ? input.estatus : 'Pendiente',
    pdf_url: cleanString(input.pdf_url, 1000),
    xml_url: cleanString(input.xml_url, 1000),
    imagen_url: cleanString(input.imagen_url, 1000)
  };
}

function cleanPartida(input) {
  return {
    descripcion: cleanString(input.descripcion, 1500),
    tipo_banda: cleanString(input.tipo_banda, 180),
    ancho_mm: toNumber(input.ancho_mm),
    longitud_mm: toNumber(input.longitud_mm),
    medidas_internas: cleanString(input.medidas_internas, 180),
    guia: cleanString(input.guia, 180),
    tipo_union: cleanString(input.tipo_union, 180),
    cantidad: toNumber(input.cantidad) || 1,
    precio_unitario: toNumber(input.precio_unitario),
    importe: toNumber(input.importe)
  };
}

function buildListPath(q) {
  const page = Math.max(1, Number(q.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize || 25)));
  const offset = (page - 1) * pageSize;
  const params = [];
  const exact = ['folio', 'oc', 'codigo_interno', 'estatus'];
  exact.forEach((field) => { if (cleanString(q[field], 160)) params.push(`${field}=ilike.${encodeURIComponent(`*${cleanString(q[field], 160)}*`)}`); });
  if (cleanString(q.cliente_id, 80)) params.push(`cliente_id=eq.${encodeURIComponent(cleanString(q.cliente_id, 80))}`);
  if (toDate(q.fecha_inicial)) params.push(`fecha=gte.${toDate(q.fecha_inicial)}`);
  if (toDate(q.fecha_final)) params.push(`fecha=lte.${toDate(q.fecha_final)}`);
  if (toNumber(q.monto_minimo) !== null) params.push(`total=gte.${toNumber(q.monto_minimo)}`);
  if (toNumber(q.monto_maximo) !== null) params.push(`total=lte.${toNumber(q.monto_maximo)}`);
  const search = cleanString(q.q, 180).replace(/[%*]/g, '');
  let path = `/rest/v1/facturas?select=*,clientes(id,nombre,rfc),partidas(id,descripcion,tipo_banda,ancho_mm,longitud_mm,medidas_internas,guia,tipo_union,cantidad,precio_unitario,importe)&order=fecha.desc&limit=${pageSize}&offset=${offset}`;
  if (params.length) path += `&${params.join('&')}`;
  if (search) path += `&fts=plfts.${encodeURIComponent(search)}`;
  return { path, page, pageSize };
}

module.exports = async (req, res) => {
  const needed = req.method === 'GET' ? 'view' : req.method === 'DELETE' ? 'delete' : req.method === 'PATCH' ? 'edit' : 'create';
  const session = requireAuth(req, res, needed);
  if (!session) return;
  try {
    if (req.method === 'GET') {
      const id = cleanString(req.query?.id || '', 80);
      if (id) {
        const { data } = await supabaseFetch(`/rest/v1/facturas?select=*,clientes(*),partidas(*),documentos_factura(*)&id=eq.${encodeURIComponent(id)}&limit=1`);
        return json(res, 200, { ok: true, factura: data && data[0] });
      }
      const { path, page, pageSize } = buildListPath(req.query || {});
      const { data, headers } = await supabaseFetch(path, { headers: { Prefer: 'count=exact' } });
      return json(res, 200, { ok: true, facturas: data || [], page, pageSize, contentRange: headers.get('content-range') });
    }

    const body = await readJson(req);
    if (req.method === 'POST') {
      const factura = cleanFactura(body);
      const partidas = (Array.isArray(body.partidas) ? body.partidas : []).map(cleanPartida).filter((p) => p.descripcion || p.tipo_banda || p.importe !== null);
      if (!factura.folio || !factura.fecha || !factura.cliente_id) return json(res, 400, { ok: false, error: 'folio_fecha_cliente_required' });
      const { data } = await supabaseFetch('/rest/v1/facturas', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(factura)
      });
      const created = data && data[0];
      if (created && partidas.length) {
        await supabaseFetch('/rest/v1/partidas', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(partidas.map((p) => Object.assign({ factura_id: created.id }, p)))
        });
      }
      await writeAudit(session, 'crear', 'facturas', created && created.id, { factura, partidas });
      return json(res, 201, { ok: true, factura: created });
    }
    if (req.method === 'PATCH') {
      const id = cleanString(body.id, 80);
      if (!id) return json(res, 400, { ok: false, error: 'id_required' });
      const factura = cleanFactura(body);
      const { data } = await supabaseFetch(`/rest/v1/facturas?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(factura)
      });
      if (Array.isArray(body.partidas)) {
        await supabaseFetch(`/rest/v1/partidas?factura_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        const partidas = body.partidas.map(cleanPartida).filter((p) => p.descripcion || p.tipo_banda || p.importe !== null);
        if (partidas.length) await supabaseFetch('/rest/v1/partidas', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(partidas.map((p) => Object.assign({ factura_id: id }, p)))
        });
      }
      await writeAudit(session, 'editar', 'facturas', id, body);
      return json(res, 200, { ok: true, factura: data && data[0] });
    }
    if (req.method === 'DELETE') {
      const id = cleanString(body.id, 80);
      if (!id) return json(res, 400, { ok: false, error: 'id_required' });
      await supabaseFetch(`/rest/v1/facturas?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await writeAudit(session, 'eliminar', 'facturas', id, {});
      return json(res, 200, { ok: true });
    }
    json(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    json(res, e.message === 'missing_supabase_env' ? 500 : (e.status || 500), { ok: false, error: e.message, detail: e.data });
  }
};
