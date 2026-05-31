(() => {
  if (!window.__GOBREE_NAV_BOUND__) {
    const nav = document.getElementById('mainNav');
    const toggle = document.querySelector('.menu-toggle');
    const isMobileNav = () => window.matchMedia && window.matchMedia('(max-width: 980px)').matches;

    const ensureBackdrop = () => {
      let el = document.querySelector('.nav-backdrop');
      if (el) return el;
      el = document.createElement('div');
      el.className = 'nav-backdrop';
      document.body.appendChild(el);
      return el;
    };

    if (toggle && nav) {
      const backdrop = ensureBackdrop();
      toggle.setAttribute('aria-controls', 'mainNav');
      toggle.setAttribute('aria-expanded', 'false');

      const closeSubmenus = () => {
        nav.querySelectorAll('.nav-submenu.open').forEach((el) => el.classList.remove('open'));
      };

      const setOpen = (open) => {
        const next = !!open;
        nav.classList.toggle('open', next);
        document.body.classList.toggle('nav-open', next);
        backdrop.classList.toggle('open', next);
        toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
        toggle.setAttribute('aria-label', next ? 'Cerrar menú' : 'Abrir menú');
        if (!next) closeSubmenus();
      };

      toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
      backdrop.addEventListener('click', () => setOpen(false));

      nav.addEventListener('click', (e) => {
        const link = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!link) return;
        if (isMobileNav() && link.parentElement?.classList.contains('nav-item-dropdown')) return;
        setOpen(false);
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setOpen(false);
      });

      document.addEventListener('click', (e) => {
        if (!isMobileNav()) return;
        if (!nav.classList.contains('open')) return;
        const t = e.target;
        if (nav.contains(t) || toggle.contains(t) || backdrop.contains(t)) return;
        setOpen(false);
      });

      window.addEventListener('resize', () => {
        if (!isMobileNav()) setOpen(false);
      });
    }
  }

  document.querySelectorAll('a[href="index.html"], a[href="../index.html"], a[href="../../index.html"]').forEach((a) => {
    a.setAttribute('href', '/');
  });

  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    if (href.startsWith('#')) return;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

    const hashIndex = href.indexOf('#');
    const queryIndex = href.indexOf('?');
    const cut = Math.min(
      hashIndex === -1 ? href.length : hashIndex,
      queryIndex === -1 ? href.length : queryIndex
    );
    const path = href.slice(0, cut);
    const rest = href.slice(cut);

    if (path.endsWith('index.html')) {
      a.setAttribute('href', '/' + rest.replace(/^\/+/, ''));
      return;
    }

    if (path.endsWith('.html')) {
      a.setAttribute('href', path.slice(0, -5) + rest);
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const targetId = a.getAttribute('href');
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  document.querySelectorAll('.gallery-img').forEach((img) => {
    img.addEventListener('click', () => {
      if (!lightbox || !lightboxImg) return;
      lightboxImg.src = img.src;
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
    });
  });
  document.querySelectorAll('.close, #lightbox').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target === el || el.classList.contains('close')) {
        lightbox?.classList.remove('open');
        lightbox?.setAttribute('aria-hidden', 'true');
      }
    });
  });

  const homeCarousel = document.getElementById('homeCarousel');
  if (homeCarousel) {
    const indicatorsEl = document.getElementById('homeCarouselIndicators');
    const captionEl = document.getElementById('homeCarouselCaption');

      const createCarousel = (carouselEl, indicators, caption) => {
        let slides = Array.from(carouselEl.querySelectorAll('.hero-slide'));

        // Agregar funcionalidad de lightbox de forma robusta
        const setupSlides = (slideList) => {
          slideList.forEach((slide) => {
            slide.style.cursor = 'pointer';
            // Simplemente asignamos el evento (sin clonar innecesariamente)
            slide.onclick = () => {
              if (!lightbox || !lightboxImg) return;
              lightboxImg.src = slide.src;
              lightbox.classList.add('open');
              lightbox.setAttribute('aria-hidden', 'false');
            };
          });
        };

        setupSlides(slides);

        let items = slides.map((img) => ({
        alt: img.getAttribute('alt') || 'Gobree Belt',
        caption: ''
      }));
      let currentSlide = 0;
      let autoPlayInterval;

      const setCaption = (i) => {
        if (!caption) return;
        const text = (items[i] && items[i].caption) || '';
        caption.textContent = text;
      };

      const buildIndicators = () => {
        if (!indicators) return;
        indicators.innerHTML = slides
          .map((_, i) => `<div class="indicator ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`)
          .join('');
        indicators.querySelectorAll('.indicator').forEach((ind) => {
          ind.addEventListener('click', () => {
            setSlide(parseInt(ind.dataset.index), { restart: true });
          });
        });
      };

      const setSlide = (index, action) => {
        const a = action || {};
        if (!slides.length) return;

        slides[currentSlide].classList.remove('active');
        if (indicators) {
          const inds = Array.from(indicators.querySelectorAll('.indicator'));
          if (inds[currentSlide]) inds[currentSlide].classList.remove('active');
        }

        currentSlide = (index + slides.length) % slides.length;

        slides[currentSlide].classList.add('active');
        if (indicators) {
          const inds = Array.from(indicators.querySelectorAll('.indicator'));
          if (inds[currentSlide]) inds[currentSlide].classList.add('active');
        }

        setCaption(currentSlide);
        if (a.restart) startAutoPlay();
      };

      const nextSlide = () => setSlide(currentSlide + 1);

      const startAutoPlay = () => {
        stopAutoPlay();
        autoPlayInterval = setInterval(nextSlide, 5000);
      };

      const stopAutoPlay = () => {
        if (autoPlayInterval) clearInterval(autoPlayInterval);
      };

      const applyImages = (images) => {
          if (!Array.isArray(images) || !images.length) return;
          stopAutoPlay();
          currentSlide = 0;
          items = images.map((img) => ({
            alt: img && img.alt ? String(img.alt) : 'Gobree Belt',
            caption: img && img.caption ? String(img.caption) : ''
          }));
          carouselEl.innerHTML = images
            .map(
              (img, index) => `
            <img class="hero-slide ${index === 0 ? 'active' : ''}"
                 src="${img.url}"
                 alt="${img.alt || 'Gobree Belt'}"
                 loading="${index === 0 ? 'eager' : 'lazy'}">
          `
            )
            .join('');
          slides = Array.from(carouselEl.querySelectorAll('.hero-slide'));
           setupSlides(slides);
           buildIndicators();
          setCaption(0);
          startAutoPlay();
        };

      buildIndicators();
      setCaption(0);
      startAutoPlay();

      return { applyImages };
    };

    const c = createCarousel(homeCarousel, indicatorsEl, captionEl);

    (async () => {
      try {
        const r = await fetch('/api/content?type=hero', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        if (data?.images?.length) {
          c.applyImages(data.images);
        }
      } catch (e) {}
    })();
  }

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

      // Botón trigger para el modal (como en proyectos.html)
      const trigger = document.createElement('button');
      trigger.className = `project-media media-trigger ${mediaType === 'video' ? 'project-video' : ''}`;
      trigger.type = 'button';
      trigger.dataset.type = mediaType;
      trigger.dataset.src = mediaSrc;
      trigger.dataset.poster = mediaPoster || '';
      trigger.dataset.alt = mediaAlt;

      const img = document.createElement('img');
      img.src = src;
      img.alt = mediaAlt;
      img.loading = 'lazy';
      img.width = 400;
      img.height = 250;

      trigger.appendChild(img);

      const h3 = document.createElement('h3');
      h3.textContent = title;

      const p = document.createElement('p');
      p.textContent = description;

      const a = document.createElement('a');
      a.className = 'text-link';
      a.href = '/proyectos';
      a.textContent = 'Ver proyectos →';

      card.appendChild(tag);
      card.appendChild(trigger);
      card.appendChild(h3);
      if (description) card.appendChild(p);
      card.appendChild(a);

      return card;
    };

    const bindHomeMediaTriggers = () => {
      const modal = document.getElementById('mediaModal');
      const content = document.getElementById('mediaModalContent');
      const triggers = document.querySelectorAll('#homeProjectsGrid .media-trigger');
      if (!modal || !content) return;

      triggers.forEach((el) => {
        el.onclick = () => {
          const type = el.dataset.type;
          const src = el.dataset.src;
          if (!src) return;
          if (type === 'video') {
            content.innerHTML = `<video controls autoplay playsinline poster="${el.dataset.poster || ''}"><source src="${src}" type="video/mp4">Tu navegador no soporta video HTML5.</video>`;
          } else {
            content.innerHTML = `<img src="${src}" alt="${el.dataset.alt || 'Proyecto'}">`;
          }
          modal.classList.add('open');
          modal.setAttribute('aria-hidden', 'false');
        };
      });

      const closeBtn = document.getElementById('mediaModalClose');
      const closeModal = () => {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        content.innerHTML = '';
      };
      if (closeBtn) closeBtn.onclick = closeModal;
      modal.onclick = (e) => { if (e.target === modal) closeModal(); };
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    };

    (async () => {
      try {
        const r = await fetch('/api/content?type=projects', { cache: 'no-store' });
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
        bindHomeMediaTriggers();
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
      const r = await fetch('/api/content?type=products', { cache: 'no-store' });
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
        'thermal-fusion-vulcanizado': 'Hola, me interesa solicitar el servicio de termofusión y vulcanizado.',
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
    if (!form.querySelector('input[name="privacidad"]')) {
      const wrapper = document.createElement('div');
      wrapper.style.marginTop = '1rem';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'flex-start';
      wrapper.style.gap = '0.5rem';
      wrapper.style.fontSize = '0.9rem';

      const id = `privacy-check-footer-${Math.random().toString(36).slice(2, 9)}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = id;
      checkbox.name = 'privacidad';
      checkbox.required = true;
      checkbox.style.width = 'auto';
      checkbox.style.marginTop = '0.2rem';

      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.style.marginTop = '0';
      label.innerHTML =
        'Acepto el <a href="/aviso-privacidad" target="_blank" style="color:inherit; text-decoration:underline;">Aviso de Privacidad</a>';

      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);

      const submit = form.querySelector('button[type="submit"], button');
      if (submit && submit.parentNode === form) {
        form.insertBefore(wrapper, submit);
      } else {
        form.appendChild(wrapper);
      }
    }

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
