const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
let state = { page: 1, pageSize: 25, clientes: [], facturas: [], session: null };
async function api(url, options = {}) {
  const res = await fetch(url, Object.assign({ 
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  }, options));
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || 'request_failed');
  return data;
}
function can(permission) { return state.session?.role === 'administrador' || state.session?.permissions?.includes(permission); }
function setMessage(el, text) { el.innerHTML = `<p class="muted">${esc(text)}</p>`; }
async function init() {
  try {
    const { ok } = await api('/api/admin-panel?type=check');
    if (!ok) throw new Error('unauthorized');
    state.session = { role: 'administrador' }; // Simplificado para el panel actual
    $('rolePill').textContent = 'Admin';
    await Promise.all([loadDashboard(), loadClientes(), loadFacturas()]);
  } catch (e) {
    $('rolePill').textContent = 'Sin sesión';
    alert('Inicia sesión en /admin antes de abrir facturación.');
    location.href = '/admin';
  }
}

async function loadDashboard() {
  const data = await api('/api/billing?type=dashboard');
  const s = data.stats || {};
  const metrics = [
    ['Facturas Registradas', s.totalFacturas], ['Clientes Registrados', s.totalClientes],
    ['Ventas Este Mes', money(s.ventasMes)], ['Facturas Pendientes', s.pendientes]
  ];
  $('metrics').innerHTML = metrics.map(([k, v]) => `<div class="metric"><span>${k}</span><strong>${v ?? 0}</strong></div>`).join('');
}

async function loadClientes(q = '') {
  const data = await api(`/api/billing?type=clientes&search=${encodeURIComponent(q)}`);
  state.clientes = data.data || [];
  $('clienteSelect').innerHTML = '<option value="">Seleccionar cliente</option>' + state.clientes.map((c) => `<option value="${c.id}">${esc(c.nombre)}${c.rfc ? ` · ${esc(c.rfc)}` : ''}</option>`).join('');
  $('clientRows').innerHTML = state.clientes.map((c) => `<tr><td>${esc(c.nombre)}</td><td>${esc(c.rfc)}</td><td>${esc(c.contacto_principal || '-')}</td><td>${esc(c.telefono || '-')}</td><td>${esc(c.email || '-')}</td><td class="actions"><button class="btn small btn-secondary" onclick="showClient('${c.id}')">Detalle</button><button class="btn small" onclick="editClient('${c.id}')">Editar</button></td></tr>`).join('');
}

