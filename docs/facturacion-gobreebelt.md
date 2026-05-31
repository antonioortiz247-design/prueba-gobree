# Sistema de Consulta Histórica y Gestión de Facturación GobreeBelt

## Arquitectura

El sitio actual usa HTML, CSS y JavaScript estático con funciones serverless en `/api` desplegadas en Vercel. El panel administrativo existente autentica con `ADMIN_PASSWORD` y una cookie `gobree_admin` firmada con `ADMIN_SECRET`. Redis/KV continúa reservado para hero, productos, proyectos y media pública; el módulo de facturación no guarda facturas en Redis.

El nuevo módulo se integra como una sección aislada en `/admin/facturas` y consume API Routes nuevas que hablan con Supabase PostgreSQL y Supabase Storage mediante REST con `SUPABASE_SERVICE_ROLE_KEY`.

## Estructura agregada

- `admin/facturas.html`: interfaz administrativa del módulo.
- `admin/facturas.js`: comportamiento del dashboard, clientes, facturas, importación XML, reportes y documentos.
- `lib/facturacion-common.js`: autenticación compartida, roles, cliente REST de Supabase, sanitización y auditoría.
- `api/facturas.js`: CRUD, búsqueda, filtros y detalle de facturas/partidas.
- `api/clientes-facturacion.js`: CRUD y consulta de clientes.
- `api/facturacion-dashboard.js`: métricas y rankings.
- `api/facturacion-documentos.js`: carga/listado de PDF, XML e imágenes a Supabase Storage.
- `api/importar-xml.js`: importación inicial CFDI XML.
- `api/reportes-facturacion.js`: reportes JSON/CSV/Excel/HTML imprimible.
- `migrations/20260531_facturacion.sql`: esquema SQL completo, índices, vistas y buckets.

## Variables de entorno

Obligatorias:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET_PDF=facturas-pdf
SUPABASE_STORAGE_BUCKET_XML=facturas-xml
SUPABASE_STORAGE_BUCKET_IMAGENES=facturas-imagenes
ADMIN_PASSWORD=...
ADMIN_SECRET=...
```

Opcionales:

```env
GOBREE_FACTURAS_DEFAULT_ROLE=administrador # administrador | capturista | consulta
GOBREE_FACTURAS_USER=admin
```

## Roles

- **Administrador**: crear, editar, eliminar, importar, exportar, administrar usuarios, ver auditoría, consultar y descargar.
- **Capturista**: crear registros, editar registros, cargar documentos, consultar y descargar.
- **Consulta**: buscar, consultar, descargar PDF y XML.

La sesión hereda el login actual del panel. En esta fase MVP, el rol se define con `GOBREE_FACTURAS_DEFAULT_ROLE`; queda preparada la capa de permisos para migrar a usuarios individuales.

## API documentada

### `GET /api/facturacion-session`
Devuelve sesión y permisos activos.

### `GET /api/facturacion-dashboard`
Devuelve métricas: facturas/clientes registrados, ventas y facturas del año/mes, clientes frecuentes, medidas y bandas más vendidas, últimas facturas y pendientes.

### `/api/clientes-facturacion`
- `GET ?q=` lista clientes.
- `GET ?id=` detalle con facturas.
- `POST` crea cliente.
- `PATCH` actualiza cliente.
- `DELETE` elimina cliente.

### `/api/facturas`
- `GET` lista paginada con `page`, `pageSize`, `q`, `cliente`, `rfc`, `folio`, `oc`, `codigo_interno`, `fecha_inicial`, `fecha_final`, `ancho_mm`, `longitud_mm`, `medidas_internas`, `tipo_banda`, `guia`, `observaciones`, `monto_minimo`, `monto_maximo`, `estatus`.
- `GET ?id=` detalle completo con cliente, partidas y documentos.
- `POST` crea factura y partidas.
- `PATCH` actualiza factura y reemplaza partidas si se envían.
- `DELETE` elimina factura.

### `POST /api/facturacion-documentos`
Carga documento en base64 con `factura_id`, `tipo` (`pdf`, `xml`, `imagen`), `filename`, `contentType`, `base64`.

### `POST /api/importar-xml`
Recibe `xml` o `base64`, extrae cliente, RFC, fecha, folio, subtotal, IVA y total; crea cliente si no existe y crea factura pendiente.

### `GET /api/reportes-facturacion`
Parámetros: `tipo` y `format=json|csv|excel|pdf`. Reportes disponibles: `ventas_anio`, `ventas_mes`, `ventas_cliente`, `facturas_cliente`, `medidas`, `bandas`, `clientes_frecuentes`, `capturadas_usuario`.

### `GET /api/audit-facturacion`
Lista los últimos 100 registros de auditoría. Requiere rol administrador.

## Configuración en Supabase

1. Crear un proyecto Supabase.
2. Ejecutar `migrations/20260531_facturacion.sql` en SQL Editor.
3. Confirmar buckets: `facturas-pdf`, `facturas-xml`, `facturas-imagenes`.
4. Copiar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` a Vercel.
5. Mantener `SERVICE_ROLE_KEY` sólo en variables de entorno serverless; nunca exponerlo en frontend.

