const { json, requireAuth, readJson, supabaseFetch, cleanString, toNumber, writeAudit } = require('../lib/facturacion-common');

function attr(xml, name) {
  const re = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  const match = xml.match(re);
  return match ? match[1] : '';
}
function tagBlock(xml, tag) {
  const re = new RegExp(`<[^:>]*:?${tag}\\b([^>]*)>`, 'i');
  const match = xml.match(re);
  return match ? match[1] : '';
}
function parseCfdi(xml) {
  const comprobante = tagBlock(xml, 'Comprobante');
  const receptor = tagBlock(xml, 'Receptor');
  const impuestos = tagBlock(xml, 'Impuestos');
  return {
    cliente: cleanString(attr(receptor, 'Nombre'), 220),
    rfc: cleanString(attr(receptor, 'Rfc') || attr(receptor, 'RFC'), 20).toUpperCase(),
    fecha: cleanString(attr(comprobante, 'Fecha'), 40).slice(0, 10),
    folio: cleanString(attr(comprobante, 'Folio') || `${attr(comprobante, 'Serie')}-${attr(comprobante, 'Folio')}`, 80).replace(/^-|-$/g, ''),
    subtotal: toNumber(attr(comprobante, 'SubTotal') || attr(comprobante, 'subtotal')),
    iva: toNumber(attr(impuestos, 'TotalImpuestosTrasladados')),
    total: toNumber(attr(comprobante, 'Total') || attr(comprobante, 'total'))
  };
}

module.exports = async (req, res) => {
  const session = requireAuth(req, res, 'import');
  if (!session) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const body = await readJson(req, 10_000_000);
    const xml = Buffer.from(String(body.base64 || '').split(',').pop() || '', body.base64 ? 'base64' : 'utf8').toString('utf8') || String(body.xml || '');
    if (!xml.trim()) return json(res, 400, { ok: false, error: 'xml_required' });
    const parsed = parseCfdi(xml);
    if (!parsed.folio || !parsed.fecha || !parsed.cliente) return json(res, 400, { ok: false, error: 'xml_missing_required_fields', parsed });

    let clienteId;
    if (parsed.rfc) {
      const found = await supabaseFetch(`/rest/v1/clientes?select=id,nombre,rfc&rfc=eq.${encodeURIComponent(parsed.rfc)}&limit=1`);
      clienteId = found.data && found.data[0] && found.data[0].id;
    }
    if (!clienteId) {
      const createdClient = await supabaseFetch('/rest/v1/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ nombre: parsed.cliente, rfc: parsed.rfc })
      });
      clienteId = createdClient.data && createdClient.data[0] && createdClient.data[0].id;
    }
    const createdFactura = await supabaseFetch('/rest/v1/facturas', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ folio: parsed.folio, fecha: parsed.fecha, cliente_id: clienteId, subtotal: parsed.subtotal, iva: parsed.iva, total: parsed.total, estatus: 'Pendiente', observaciones: 'Importada desde XML' })
    });
    const factura = createdFactura.data && createdFactura.data[0];
    await writeAudit(session, 'importar_xml', 'facturas', factura && factura.id, parsed);
    json(res, 201, { ok: true, parsed, factura });
  } catch (e) {
    json(res, e.message === 'missing_supabase_env' ? 500 : (e.status || 500), { ok: false, error: e.message, detail: e.data });
  }
};
