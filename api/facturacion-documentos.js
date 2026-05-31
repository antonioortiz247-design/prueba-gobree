const { json, requireAuth, readJson, supabaseFetch, cleanString, writeAudit } = require('../lib/facturacion-common');

const buckets = {
  pdf: process.env.SUPABASE_STORAGE_BUCKET_PDF || 'facturas-pdf',
  xml: process.env.SUPABASE_STORAGE_BUCKET_XML || 'facturas-xml',
  imagen: process.env.SUPABASE_STORAGE_BUCKET_IMAGENES || 'facturas-imagenes'
};
const mime = { pdf: 'application/pdf', xml: 'application/xml', imagen: 'image/jpeg' };

module.exports = async (req, res) => {
  const session = requireAuth(req, res, req.method === 'GET' ? 'download' : 'upload');
  if (!session) return;
  try {
    if (req.method === 'GET') {
      const facturaId = cleanString(req.query?.factura_id, 80);
      const path = `/rest/v1/documentos_factura?select=*&factura_id=eq.${encodeURIComponent(facturaId)}&order=created_at.desc`;
      const { data } = await supabaseFetch(path);
      return json(res, 200, { ok: true, documentos: data || [] });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
    const body = await readJson(req, 15_000_000);
    const facturaId = cleanString(body.factura_id, 80);
    const tipo = ['pdf', 'xml', 'imagen'].includes(body.tipo) ? body.tipo : '';
    const filename = cleanString(body.filename || `documento.${tipo}`, 180).replace(/[^a-zA-Z0-9._-]/g, '-');
    const base64 = String(body.base64 || '').split(',').pop();
    if (!facturaId || !tipo || !base64) return json(res, 400, { ok: false, error: 'factura_tipo_archivo_required' });
    const buffer = Buffer.from(base64, 'base64');
    const storagePath = `${facturaId}/${Date.now()}-${filename}`;
    const bucket = buckets[tipo];
    await supabaseFetch(`/storage/v1/object/${bucket}/${storagePath}`, {
      method: 'POST', headers: { 'Content-Type': cleanString(body.contentType, 100) || mime[tipo], 'x-upsert': 'true' }, body: buffer
    });
    const publicUrl = `${String(process.env.SUPABASE_URL).replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${storagePath}`;
    const { data } = await supabaseFetch('/rest/v1/documentos_factura', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ factura_id: facturaId, tipo, nombre_archivo: filename, bucket, storage_path: storagePath, url: publicUrl, usuario_carga: session.user })
    });
    const updateField = tipo === 'pdf' ? 'pdf_url' : tipo === 'xml' ? 'xml_url' : 'imagen_url';
    await supabaseFetch(`/rest/v1/facturas?id=eq.${encodeURIComponent(facturaId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ [updateField]: publicUrl })
    });
    await writeAudit(session, 'cargar_documento', 'documentos_factura', data && data[0] && data[0].id, { facturaId, tipo, filename });
    json(res, 201, { ok: true, documento: data && data[0], url: publicUrl });
  } catch (e) {
    json(res, e.message === 'missing_supabase_env' ? 500 : (e.status || 500), { ok: false, error: e.message, detail: e.data });
  }
};