async function loadFacturas() {
  const params = new URLSearchParams({
    type: 'facturas',
    page: state.page,
    search: $('globalSearch').value,
    cliente: $('fCliente').value,
    folio: $('fFolio').value,
    oc: $('fOc').value,
    codigo_interno: $('fCodigo').value,
    fecha_inicial: $('fFechaIni').value,
    fecha_final: $('fFechaFin').value,
    estatus: $('fEstatus').value
  });
  const data = await api(`/api/billing?${params}`);
  state.facturas = data.data || [];
  $('resultCount').textContent = `${data.count || 0} resultados`;
  $('pageInfo').textContent = `Página ${state.page}`;
  $('invoiceRows').innerHTML = state.facturas.map((f) => { 
    const p = (f.partidas || [])[0] || {};
    return `<tr>
      <td>${esc(f.fecha)}</td>
      <td>${esc(f.folio)}</td>
      <td>${esc(f.clientes?.nombre || '')}</td>
      <td>${esc(f.codigo_interno)}</td>
      <td>${esc(f.oc)}</td>
      <td>${esc(p.ancho_mm || '-')}</td>
      <td>${esc(p.longitud_mm || '-')}</td>
      <td>${esc(p.medidas_internas || '-')}</td>
      <td>${money(f.total)}</td>
      <td><span class="status ${esc(f.estatus)}">${esc(f.estatus)}</span></td>
      <td class="actions">
        <button class="btn small btn-secondary" onclick="showInvoice('${f.id}')">Ver Detalle</button>
        <button class="btn small" onclick="editInvoice('${f.id}')">Editar</button>
        ${f.pdf_url ? `<a class="btn small btn-secondary" href="${esc(f.pdf_url)}" target="_blank">PDF</a>` : ''}
        ${f.xml_url ? `<a class="btn small btn-secondary" href="${esc(f.xml_url)}" target="_blank">XML</a>` : ''}
      </td>
    </tr>`; 
  }).join('') || '<tr><td colspan="11">Sin resultados.</td></tr>';
}
$('searchBtn').onclick = () => { state.page = 1; loadFacturas().catch(alert); };
$('clearBtn').onclick = () => { ['globalSearch','fCliente','fFolio','fOc','fCodigo','fFechaIni','fFechaFin','fAncho','fLongitud','fMedidas','fBanda','fGuia','fObs','fMin','fMax','fEstatus'].forEach((id) => { $(id).value = ''; }); state.page = 1; loadFacturas().catch(alert); };
$('globalSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('searchBtn').click(); });
$('prevPage').onclick = () => { if (state.page > 1) { state.page--; loadFacturas().catch(alert); } };
$('nextPage').onclick = () => { state.page++; loadFacturas().catch(alert); };
$('newInvoiceBtn').onclick = () => { $('invoiceFormCard').classList.remove('hidden'); $('invoiceForm').reset(); $('facturaId').value = ''; $('invoiceFormTitle').textContent = 'Nueva Factura'; $('fecha').valueAsDate = new Date(); };
$('cancelInvoiceBtn').onclick = () => $('invoiceFormCard').classList.add('hidden');
$('captureMode').onchange = () => document.querySelectorAll('.complete-field').forEach((el) => el.classList.toggle('hidden', $('captureMode').value === 'rapida'));
$('captureMode').onchange();
async function fileToBase64(input) { const file = input.files && input.files[0]; if (!file) return null; return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve({ base64: r.result, filename: file.name, contentType: file.type }); r.readAsDataURL(file); }); }
$('invoiceForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('facturaId').value;
  const payload = { id, cliente_id: $('clienteSelect').value, fecha: $('fecha').value, folio: $('folio').value, oc: $('oc').value, codigo_interno: $('codigoInterno').value, subtotal: $('subtotal').value, iva: $('iva').value, total: $('total').value, estatus: $('estatus').value, observaciones: $('observaciones').value, partidas: [{ descripcion: $('descripcion').value, tipo_banda: $('tipoBanda').value, ancho_mm: $('ancho').value, longitud_mm: $('longitud').value, medidas_internas: $('medidas').value, guia: $('guia').value, tipo_union: $('tipoUnion').value, cantidad: $('cantidad').value, precio_unitario: $('precio').value, importe: $('importe').value }] };
  
  const saved = await api('/api/billing?type=facturas', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
  const facturaId = id || saved.data?.id;

  // Manejo de archivos con FormData
  for (const [inputId, bucket] of [['pdfFile','facturas-pdf'], ['xmlFile','facturas-xml']]) {
    const input = $(inputId);
    if (input.files && input.files[0]) {
      const fd = new FormData();
      fd.append('file', input.files[0]);
      fd.append('bucket', bucket);
      fd.append('folder', new Date().getFullYear().toString());
      await fetch(`/api/uploads?type=factura`, { 
        method: 'POST', 
        body: fd,
        credentials: 'same-origin'
      });
    }
  }
  
  $('invoiceFormCard').classList.add('hidden'); 
  await Promise.all([loadFacturas(), loadDashboard()]);
};

window.showInvoice = async (id) => {
  const data = await api(`/api/billing?type=facturas&id=${encodeURIComponent(id)}`); 
  const f = data.data[0]; if (!f) return;
  const p = (f.partidas || [])[0] || {}, c = f.clientes || {};
  $('invoiceDetail').classList.remove('hidden'); 
  $('invoiceDetail').innerHTML = `<div class="section-title"><h2>Detalle factura ${esc(f.folio)}</h2><button class="btn btn-secondary" onclick="$('invoiceDetail').classList.add('hidden')">Cerrar</button></div><div class="grid three"><div><h3>Cliente</h3><p>${esc(c.nombre)}<br>${esc(c.rfc)}<br>${esc(c.direccion)}<br>${esc(c.telefono)}<br>${esc(c.email)}</p></div><div><h3>Facturación</h3><p>Fecha: ${esc(f.fecha)}<br>OC: ${esc(f.oc)}<br>Código: ${esc(f.codigo_interno)}<br>Subtotal: ${money(f.subtotal)}<br>IVA: ${money(f.iva)}<br>Total: ${money(f.total)}</p></div><div><h3>Archivos</h3><p>${f.pdf_url ? `<a href="${esc(f.pdf_url)}" target="_blank">Descargar PDF</a>` : 'Sin PDF'}<br>${f.xml_url ? `<a href="${esc(f.xml_url)}" target="_blank">Descargar XML</a>` : 'Sin XML'}</p></div></div><h3>Datos técnicos</h3><div class="detail">${esc(p.descripcion)}\nTipo banda: ${esc(p.tipo_banda)} · Ancho: ${esc(p.ancho_mm)} · Longitud: ${esc(p.longitud_mm)} · Medidas: ${esc(p.medidas_internas)} · Guía: ${esc(p.guia)} · Unión: ${esc(p.tipo_union)}</div><h3>Observaciones</h3><div class="detail">${esc(f.observaciones)}</div>`;
};

window.editInvoice = async (id) => { 
  const data = await api(`/api/billing?type=facturas&id=${encodeURIComponent(id)}`); 
  const f = data.data[0]; if (!f) return;
  const p = (f.partidas || [])[0] || {}; 
  $('newInvoiceBtn').click(); 
  $('invoiceFormTitle').textContent = 'Editar Factura'; 
  $('facturaId').value = f.id; 
  $('clienteSelect').value = f.cliente_id; 
  $('fecha').value = f.fecha; 
  $('folio').value = f.folio; 
  $('oc').value = f.oc || ''; 
  $('codigoInterno').value = f.codigo_interno || ''; 
  $('subtotal').value = f.subtotal || ''; 
  $('iva').value = f.iva || ''; 
  $('total').value = f.total || ''; 
  $('estatus').value = f.estatus; 
  $('observaciones').value = f.observaciones || ''; 
  $('descripcion').value = p.descripcion || ''; 
  $('tipoBanda').value = p.tipo_banda || ''; 
  $('ancho').value = p.ancho_mm || ''; 
  $('longitud').value = p.longitud_mm || ''; 
  $('medidas').value = p.medidas_internas || ''; 
  $('guia').value = p.guia || ''; 
  $('tipoUnion').value = p.tipo_union || ''; 
  $('cantidad').value = p.cantidad || 1; 
  $('precio').value = p.precio_unitario || ''; 
  $('importe').value = p.importe || ''; 
};

$('saveClientBtn').onclick = async () => { 
  const payload = { id: $('clientId').value, nombre: $('clientNombre').value, rfc: $('clientRfc').value, direccion: $('clientDireccion').value, telefono: $('clientTelefono').value, email: $('clientEmail').value, contacto_principal: $('clientContacto').value, notas: $('clientNotas').value }; 
  await api('/api/billing?type=clientes', { method: payload.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); 
  $('clientForm').classList.add('hidden'); 
  await loadClientes(); 
};

$('loadAuditBtn').onclick = async () => { 
  const data = await api('/api/billing?type=auditoria'); 
  $('auditRows').innerHTML = (data.data || []).map((l) => `<tr><td>${esc(new Date(l.fecha).toLocaleString())}</td><td>${esc(l.usuario_email)}</td><td>-</td><td>${esc(l.accion)}</td><td>${esc(l.tabla_afectada)}</td><td>${esc(l.registro_id)}</td></tr>`).join('') || '<tr><td colspan="6">Sin registros.</td></tr>'; 
};
document.querySelectorAll('[data-export]').forEach((b) => b.onclick = () => { location.href = `/api/reportes-facturacion?tipo=${$('reportType').value}&format=${b.dataset.export}`; });
init();
