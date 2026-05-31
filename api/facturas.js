<<<<<<< HEAD
const { supabase, isAdmin } = require('./_supabase');

module.exports = async (req, res) => {
  // Solo administradores pueden acceder
  if (!isAdmin(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
  }

  if (!supabase) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'Supabase no configurado' }));
  }

  // GET: Listar facturas con paginación
  if (req.method === 'GET') {
    const { page = 1, limit = 20, search = '' } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    try {
      let query = supabase
        .from('facturas')
        .select('*, clientes(nombre, rfc)', { count: 'exact' })
        .order('fecha', { ascending: false })
        .range(from, to);

      if (search) {
        // Búsqueda global básica (FTS o ILIKE)
        // Para FTS usamos la columna fts configurada en el esquema
        query = query.textSearch('fts', search, { config: 'spanish', type: 'websearch' });
      }

      const { data, count, error } = await query;

      if (error) throw error;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, data, count }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  // POST: Crear nueva factura y sus partidas
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { partidas, ...facturaData } = JSON.parse(body);
        
        // 1. Insertar Factura
        const { data: factura, error: fError } = await supabase
          .from('facturas')
          .insert([facturaData])
          .select()
          .single();

        if (fError) throw fError;

        // 2. Insertar Partidas si existen
        if (partidas && Array.isArray(partidas) && partidas.length > 0) {
          const partidasConId = partidas.map(p => ({ ...p, factura_id: factura.id }));
          const { error: pError } = await supabase
            .from('partidas')
            .insert(partidasConId);
          
          if (pError) throw pError;
        }

        // 3. Registrar auditoría
        await supabase.from('audit_logs').insert([{
          usuario_email: 'admin',
          accion: 'INSERT',
          tabla_afectada: 'facturas',
          registro_id: factura.id,
          cambios_json: { factura, partidas }
        }]);

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, data: factura }));
      } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
=======
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

function appendCommonFilters(params, q) {
  const textFilters = [
    ['folio', q.folio],
    ['oc', q.oc],
    ['codigo_interno', q.codigo_interno],
    ['estatus', q.estatus]
  ];
  textFilters.forEach(([field, value]) => {
    const clean = cleanString(value, 160).replace(/[%*]/g, '');
    if (clean) params.push(`${field}=ilike.${encodeURIComponent(`*${clean}*`)}`);
  });
  if (cleanString(q.cliente_id, 80)) params.push(`cliente_id=eq.${encodeURIComponent(cleanString(q.cliente_id, 80))}`);
  if (toDate(q.fecha_inicial)) params.push(`fecha=gte.${toDate(q.fecha_inicial)}`);
  if (toDate(q.fecha_final)) params.push(`fecha=lte.${toDate(q.fecha_final)}`);
  if (toNumber(q.monto_minimo) !== null) params.push(`total=gte.${toNumber(q.monto_minimo)}`);
  if (toNumber(q.monto_maximo) !== null) params.push(`total=lte.${toNumber(q.monto_maximo)}`);
}

function hasJoinedFilters(q) {
  return ['q', 'cliente', 'rfc', 'ancho_mm', 'longitud_mm', 'medidas_internas', 'tipo_banda', 'guia', 'observaciones']
    .some((field) => cleanString(q[field], 180));
}

function buildBaseListPath(q, page, pageSize) {
  const offset = (page - 1) * pageSize;
  const params = [];
  appendCommonFilters(params, q);
  let path = `/rest/v1/facturas?select=*,clientes(id,nombre,rfc),partidas(id,descripcion,tipo_banda,ancho_mm,longitud_mm,medidas_internas,guia,tipo_union,cantidad,precio_unitario,importe)&order=fecha.desc&limit=${pageSize}&offset=${offset}`;
  if (params.length) path += `&${params.join('&')}`;
  return path;
}

function rpcSearchPayload(q, page, pageSize) {
  return {
    p_q: cleanString(q.q, 180) || null,
    p_cliente: cleanString(q.cliente, 180) || null,
    p_rfc: cleanString(q.rfc, 40) || null,
    p_folio: cleanString(q.folio, 80) || null,
    p_oc: cleanString(q.oc, 120) || null,
    p_codigo_interno: cleanString(q.codigo_interno, 120) || null,
    p_fecha_inicial: toDate(q.fecha_inicial),
    p_fecha_final: toDate(q.fecha_final),
    p_ancho_mm: toNumber(q.ancho_mm),
    p_longitud_mm: toNumber(q.longitud_mm),
    p_medidas_internas: cleanString(q.medidas_internas, 180) || null,
    p_tipo_banda: cleanString(q.tipo_banda, 180) || null,
    p_guia: cleanString(q.guia, 180) || null,
    p_observaciones: cleanString(q.observaciones, 240) || null,
    p_monto_minimo: toNumber(q.monto_minimo),
    p_monto_maximo: toNumber(q.monto_maximo),
    p_estatus: cleanString(q.estatus, 20) || null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize
  };
}

async function listFacturas(q) {
  const page = Math.max(1, Number(q.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize || 25)));
  const offset = (page - 1) * pageSize;

  if (!hasJoinedFilters(q)) {
    const path = buildBaseListPath(q, page, pageSize);
    const { data, headers } = await supabaseFetch(path, { headers: { Prefer: 'count=exact' } });
    return { facturas: data || [], page, pageSize, contentRange: headers.get('content-range') };
  }

  const matches = await supabaseFetch('/rest/v1/rpc/buscar_facturas_ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rpcSearchPayload(q, page, pageSize))
  });
  const rows = matches.data || [];
  const ids = rows.map((row) => row.id).filter(Boolean);
  const total = rows.length ? Number(rows[0].total_count || rows.length) : 0;
  if (!ids.length) return { facturas: [], page, pageSize, contentRange: `0-0/${total}` };
  const encodedIds = ids.map(encodeURIComponent).join(',');
  const path = `/rest/v1/facturas?select=*,clientes(id,nombre,rfc),partidas(id,descripcion,tipo_banda,ancho_mm,longitud_mm,medidas_internas,guia,tipo_union,cantidad,precio_unitario,importe)&id=in.(${encodedIds})&order=fecha.desc`;
  const { data } = await supabaseFetch(path);
  return { facturas: data || [], page, pageSize, contentRange: `${offset + 1}-${offset + (data || []).length}/${total}` };
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
      const result = await listFacturas(req.query || {});
      return json(res, 200, { ok: true, facturas: result.facturas, page: result.page, pageSize: result.pageSize, contentRange: result.contentRange });
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
>>>>>>> 162ec9440a3749028644442c78d706fb99eee05b
};
