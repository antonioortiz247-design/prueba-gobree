const { supabase, isAdmin } = require('./_supabase');

module.exports = async (req, res) => {
  if (!isAdmin(req)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
  }

  if (!supabase) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'Supabase no configurado' }));
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

    // Consultas en paralelo para el dashboard
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
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};
