(() => {
  const homeProjectsGrid = document.getElementById('homeProjectsGrid');
  if (homeProjectsGrid) {
    const toText = (v, max) => String(v || '').trim().slice(0, max || 500);

    const buildCard = (item) => {
      const category = toText(item && item.category, 60) || 'Proyecto';
      const title = toText(item && item.title, 120) || 'Proyecto';
      const description = toText(item && item.description, 240);
      const mediaType = toText(item && item.mediaType, 10) === 'video' ? 'video' : 'image';
      const mediaSrc = toText(item && item.mediaSrc, 1200);
      const mediaPoster = toText(item && item.mediaPoster, 1200);
      const mediaAlt = toText(item && item.mediaAlt, 200) || title;
      const src = mediaType === 'video' ? (mediaPoster || '/portadagobree.png') : mediaSrc;
      if (!src) return null;

      const card = document.createElement('article');
      card.className = 'card';

      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = category;

      const img = document.createElement('img');
      img.src = src;
      img.alt = mediaAlt;
      img.loading = 'lazy';
      img.width = 400;
      img.height = 250;

      const h3 = document.createElement('h3');
      h3.textContent = title;

      const p = document.createElement('p');
      p.textContent = description;

      const a = document.createElement('a');
      a.className = 'text-link';
      a.href = '/proyectos';
      a.textContent = 'Ver proyectos →';

      card.appendChild(tag);
      card.appendChild(img);
      card.appendChild(h3);
      if (description) card.appendChild(p);
      card.appendChild(a);

      return card;
    };

    (async () => {
      try {
        const r = await fetch('/api/projects', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        const list = Array.isArray(data && data.projects) ? data.projects : [];
        if (!list.length) return;

        const top = list.slice(0, 3);
        const frag = document.createDocumentFragment();
        top.forEach((item) => {
          const card = buildCard(item);
          if (card) frag.appendChild(card);
        });
        if (!frag.childNodes.length) return;
        homeProjectsGrid.innerHTML = '';
        homeProjectsGrid.appendChild(frag);
      } catch (e) {}
    })();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function productImageSrc(product) {
    const img = String((product && product.img) || '').trim();
    if (!img) return 'Bandasanitaria.png';
    if (img.startsWith('data:image/') || img.startsWith('/api/media') || /^https?:\/\//i.test(img) || img.startsWith('/')) {
      return img;
    }
    return `/IMAGENES GOBREE/${img}`;
  }

  async function loadCatalogProducts() {
    const fallback = typeof productos !== 'undefined' && Array.isArray(productos) ? productos : [];
    try {
      const r = await fetch('/api/products', { cache: 'no-store' });
      if (!r.ok) throw new Error('products_fetch_failed');
      const data = await r.json();
      return Array.isArray(data.products) && data.products.length ? data.products : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function renderCatalog(items) {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>Sin resultados</h3>
          <p>Prueba con otros filtros o ajusta tu búsqueda.</p>
        </div>
      `;
      return;
    }

    // Agrupar por categoría
    const groups = items.reduce((acc, p) => {
      if (!acc[p.categoria]) acc[p.categoria] = [];
      acc[p.categoria].push(p);
      return acc;
    }, {});

    grid.innerHTML = Object.entries(groups).map(([cat, products]) => `
      <div class="category-section">
        <h2 class="category-title">${escapeHtml(cat)}</h2>
        <div class="cards">
          ${products.map((p) => `
            <article class="card product-card">
              <img src="${escapeHtml(productImageSrc(p))}"
                   alt="${escapeHtml(p.alt || p.nombre)}"
                   title="${escapeHtml(p.title || p.nombre)}"
                   width="400" height="300"
                   loading="lazy">
              <div class="product-info">
                <h3>${escapeHtml(p.nombre)}</h3>
                <p class="product-desc">${escapeHtml(p.descripcion)}</p>
                <div class="product-meta">
                  <span><strong>Material:</strong> ${escapeHtml(p.material)}</span>
                  <span><strong>Propiedad:</strong> ${escapeHtml(p.propiedad)}</span>
                </div>
                <div class="product-tags">
                  ${(Array.isArray(p.tags) ? p.tags : []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
                <a class="btn btn-secondary" href="producto.html?id=${encodeURIComponent(p.id)}">Ver ficha</a>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  if (document.getElementById('catalogGrid')) {
    (async () => {
      const catalogItems = await loadCatalogProducts();
      const searchInput = document.getElementById('productSearch');
      const activeFilters = {
        category: 'all',
        propiedad: 'all',
        material: 'all'
      };

      const filtrar = () => {
        const text = (searchInput?.value || '').toLowerCase().trim();
        const filtered = catalogItems.filter((p) => {
          const okCat = activeFilters.category === 'all' || p.categoria === activeFilters.category;
          const okProp = activeFilters.propiedad === 'all' || p.propiedad === activeFilters.propiedad;
          const okMat = activeFilters.material === 'all' || p.material === activeFilters.material;

          const tags = Array.isArray(p.tags) ? p.tags : [];
          const okTxt = !text ||
            String(p.nombre || '').toLowerCase().includes(text) ||
            String(p.categoria || '').toLowerCase().includes(text) ||
            tags.some(tag => String(tag || '').toLowerCase().includes(text));

          return okCat && okProp && okMat && okTxt;
        });
        renderCatalog(filtered);
      };

      // Aplicar filtro inicial desde URL si existe
      const urlParams = new URLSearchParams(window.location.search);
      const catParam = urlParams.get('categoria');
      if (catParam) {
        activeFilters.category = catParam;
        const btn = document.querySelector(`.filter-btn[data-value="${CSS.escape(catParam)}"]`);
        if (btn) {
          document.querySelectorAll('.filter-btn[data-filter="category"]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      }

      document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const filterType = btn.dataset.filter;
          const filterValue = btn.dataset.value;

          // Toggle active class within the same group
          const group = btn.closest('.filter-buttons');
          group.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));

          if (activeFilters[filterType] === filterValue && filterValue !== 'all') {
            activeFilters[filterType] = 'all';
            group.querySelector('[data-value="all"]')?.classList.add('active');
          } else {
            btn.classList.add('active');
            activeFilters[filterType] = filterValue;
          }

          filtrar();
        });
      });

      searchInput?.addEventListener('input', filtrar);
      filtrar();
    })();
  }

  if (document.getElementById('productDetail')) {
    (async () => {
      const catalogItems = await loadCatalogProducts();
      const params = new URLSearchParams(window.location.search);
      const id = Number(params.get('id')) || 1;
      const p = catalogItems.find((x) => Number(x.id) === id) || catalogItems[0];
      const detail = document.getElementById('productDetail');
      if (!p || !detail) return;

      // Actualizar metadata dinámicamente para SEO
      document.title = `${p.nombre} | Bandas Industriales | Gobree Belt`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', `${p.nombre}: ${p.descripcion} Material: ${p.material}. Soluciones técnicas en México.`);

      // Agregar Product Schema dinámico
      const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": p.nombre,
        "image": `https://gobreebelt.com${productImageSrc(p)}`,
        "description": p.descripcion,
        "brand": {
          "@type": "Brand",
          "name": "Gobree Belt"
        },
        "category": p.categoria,
        "material": p.material
      };
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(productSchema);
      document.head.appendChild(script);

      detail.innerHTML = `
        <h1>${escapeHtml(p.nombre)}</h1>
        <div class="product-detail">
          <img src="${escapeHtml(productImageSrc(p))}"
               alt="${escapeHtml(p.alt || p.nombre)}"
               title="${escapeHtml(p.title || p.nombre)}"
               width="600" height="400"
               loading="eager">
          <div>
            <p>${escapeHtml(p.descripcion)}</p>
            <ul class="spec-list">
              <li><strong>Categoría:</strong> ${escapeHtml(p.categoria)}</li>
              <li><strong>Material:</strong> ${escapeHtml(p.material)}</li>
              <li><strong>Propiedad principal:</strong> ${escapeHtml(p.propiedad)}</li>
              <li><strong>Tags:</strong> ${escapeHtml((Array.isArray(p.tags) ? p.tags : []).join(', '))}</li>
            </ul>
            <a class="btn" href="contacto.html">Solicitar cotización</a>
          </div>
        </div>
      `;
    })();
  }


  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    // Pre-llenar mensaje basado en parámetros URL
    const params = new URLSearchParams(window.location.search);
    const servicio = params.get('servicio');
    const mensajeArea = contactForm.querySelector('textarea[name="mensaje"], textarea');
    
    if (servicio && mensajeArea) {
      const serviciosMap = {
        'thermal-fusion-vulcanizado': 'Hola, me interesa solicitar el servicio de Thermal Fusion y Vulcanizado.',
        'instalacion': 'Hola, me interesa solicitar el servicio de Instalación de bandas transportadoras.',
        'asesoria': 'Hola, me interesa agendar una Asesoría Técnica especializada.'
      };
      mensajeArea.value = serviciosMap[servicio] || '';
    }

    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const privacyCheck = contactForm.querySelector('input[name="privacidad"]');
      if (privacyCheck && !privacyCheck.checked) {
        alert('Por favor, acepta el Aviso de Privacidad para continuar.');
        return;
      }

      const nombre = contactForm.querySelector('input[name="nombre"], input[type="text"]')?.value?.trim() || '';
      const correo = contactForm.querySelector('input[name="email"], input[type="email"]')?.value?.trim() || '';
      const telefono = contactForm.querySelector('input[name="telefono"]')?.value?.trim() || '';
      const industria = contactForm.querySelector('select[name="industria"]')?.value?.trim() || '';
      const mensaje = contactForm.querySelector('textarea[name="mensaje"], textarea')?.value?.trim() || '';

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          email: correo,
          telefono,
          industria,
          mensaje,
          source: window.location.pathname
        })
      })
        .then((r) => r.json().catch(() => ({})).then((data) => ({ ok: r.ok, data })))
        .then(({ ok }) => {
          if (!ok) throw new Error('send_failed');
          alert('Gracias. Tu solicitud fue enviada. Te contactaremos por correo o llamada.');
          contactForm.reset();
        })
        .catch(() => {
          alert('No se pudo enviar en este momento. Intenta de nuevo o llámanos al 55 5835 1555.');
        });
    });
  }

  document.querySelectorAll('.footer-glass-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const privacyCheck = form.querySelector('input[name="privacidad"]');
      if (privacyCheck && !privacyCheck.checked) {
        alert('Por favor, acepta el Aviso de Privacidad para continuar.');
        return;
      }

      const nombre = form.querySelector('input[name="nombre"]')?.value?.trim() || '';
      const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
      const telefono = form.querySelector('input[name="telefono"]')?.value?.trim() || '';
      const industria = form.querySelector('select[name="industria"]')?.value?.trim() || '';
      const mensaje = form.querySelector('textarea[name="mensaje"]')?.value?.trim() || '';

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          email,
          telefono,
          industria,
          mensaje,
          source: window.location.pathname + '#footer'
        })
      })
        .then((r) => r.json().catch(() => ({})).then((data) => ({ ok: r.ok, data })))
        .then(({ ok }) => {
          if (!ok) throw new Error('send_failed');
          alert('Gracias. Tu solicitud fue enviada. Te contactaremos por correo o llamada.');
          form.reset();
        })
        .catch(() => {
          alert('No se pudo enviar en este momento. Intenta de nuevo o llámanos al 55 5835 1555.');
        });
    });
  });
})();
