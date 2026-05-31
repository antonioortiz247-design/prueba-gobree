const { isAdmin, sendJSON, getBody } = require('./_db');
const { XMLParser } = require('fast-xml-parser');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJSON(res, { error: 'Method Not Allowed' }, 405);
  }

  if (!isAdmin(req)) {
    return sendJSON(res, { ok: false, error: 'unauthorized' }, 401);
  }

  try {
    const { xml } = await getBody(req);
    if (!xml) {
      return sendJSON(res, { ok: false, error: 'No XML provided' }, 400);
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
    
    const jsonObj = parser.parse(xml);
    
    // El CFDI puede venir bajo diferentes namespaces, intentamos encontrar el Comprobante
    const comprobante = jsonObj['cfdi:Comprobante'] || jsonObj['Comprobante'];
    
    if (!comprobante) {
      return sendJSON(res, { ok: false, error: 'Formato CFDI no reconocido' }, 400);
    }

    const receptor = comprobante['cfdi:Receptor'] || comprobante['Receptor'];
    const conceptos = comprobante['cfdi:Conceptos'] || comprobante['Conceptos'];
    const impuestos = comprobante['cfdi:Impuestos'] || comprobante['Impuestos'];

    // Extraer datos principales
    const data = {
      folio: comprobante['@_Folio'] || comprobante['@_folio'] || '',
      fecha: comprobante['@_Fecha'] || comprobante['@_fecha'] || '',
      subtotal: parseFloat(comprobante['@_SubTotal'] || comprobante['@_subTotal'] || 0),
      total: parseFloat(comprobante['@_Total'] || comprobante['@_total'] || 0),
      cliente: {
        nombre: receptor ? receptor['@_Nombre'] || receptor['@_nombre'] : '',
        rfc: receptor ? receptor['@_Rfc'] || receptor['@_rfc'] : ''
      },
      partidas: []
    };

    // Formatear fecha (YYYY-MM-DD)
    if (data.fecha) {
      data.fecha = data.fecha.substring(0, 10);
    }

    // Calcular IVA si no viene explícito (Total - Subtotal aproximado)
    data.iva = Math.round((data.total - data.subtotal) * 100) / 100;

    // Extraer conceptos/partidas
    if (conceptos && conceptos['cfdi:Concepto']) {
      const items = Array.isArray(conceptos['cfdi:Concepto']) ? conceptos['cfdi:Concepto'] : [conceptos['cfdi:Concepto']];
      data.partidas = items.map(item => ({
        descripcion: item['@_Descripcion'] || item['@_descripcion'] || '',
        cantidad: parseFloat(item['@_Cantidad'] || item['@_cantidad'] || 1),
        precio_unitario: parseFloat(item['@_ValorUnitario'] || item['@_valorUnitario'] || 0),
        importe: parseFloat(item['@_Importe'] || item['@_importe'] || 0)
      }));
    }

    return sendJSON(res, { ok: true, data });
  } catch (e) {
    console.error('Error al parsear XML:', e);
    return sendJSON(res, { ok: false, error: 'Error al procesar el archivo XML: ' + e.message }, 500);
  }
};
