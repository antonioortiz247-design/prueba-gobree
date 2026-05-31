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
};
