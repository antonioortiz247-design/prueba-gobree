# Revisión rápida del sitio (versión actual)

## Estado general
- Sitio estático multi-página funcionando con HTML/CSS/JS sin backend.
- Navegación principal consistente y diseño responsivo base.
- Formulario de contacto redirige a WhatsApp (no guarda leads en CRM ni correo).

## Qué falta para una versión más "lista para producción"
1. **Analítica y medición**
   - Falta Google Analytics 4 / Meta Pixel para medir conversiones.
2. **SEO técnico básico**
   - Falta `sitemap.xml` y `robots.txt`.
   - Faltan metadatos Open Graph/Twitter en varias páginas.
   - Faltan etiquetas `alt` en algunas imágenes (ej. portada y algunos servicios).
3. **Conversión y confianza**
   - Falta integrar el formulario a correo/CRM (actualmente solo abre WhatsApp).
   - Falta aviso de privacidad + consentimiento de datos.
4. **Rendimiento**
   - Falta optimizar imágenes (WebP/AVIF + compresión + dimensiones).
   - Falta cacheado HTTP y compresión configurada en hosting/CDN.
5. **Calidad operativa**
   - Falta un checklist de publicación (QA en móvil, links, SEO, seguridad).

## Checklist mínimo recomendado (prioridad alta)
- [ ] Conectar dominio + SSL activo.
- [ ] Crear `robots.txt` y `sitemap.xml`.
- [ ] Configurar GA4 y evento de clic en WhatsApp.
- [ ] Conectar formulario a email (FormSubmit/EmailJS/Backend).
- [ ] Optimizar imágenes principales a WebP.
- [ ] Crear página de Aviso de Privacidad.

---

# Cómo conectarlo a un dominio comprado en Hostinger

> Aplica para un sitio estático como este.

## Opción A (recomendada): alojar en Hostinger directamente
1. En **hPanel > Websites > Manage > Domains**, agrega tu dominio al sitio.
2. En **DNS Zone Editor** del dominio:
   - Crea/valida registro **A** para `@` apuntando a la IP de tu hosting.
   - Crea/valida registro **CNAME** de `www` -> `@`.
3. Sube archivos del sitio (`index.html`, `styles.css`, `script.js`, imágenes) a `public_html/`.
4. En **SSL**, activa certificado (Let's Encrypt) para `dominio.com` y `www.dominio.com`.
5. Fuerza redirección a una sola versión canónica (recomendado `https://www...` o sin `www`, solo una).
6. Espera propagación DNS (normalmente minutos, hasta 24h en algunos casos).

## Opción B: si el sitio está en otro proveedor (Netlify/Vercel/GitHub Pages)
1. En el proveedor externo, agrega el dominio personalizado.
2. En Hostinger DNS, crea los registros que indique ese proveedor:
   - Normalmente `A` o `CNAME` para raíz y/o `www`.
3. Verifica el dominio en el proveedor externo y activa SSL allí.
4. Valida que una versión redireccione a la canónica.

## Verificación final
- `https://dominio.com` carga sin advertencias SSL.
- `https://www.dominio.com` redirige correctamente (o al revés).
- Página principal y subpáginas cargan assets sin error 404.
- Formulario/WhatsApp abre correctamente en móvil y escritorio.
- Search Console puede verificar la propiedad del dominio.

## Registros DNS típicos (referencia)
- `A`  `@`  -> `IP_DEL_HOSTING`
- `CNAME` `www` -> `@`

> Nota: Si ya tienes correos en el dominio, **no borres MX/TXT/SPF/DKIM** existentes.
