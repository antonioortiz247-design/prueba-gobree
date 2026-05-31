# Diagnóstico del log de Vercel y del código existente

## Conclusión rápida

El log compartido no muestra un error del código existente ni del módulo de facturación. La parte relevante es:

```text
Running "vercel build"
Installing dependencies...
up to date
Build Completed in /vercel/output
Deploying outputs...
```

`Build Completed` significa que Vercel ya terminó el build correctamente. `Deploying outputs...` es la fase normal donde Vercel publica los archivos generados.

## Revisión del código existente

La aplicación actual es un sitio estático con funciones serverless:

- `package.json` no define script `build`, por lo que Vercel no compila un framework como Next/Vite; instala dependencias y empaqueta HTML/CSS/JS + `/api`.
- `vercel.json` sólo activa `cleanUrls` y redirecciones de `.html` a URLs limpias.
- Las rutas públicas viven como archivos HTML en raíz o subcarpetas.
- El panel existente es `admin.html`, accesible como `/admin` por `cleanUrls`.
- El módulo de facturación vive en `admin/facturas.html`, accesible como `/admin/facturas` por `cleanUrls`.
- Las API Routes existentes están en `/api/*.js`; el módulo nuevo sigue ese mismo patrón.
- Redis/KV se usa en APIs existentes para media/productos/proyectos, pero facturación no toca Redis.

Con esta arquitectura, el log de Vercel que termina en `Build Completed` no apunta a un fallo del código. Si hubiera un problema de JavaScript/Node en una API, normalmente aparecería al ejecutar esa API en runtime, no necesariamente durante `vercel build`.

## Señal importante en el log compartido

Tu log dice algo como:

```text
Cloning github.com/antonioortiz247-design/prueba-gobree (Branch: main, Commit: 4d07518)
```

Eso significa que Vercel está desplegando la rama `main` y específicamente ese commit. Si el módulo de facturación está en otra rama o PR, no aparecerá en producción hasta que:

1. Se fusione el PR a `main`, o
2. Se abra el Preview Deployment del PR/rama correcta, o
3. Se cambie en Vercel la rama que se quiere desplegar.

## Cómo confirmar qué está desplegado

Se agregó el endpoint:

```text
/api/deployment-info
```

Devuelve información no sensible del deployment actual:

```json
{
  "ok": true,
  "environment": "production",
  "branch": "main",
  "commit": "...",
  "repo": "prueba-gobree",
  "url": "...",
  "checkedAt": "..."
}
```

Úsalo para comparar el commit publicado por Vercel contra el commit donde está el módulo de facturación.

## Checklist si `/admin/facturas` no aparece

1. Abrir `/api/deployment-info` y confirmar branch/commit.
2. Confirmar que ese commit contiene `admin/facturas.html`.
3. Abrir `/admin/facturas`.
4. Si no funciona, probar `/admin/facturas.html` para descartar caché/redirección.
5. Entrar primero a `/admin` e iniciar sesión, porque facturación reutiliza la cookie `gobree_admin`.
6. Para operaciones reales, configurar variables Supabase y ejecutar `migrations/20260531_facturacion.sql`.
