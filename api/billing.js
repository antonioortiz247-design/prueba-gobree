const { supabase, isAdmin } = require('./_supabase');

module.exports = async (req, res) => {
  // Solo administradores pueden acceder a las funciones de facturación
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
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        ok: true,
        stats: {
          totalFacturas: totalFacturas || 0,
          totalClientes: totalClientes || 0,
          ventasMes: sumVentasMes,
          pendientes: pendientes || 0
        }
      }));
    }

    // --- CLIENTES ---
    if (type === 'clientes') {
      if (req.method === 'GET') {
        const { search = '' } = req.query;
        let query = supabase.from('clientes').select('*').order('nombre');
        if (search) query = query.ilike('nombre', `%${search}%`);
        const { data, error } = await query;
        if (error) throw error;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, data }));
      }
      if (req.method === 'POST') {
        const body = await getBody(req);
        const { data, error } = await supabase.from('clientes').insert([body]).select();
        if (error) throw error;
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, data }));
      }
    }

    // --- FACTURAS ---
    if (type === 'facturas') {
      if (req.method === 'GET') {
        const { page = 1, limit = 20, search = '' } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        let query = supabase
          .from('facturas')
          .select('*, clientes(nombre, rfc)', { count: 'exact' })
          .order('fecha', { ascending: false })
          .range(from, to);
        if (search) query = query.textSearch('fts', search, { config: 'spanish', type: 'websearch' });
        const { data, count, error } = await query;
        if (error) throw error;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, data, count }));
      }
      if (req.method === 'POST') {
        const body = await getBody(req);
        const { partidas, ...facturaData } = body;
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
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, data: factura }));
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
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, data }));
    }

    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: 'Invalid type or method' }));

  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};

async function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
  });
}
