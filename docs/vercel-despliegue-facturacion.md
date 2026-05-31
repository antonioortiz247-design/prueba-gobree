# Guía rápida para revisar el despliegue de Facturación en Vercel

## El log compartido no es un error

Este patrón indica que Vercel ya compiló correctamente y está publicando:

```text
Running "vercel build"
Installing dependencies...
up to date
Build Completed in /vercel/output
Deploying outputs...
```

La línea importante es `Build Completed`. Si Vercel hubiera fallado, verías una línea explícita como `Error`, `Build failed`, `Command failed` o una traza de Node/JavaScript.

## Por qué puede no aparecer el módulo aunque el build sea correcto

1. **Se desplegó otra rama.** Si el log dice `Branch: main`, Vercel desplegó `main`. El módulo de facturación aparecerá en producción sólo si el commit del módulo ya está fusionado en `main`. Si está en un PR, usa el Preview Deployment de ese PR.
2. **Se abrió la ruta incorrecta.** La ruta recomendada es `/admin/facturas`. Por compatibilidad con Vercel `cleanUrls`, también puede probarse `/admin/facturas.html`.
3. **Falta sesión administrativa.** Primero hay que entrar a `/admin` e iniciar sesión, porque `/admin/facturas` reutiliza la cookie `gobree_admin`.
4. **Faltan variables de entorno.** La página carga, pero las APIs de facturación requieren Supabase y las credenciales administrativas documentadas.
5. **Falta la migración en Supabase.** Crear, buscar o reportar facturas requiere ejecutar `migrations/20260531_facturacion.sql`.

## Checklist mínimo después de desplegar

- [ ] Abrir `/api/deployment-info` y comparar `branch`/`commit` con el commit que contiene el módulo de facturación.
- [ ] Confirmar en el log de Vercel que el commit desplegado contiene el módulo de facturación.
- [ ] Abrir `/admin` e iniciar sesión.
- [ ] Abrir `/admin/facturas`.
- [ ] Confirmar variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` y `ADMIN_SECRET`.
- [ ] Ejecutar la migración SQL en Supabase.
- [ ] Probar crear un cliente y una factura de prueba.
