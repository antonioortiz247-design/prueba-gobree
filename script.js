(() => {
  const nav = document.getElementById('mainNav');
  const toggle = document.querySelector('.menu-toggle');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => nav.classList.remove('open'));
    });
  }

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

  const heroCarousel = document.getElementById('heroCarousel');
  if (heroCarousel) {
    let slides = Array.from(heroCarousel.querySelectorAll('.hero-slide'));
    const indicatorsContainer = document.querySelector('.carousel-indicators');
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');
    
    let currentSlide = 0;
    let autoPlayInterval;

    // Cargar imágenes desde localStorage si existen (Panel Admin)
    const storedImages = localStorage.getItem('heroImages');
    if (storedImages) {
      const images = JSON.parse(storedImages);
      if (images.length > 0) {
        heroCarousel.innerHTML = images.map((img, index) => `
          <img class="hero-slide ${index === 0 ? 'active' : ''}" 
               src="${img.url}" 
               alt="${img.alt || 'Gobree Belt'}" 
               loading="${index === 0 ? 'eager' : 'lazy'}">
        `).join('');
        slides = Array.from(heroCarousel.querySelectorAll('.hero-slide'));
      }
    }

    const updateCarousel = (index) => {
      slides[currentSlide].classList.remove('active');
      const indicators = document.querySelectorAll('.indicator');
      if (indicators.length) indicators[currentSlide].classList.remove('active');
      
      currentSlide = (index + slides.length) % slides.length;
      
      slides[currentSlide].classList.add('active');
      if (indicators.length) indicators[currentSlide].classList.add('active');
    };

    const nextSlide = () => updateCarousel(currentSlide + 1);
    const prevSlide = () => updateCarousel(currentSlide - 1);

    const startAutoPlay = () => {
      stopAutoPlay();
      autoPlayInterval = setInterval(nextSlide, 5000);
    };

    const stopAutoPlay = () => {
      if (autoPlayInterval) clearInterval(autoPlayInterval);
    };

    // Crear indicadores
    if (indicatorsContainer) {
      indicatorsContainer.innerHTML = slides.map((_, i) => `
        <div class="indicator ${i === 0 ? 'active' : ''}" data-index="${i}"></div>
      `).join('');
      
      indicatorsContainer.querySelectorAll('.indicator').forEach(ind => {
        ind.addEventListener('click', () => {
          updateCarousel(parseInt(ind.dataset.index));
          startAutoPlay();
        });
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); startAutoPlay(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAutoPlay(); });

    startAutoPlay();
  }

  function renderCatalog(items) {
    const grid = document.getElementById('catalogGrid');
    if (!grid || typeof productos === 'undefined') return;

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
        <h2 class="category-title">${cat}</h2>
        <div class="cards">
          ${products.map((p) => `
            <article class="card product-card">
              <img src="${p.img ? '/IMAGENES GOBREE/' + p.img : 'Bandasanitaria.png'}" 
                   alt="${p.alt || p.nombre}" 
                   title="${p.title || p.nombre}" 
                   loading="lazy">
              <div class="product-info">
                <h3>${p.nombre}</h3>
                <p class="product-desc">${p.descripcion}</p>
                <div class="product-meta">
                  <span><strong>Material:</strong> ${p.material}</span>
                  <span><strong>Propiedad:</strong> ${p.propiedad}</span>
                </div>
                <div class="product-tags">
                  ${p.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                <a class="btn btn-secondary" href="producto.html?id=${p.id}">Ver ficha</a>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  if (document.getElementById('catalogGrid') && typeof productos !== 'undefined') {
    const searchInput = document.getElementById('productSearch');
    const activeFilters = {
      category: 'all',
      propiedad: 'all',
      material: 'all'
    };

    const filtrar = () => {
      const text = (searchInput?.value || '').toLowerCase().trim();
      const filtered = productos.filter((p) => {
        const okCat = activeFilters.category === 'all' || p.categoria === activeFilters.category;
        const okProp = activeFilters.propiedad === 'all' || p.propiedad === activeFilters.propiedad;
        const okMat = activeFilters.material === 'all' || p.material === activeFilters.material;
        
        const okTxt = !text || 
          p.nombre.toLowerCase().includes(text) || 
          p.categoria.toLowerCase().includes(text) || 
          p.tags.some(tag => tag.toLowerCase().includes(text));

        return okCat && okProp && okMat && okTxt;
      });
      renderCatalog(filtered);
    };

    // Aplicar filtro inicial desde URL si existe
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('categoria');
    if (catParam) {
      activeFilters.category = catParam;
      const btn = document.querySelector(`.filter-btn[data-value="${catParam}"]`);
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
  }

  if (document.getElementById('productDetail') && typeof productos !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('id')) || 1;
    const p = productos.find((x) => x.id === id) || productos[0];
    const detail = document.getElementById('productDetail');
    detail.innerHTML = `
      <h1>${p.nombre}</h1>
      <div class="product-detail">
        <img src="${p.img ? '/IMAGENES GOBREE/' + p.img : 'Bandasanitaria.png'}" 
             alt="${p.alt || p.nombre}" 
             title="${p.title || p.nombre}" 
             loading="lazy">
        <div>
          <p>${p.descripcion}</p>
          <ul class="spec-list">
            <li><strong>Categoría:</strong> ${p.categoria}</li>
            <li><strong>Material:</strong> ${p.material}</li>
            <li><strong>Propiedad principal:</strong> ${p.propiedad}</li>
            <li><strong>Tags:</strong> ${p.tags.join(', ')}</li>
          </ul>
          <a class="btn" href="contacto.html">Solicitar cotización</a>
        </div>
      </div>
    `;
  }


  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    // Pre-llenar mensaje basado en parámetros URL
    const params = new URLSearchParams(window.location.search);
    const servicio = params.get('servicio');
    const mensajeArea = contactForm.querySelector('textarea[name="mensaje"], textarea');
    
    if (servicio && mensajeArea) {
      const serviciosMap = {
        'mantenimiento': 'Hola, me interesa solicitar el servicio de Mantenimiento Preventivo/Correctivo.',
        'instalacion': 'Hola, me interesa solicitar el servicio de Instalación de bandas transportadoras.',
        'asesoria': 'Hola, me interesa agendar una Asesoría Técnica especializada.'
      };
      mensajeArea.value = serviciosMap[servicio] || '';
    }

    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const nombre = contactForm.querySelector('input[name="nombre"], input[type="text"]')?.value?.trim() || '';
      const correo = contactForm.querySelector('input[name="email"], input[type="email"]')?.value?.trim() || '';
      const telefono = contactForm.querySelector('input[name="telefono"]')?.value?.trim() || '';
      const industria = contactForm.querySelector('select[name="industria"]')?.value?.trim() || '';
      const mensaje = contactForm.querySelector('textarea[name="mensaje"], textarea')?.value?.trim() || '';

      const asunto = encodeURIComponent('Solicitud de cotización - Gobree Belt');
      const cuerpo = encodeURIComponent([
        'Hola, quiero una cotización de Gobree Belt.',
        nombre ? `Nombre: ${nombre}` : '',
        correo ? `Correo: ${correo}` : '',
        telefono ? `Teléfono: ${telefono}` : '',
        industria ? `Industria: ${industria}` : '',
        mensaje ? `Mensaje: ${mensaje}` : ''
      ].filter(Boolean).join('\n'));

      window.location.href = `mailto:contacto@gobreebelt.com?subject=${asunto}&body=${cuerpo}`;
      alert('Gracias por contactarnos. Se abrirá tu cliente de correo para enviar la solicitud.');
      contactForm.reset();
    });
  }

  document.querySelectorAll('.footer-glass-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = form.querySelector('input[name="nombre"]')?.value?.trim() || '';
      const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
      const telefono = form.querySelector('input[name="telefono"]')?.value?.trim() || '';
      const industria = form.querySelector('select[name="industria"]')?.value?.trim() || '';
      const mensaje = form.querySelector('textarea[name="mensaje"]')?.value?.trim() || '';
      const asunto = encodeURIComponent('Solicitud de asesoría - Formulario footer Gobree Belt');
      const cuerpo = encodeURIComponent([
        'Hola, me interesa una cotización de bandas transportadoras.',
        nombre ? `Nombre: ${nombre}` : '',
        email ? `Correo de contacto: ${email}` : '',
        telefono ? `Teléfono: ${telefono}` : '',
        industria ? `Industria: ${industria}` : '',
        mensaje ? `Detalle: ${mensaje}` : ''
      ].filter(Boolean).join('\n'));
      window.location.href = `mailto:contacto@gobreebelt.com?subject=${asunto}&body=${cuerpo}`;
      form.reset();
    });
  });
})();
