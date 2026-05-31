const { supabase, isAdmin, getBody, sendJSON } = require('./_db');

module.exports = async (req, res) => {
  // Solo administradores pueden acceder a las funciones de facturación
  if (!isAdmin(req)) {
    return sendJSON(res, { ok: false, error: 'unauthorized' }, 401);
  }

  if (!supabase) {
    return sendJSON(res, { ok: false, error: 'Supabase no configurado' }, 500);
  }

  const { type } = req.query;

  try {
    // --- DASHBOARD ---
    if (type === 'dashboard') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [
        { count: totalFacturas },
        { count: totalClientes },
        { data: ventasMes },
        { count: pendientes }
      ] = await Promise.all([
        supabase.from('facturas').select('*', { count: 'exact', head: true }),
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('facturas').select('total').gte('fecha', startOfMonth),
        supabase.from('facturas').select('*', { count: 'exact', head: true }).eq('estatus', 'pendiente')
      ]);
      const sumVentasMes = (ventasMes || []).reduce((acc, f) => acc + (f.total || 0), 0);
      
      return sendJSON(res, {
        ok: true,
        stats: {
          totalFacturas: totalFacturas || 0,
          totalClientes: totalClientes || 0,
          ventasMes: sumVentasMes,
          pendientes: pendientes || 0
        }
      });
    }

    // --- CLIENTES ---
    if (type === 'clientes') {
      if (req.method === 'GET') {
        const { search = '' } = req.query;
        let query = supabase.from('clientes').select('*').order('nombre');
        if (search) {
          // Búsqueda más sensible en nombre o RFC
          query = query.or(`nombre.ilike.%${search}%,rfc.ilike.%${search}%`);
        }
        const { data, error } = await query;
        if (error) throw error;
        return sendJSON(res, { ok: true, data });
      }
      if (req.method === 'POST') {
        const body = await getBody(req);
        // Aseguramos que el id sea removido si viene vacío para que Supabase genere uno nuevo
        const { id, ...newClient } = body;
        const { data, error } = await supabase.from('clientes').insert([newClient]).select();
        if (error) throw error;
        return sendJSON(res, { ok: true, data }, 201);
      }
      if (req.method === 'PATCH') {
        const body = await getBody(req);
        const { id, ...updateData } = body;
        const { data, error } = await supabase.from('clientes').update(updateData).eq('id', id).select();
        if (error) throw error;
        return sendJSON(res, { ok: true, data });
      }
    }

    // --- FACTURAS ---
    if (type === 'facturas') {
      if (req.method === 'GET') {
        const { 
          id, page = 1, limit = 20, search = '', 
          cliente, folio, oc, codigo_interno, 
          fecha_inicial, fecha_final, estatus,
          ancho, longitud, medidas, banda, guia, obs, min, max
        } = req.query;
        
        if (id) {
          const { data, error } = await supabase
            .from('facturas')
            .select('*, clientes(*), partidas(*)')
            .eq('id', id);
          if (error) throw error;
          return sendJSON(res, { ok: true, data });
        }

        const from = (page - 1) * limit;
        
        // Usamos el RPC para una búsqueda mucho más potente y sensible (Full Text Search + ILIKE)
        const { data: searchResults, error: rpcError } = await supabase.rpc('buscar_facturas_ids', {
          p_q: search || null,
          p_cliente: cliente || null,
          p_folio: folio || null,
          p_oc: oc || null,
          p_codigo_interno: codigo_interno || null,
          p_fecha_inicial: fecha_inicial || null,
          p_fecha_final: fecha_final || null,
          p_ancho_mm: ancho ? parseFloat(ancho) : null,
          p_longitud_mm: longitud ? parseFloat(longitud) : null,
          p_medidas_internas: medidas || null,
          p_tipo_banda: banda || null,
          p_guia: guia || null,
          p_observaciones: obs || null,
          p_monto_minimo: min ? parseFloat(min) : null,
          p_monto_maximo: max ? parseFloat(max) : null,
          p_estatus: estatus || null,
          p_limit: parseInt(limit),
          p_offset: from
        });

        if (rpcError) throw rpcError;

        if (!searchResults || searchResults.length === 0) {
          return sendJSON(res, { ok: true, data: [], count: 0 });
        }

        const ids = searchResults.map(r => r.id);
        const totalCount = searchResults[0].total_count;

        // Ahora obtenemos el detalle completo de esas facturas
        const { data: fullData, error: fetchError } = await supabase
          .from('facturas')
          .select('*, clientes(nombre, rfc), partidas(*)')
          .in('id', ids)
          .order('fecha', { ascending: false });

        if (fetchError) throw fetchError;

        return sendJSON(res, { ok: true, data: fullData, count: totalCount });
      }
      if (req.method === 'POST') {
        const body = await getBody(req);
        const { id, partidas, ...facturaData } = body;
        
        // Limpiar facturaData para evitar errores de ID vacío
        if (facturaData.id === "") delete facturaData.id;

        const { data: factura, error: fError } = await supabase
          .from('facturas')
          .insert([facturaData])
          .select()
          .single();
        if (fError) throw fError;
        if (partidas && Array.isArray(partidas) && partidas.length > 0) {
          const partidasConId = partidas.map(p => ({ ...p, factura_id: factura.id }));
          const { error: pError } = await supabase.from('partidas').insert(partidasConId);
          if (pError) throw pError;
        }
        await supabase.from('audit_logs').insert([{
          usuario_email: 'admin',
          accion: 'INSERT',
          tabla_afectada: 'facturas',
          registro_id: factura.id,
          cambios_json: { factura, partidas }
        }]);
        return sendJSON(res, { ok: true, data: factura }, 201);
      }
      if (req.method === 'PATCH') {
        const body = await getBody(req);
        const { id, partidas, ...facturaData } = body;
        const { data: factura, error: fError } = await supabase
          .from('facturas')
          .update(facturaData)
          .eq('id', id)
          .select()
          .single();
        if (fError) throw fError;
        if (partidas && Array.isArray(partidas)) {
          await supabase.from('partidas').delete().eq('factura_id', id);
          if (partidas.length > 0) {
            const partidasConId = partidas.map(p => ({ ...p, factura_id: id }));
            const { error: pError } = await supabase.from('partidas').insert(partidasConId);
            if (pError) throw pError;
          }
        }
        await supabase.from('audit_logs').insert([{
          usuario_email: 'admin',
          accion: 'UPDATE',
          tabla_afectada: 'facturas',
          registro_id: id,
          cambios_json: { factura, partidas }
        }]);
        return sendJSON(res, { ok: true, data: factura });
      }
    }

    // --- AUDITORIA ---
    if (type === 'auditoria') {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(100);
      if (error) throw error;
      return sendJSON(res, { ok: true, data });
    }

    return sendJSON(res, { ok: false, error: 'Invalid type or method' }, 400);

  } catch (e) {
    return sendJSON(res, { ok: false, error: e.message }, 500);
  }
};
