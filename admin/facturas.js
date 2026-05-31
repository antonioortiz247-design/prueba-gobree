const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
let state = { page: 1, pageSize: 25, clientes: [], facturas: [], session: null };
async function api(url, options = {}) {
  const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || 'request_failed');
  return data;
}
function can(permission) { return state.session?.role === 'administrador' || state.session?.permissions?.includes(permission); }
function setMessage(el, text) { el.innerHTML = `<p class="muted">${esc(text)}</p>`; }
async function init() {
  try {
    const { session } = await api('/api/facturacion-session');
    state.session = session; $('rolePill').textContent = session.role;
    document.querySelectorAll('[data-tab="auditoria"]').forEach((el) => el.classList.toggle('hidden', !can('audit')));
    await Promise.all([loadDashboard(), loadClientes(), loadFacturas()]);
  } catch (e) {
    $('rolePill').textContent = 'Sin sesión';
    alert('Inicia sesión en /admin antes de abrir facturación.');
    location.href = '/admin';
  }
}
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab,.panel').forEach((el) => el.classList.remove('active'));
  tab.classList.add('active'); $(tab.dataset.tab).classList.add('active');
}));
async function loadDashboard() {
  const data = await api('/api/facturacion-dashboard');
  const s = data.summary || {};
  const metrics = [
    ['Facturas Registradas', s.facturas_registradas], ['Clientes Registrados', s.clientes_registrados],
    ['Facturas Este Año', s.facturas_este_anio], ['Ventas Este Año', money(s.ventas_este_anio)],
    ['Facturas Este Mes', s.facturas_este_mes], ['Ventas Este Mes', money(s.ventas_este_mes)]
  ];
  $('metrics').innerHTML = metrics.map(([k, v]) => `<div class="metric"><span>${k}</span><strong>${v ?? 0}</strong></div>`).join('');
  renderMini('topClientes', data.topClientes, (r) => `${r.nombre} · ${r.facturas} facturas · ${money(r.total_comprado)}`);
  renderMini('topMedidas', data.topMedidas, (r) => `${r.ancho_mm || '-'} x ${r.longitud_mm || '-'} · ${r.medidas_internas || '-'} (${r.partidas})`);
  renderMini('topBandas', data.topBandas, (r) => `${r.tipo_banda || 'Sin tipo'} · ${r.partidas} partidas`);
  renderMini('pendientes', data.pendientes, (r) => `${r.folio} · ${r.clientes?.nombre || ''} · ${money(r.total)}`);
}
function renderMini(id, rows = [], fn) { $(id).innerHTML = rows.length ? `<ul>${rows.map((r) => `<li>${esc(fn(r))}</li>`).join('')}</ul>` : '<p class="muted">Sin datos.</p>'; }
async function loadClientes(q = '') {
  const data = await api(`/api/clientes-facturacion?q=${encodeURIComponent(q)}`);
  state.clientes = data.clientes || [];
  $('clienteSelect').innerHTML = '<option value="">Seleccionar cliente</option>' + state.clientes.map((c) => `<option value="${c.id}">${esc(c.nombre)}${c.rfc ? ` · ${esc(c.rfc)}` : ''}</option>`).join('');
  $('clientRows').innerHTML = state.clientes.map((c) => `<tr><td>${esc(c.nombre)}</td><td>${esc(c.rfc)}</td><td>${esc(c.contacto_principal)}</td><td>${esc(c.telefono)}</td><td>${esc(c.email)}</td><td class="actions"><button class="btn small btn-secondary" onclick="showClient('${c.id}')">Detalle</button>${can('edit') ? `<button class="btn small" onclick="editClient('${c.id}')">Editar</button>` : ''}</td></tr>`).join('');
}
async function loadFacturas() {
  const params = new URLSearchParams({
    page: state.page,
    pageSize: state.pageSize,
    q: $('globalSearch').value,
    cliente: $('fCliente').value,
    folio: $('fFolio').value,
    oc: $('fOc').value,
    codigo_interno: $('fCodigo').value,
    fecha_inicial: $('fFechaIni').value,
    fecha_final: $('fFechaFin').value,
    ancho_mm: $('fAncho').value,
    longitud_mm: $('fLongitud').value,
    medidas_internas: $('fMedidas').value,
    tipo_banda: $('fBanda').value,
    guia: $('fGuia').value,
    observaciones: $('fObs').value,
    monto_minimo: $('fMin').value,
    monto_maximo: $('fMax').value,
    estatus: $('fEstatus').value
  });
  const data = await api(`/api/facturas?${params}`);
  state.facturas = data.facturas || [];
  $('resultCount').textContent = data.contentRange || `${state.facturas.length} resultados`;
  $('pageInfo').textContent = `Página ${state.page}`;
  $('invoiceRows').innerHTML = state.facturas.map((f) => { const p = (f.partidas || [])[0] || {}; return `<tr><td>${esc(f.fecha)}</td><td>${esc(f.folio)}</td><td>${esc(f.clientes?.nombre || '')}</td><td>${esc(f.codigo_interno)}</td><td>${esc(f.oc)}</td><td>${esc(p.ancho_mm)}</td><td>${esc(p.longitud_mm)}</td><td>${esc(p.medidas_internas)}</td><td>${money(f.total)}</td><td><span class="status ${esc(f.estatus)}">${esc(f.estatus)}</span></td><td class="actions"><button class="btn small btn-secondary" onclick="showInvoice('${f.id}')">Ver Detalle</button>${can('edit') ? `<button class="btn small" onclick="editInvoice('${f.id}')">Editar</button>` : ''}${f.pdf_url ? `<a class="btn small btn-secondary" href="${esc(f.pdf_url)}" target="_blank">PDF</a>` : ''}${f.xml_url ? `<a class="btn small btn-secondary" href="${esc(f.xml_url)}" target="_blank">XML</a>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="11">Sin resultados.</td></tr>';
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
  const saved = await api('/api/facturas', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
  const facturaId = id || saved.factura.id;
  for (const [inputId, tipo] of [['pdfFile','pdf'], ['xmlFile','xml']]) { const file = await fileToBase64($(inputId)); if (file) await api('/api/facturacion-documentos', { method: 'POST', body: JSON.stringify(Object.assign({ factura_id: facturaId, tipo }, file)) }); }
  $('invoiceFormCard').classList.add('hidden'); await loadFacturas(); await loadDashboard();
};
window.showInvoice = async (id) => {
  const { factura: f } = await api(`/api/facturas?id=${encodeURIComponent(id)}`); const p = (f.partidas || [])[0] || {}, c = f.clientes || {};
  $('invoiceDetail').classList.remove('hidden'); $('invoiceDetail').innerHTML = `<div class="section-title"><h2>Detalle factura ${esc(f.folio)}</h2><button class="btn btn-secondary" onclick="$('invoiceDetail').classList.add('hidden')">Cerrar</button></div><div class="grid three"><div><h3>Cliente</h3><p>${esc(c.nombre)}<br>${esc(c.rfc)}<br>${esc(c.direccion)}<br>${esc(c.telefono)}<br>${esc(c.email)}</p></div><div><h3>Facturación</h3><p>Fecha: ${esc(f.fecha)}<br>OC: ${esc(f.oc)}<br>Código: ${esc(f.codigo_interno)}<br>Subtotal: ${money(f.subtotal)}<br>IVA: ${money(f.iva)}<br>Total: ${money(f.total)}</p></div><div><h3>Archivos</h3><p>${f.pdf_url ? `<a href="${esc(f.pdf_url)}" target="_blank">Descargar PDF</a>` : 'Sin PDF'}<br>${f.xml_url ? `<a href="${esc(f.xml_url)}" target="_blank">Descargar XML</a>` : 'Sin XML'}</p></div></div><h3>Datos técnicos</h3><div class="detail">${esc(p.descripcion)}\nTipo banda: ${esc(p.tipo_banda)} · Ancho: ${esc(p.ancho_mm)} · Longitud: ${esc(p.longitud_mm)} · Medidas: ${esc(p.medidas_internas)} · Guía: ${esc(p.guia)} · Unión: ${esc(p.tipo_union)}</div><h3>Observaciones</h3><div class="detail">${esc(f.observaciones)}</div>`;
};
window.editInvoice = async (id) => { const { factura: f } = await api(`/api/facturas?id=${encodeURIComponent(id)}`); const p = (f.partidas || [])[0] || {}; $('newInvoiceBtn').click(); $('invoiceFormTitle').textContent = 'Editar Factura'; $('facturaId').value = f.id; $('clienteSelect').value = f.cliente_id; $('fecha').value = f.fecha; $('folio').value = f.folio; $('oc').value = f.oc || ''; $('codigoInterno').value = f.codigo_interno || ''; $('subtotal').value = f.subtotal || ''; $('iva').value = f.iva || ''; $('total').value = f.total || ''; $('estatus').value = f.estatus; $('observaciones').value = f.observaciones || ''; $('descripcion').value = p.descripcion || ''; $('tipoBanda').value = p.tipo_banda || ''; $('ancho').value = p.ancho_mm || ''; $('longitud').value = p.longitud_mm || ''; $('medidas').value = p.medidas_internas || ''; $('guia').value = p.guia || ''; $('tipoUnion').value = p.tipo_union || ''; $('cantidad').value = p.cantidad || 1; $('precio').value = p.precio_unitario || ''; $('importe').value = p.importe || ''; };
$('newClientBtn').onclick = () => { $('clientForm').classList.remove('hidden'); $('clientForm').querySelectorAll('input,textarea').forEach((i) => i.value = ''); };
$('cancelClientBtn').onclick = () => $('clientForm').classList.add('hidden');
$('saveClientBtn').onclick = async () => { const payload = { id: $('clientId').value, nombre: $('clientNombre').value, rfc: $('clientRfc').value, direccion: $('clientDireccion').value, telefono: $('clientTelefono').value, email: $('clientEmail').value, contacto_principal: $('clientContacto').value, notas: $('clientNotas').value }; await api('/api/clientes-facturacion', { method: payload.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); $('clientForm').classList.add('hidden'); await loadClientes(); };
$('clientSearch').oninput = () => loadClientes($('clientSearch').value).catch(console.error);
window.editClient = (id) => { const c = state.clientes.find((x) => x.id === id); if (!c) return; $('clientForm').classList.remove('hidden'); $('clientId').value = c.id; $('clientNombre').value = c.nombre || ''; $('clientRfc').value = c.rfc || ''; $('clientDireccion').value = c.direccion || ''; $('clientTelefono').value = c.telefono || ''; $('clientEmail').value = c.email || ''; $('clientContacto').value = c.contacto_principal || ''; $('clientNotas').value = c.notas || ''; };
window.showClient = (id) => { const c = state.clientes.find((x) => x.id === id); if (!c) return; const facturas = c.facturas || []; $('clientDetail').classList.remove('hidden'); $('clientDetail').innerHTML = `<div class="section-title"><h2>${esc(c.nombre)}</h2><button class="btn btn-secondary" onclick="$('clientDetail').classList.add('hidden')">Cerrar</button></div><p><b>RFC:</b> ${esc(c.rfc)} · <b>Total comprado:</b> ${money(facturas.reduce((a, f) => a + Number(f.total || 0), 0))} · <b>Última compra:</b> ${esc((facturas.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)))[0]||{}).fecha || 'N/A')}</p><h3>Facturas asociadas</h3><ul>${facturas.map((f) => `<li>${esc(f.fecha)} · ${esc(f.folio)} · ${money(f.total)}</li>`).join('')}</ul>`; };
$('importXmlBtn').onclick = () => $('xmlImportFile').click();
$('xmlImportFile').onchange = async () => { const file = await fileToBase64($('xmlImportFile')); if (!file) return; await api('/api/importar-xml', { method: 'POST', body: JSON.stringify(file) }); await Promise.all([loadClientes(), loadFacturas(), loadDashboard()]); alert('XML importado.'); };
$('loadReportBtn').onclick = async () => { const data = await api(`/api/reportes-facturacion?tipo=${$('reportType').value}`); $('reportOutput').textContent = JSON.stringify(data.rows, null, 2); };
$('loadAuditBtn').onclick = async () => { const data = await api('/api/audit-facturacion'); $('auditRows').innerHTML = (data.logs || []).map((l) => `<tr><td>${esc(l.fecha)}</td><td>${esc(l.usuario)}</td><td>${esc(l.rol)}</td><td>${esc(l.accion)}</td><td>${esc(l.tabla)}</td><td>${esc(l.registro_id)}</td></tr>`).join('') || '<tr><td colspan="6">Sin registros.</td></tr>'; };
document.querySelectorAll('[data-export]').forEach((b) => b.onclick = () => { location.href = `/api/reportes-facturacion?tipo=${$('reportType').value}&format=${b.dataset.export}`; });
init();