## Despliegue en Vercel

1. Configurar las variables de entorno anteriores en Project Settings → Environment Variables.
2. Verificar que el despliegue apunte a la rama/commit que contiene este módulo. Si el log dice `Branch: main`, Vercel está desplegando `main`; el módulo sólo aparecerá ahí después de fusionar el PR o de seleccionar esa rama como Preview Deployment.
3. Desplegar la rama actual.
4. Iniciar sesión en `/admin`.
5. Entrar a `/admin/facturas`.
6. Validar creación de cliente, factura, carga PDF/XML y búsqueda.

### Cómo interpretar el log de Vercel

El log siguiente es de un despliegue exitoso hasta la fase de publicación:

```text
Running "vercel build"
Installing dependencies...
up to date
Build Completed in /vercel/output
Deploying outputs...
```

`Build Completed` significa que el código compiló correctamente. `Deploying outputs...` significa que Vercel está subiendo/publicando los archivos generados; no es un error. Un fallo real normalmente aparece como `Error`, `Command failed`, `Build failed`, una traza de JavaScript/Node, o termina con estado `Failed` en el panel de Vercel.

Si después de ese log no ves `/admin/facturas`, revisa primero estos puntos:

1. **Rama/commit desplegado:** el log debe mostrar el commit que contiene este módulo. Si muestra `Branch: main` y el cambio aún está en un PR, debes fusionar el PR o abrir el Preview Deployment del PR. También puedes abrir `/api/deployment-info` para ver el branch y commit realmente publicados.
2. **Ruta correcta:** con `cleanUrls` activo, usa `/admin/facturas`; si tu navegador cachea una ruta anterior, prueba `/admin/facturas.html`.
3. **Sesión:** entra primero a `/admin` e inicia sesión; el módulo reutiliza la cookie administrativa existente.
4. **Variables:** para usar datos reales, configura `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, buckets de Storage, `ADMIN_PASSWORD` y `ADMIN_SECRET`.
5. **Base de datos:** ejecuta `migrations/20260531_facturacion.sql` en Supabase antes de probar creación, búsquedas o reportes.
6. **Cambios de Codex:** si Codex muestra “Aplicar los cambios y continuar de manera local”, acepta/aplica esos cambios y asegúrate de subir/fusionar el commit antes de esperar que Vercel lo despliegue.

## Manual básico de uso

1. Inicia sesión en `/admin`.
2. Abre `/admin/facturas`.
3. Revisa el Dashboard.
4. Crea clientes en la pestaña Clientes.
5. Crea facturas en modo Captura Rápida o Completa.
6. Adjunta PDF/XML al guardar la factura.
7. Usa búsqueda global y filtros avanzados para consultar histórico.
8. Descarga documentos desde acciones o detalle.
9. Genera reportes y exporta CSV/Excel/PDF imprimible.

## Checklist de producción

- [ ] Migración SQL ejecutada.
- [ ] Buckets creados y visibles.
- [ ] Variables Supabase configuradas en Vercel.
- [ ] `ADMIN_PASSWORD` y `ADMIN_SECRET` configurados.
- [ ] Acceso `/admin/facturas` probado con sesión activa.
- [ ] Prueba de folio duplicado por cliente rechazada por índice único.
- [ ] Carga PDF/XML validada.
- [ ] Reportes exportan CSV.
- [ ] Auditoría registra altas, ediciones, eliminaciones, documentos e importaciones.
- [ ] Redis/KV existente no fue modificado para facturación.

## Preparación futura

La tabla `documentos_factura` incluye imágenes escaneadas para OCR futuro. El endpoint XML está separado para ampliar extracción CFDI. La arquitectura de reportes está basada en vistas SQL para soportar crecimiento sin cargar decenas de miles de filas en el navegador.
