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

  const heroSlides = document.querySelectorAll('.hero-carousel .hero-slide');
  if (heroSlides.length > 1) {
    let currentSlide = 0;
    setInterval(() => {
      heroSlides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % heroSlides.length;
      heroSlides[currentSlide].classList.add('active');
    }, 4500);
  }

  function renderCatalog(items) {
    const grid = document.getElementById('catalogGrid');
    if (!grid || typeof productos === 'undefined') return;

    if (!items.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>Sin resultados</h3>
          <p>Prueba con otra categoría o ajusta tu búsqueda.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map((p) => `
      <article class="card product-card">
        <img src="Bandasanitaria.png" alt="${p.nombre}" loading="lazy">
        <h3>${p.nombre}</h3>
        <p>${p.descripcion}</p>
        <a class="btn btn-secondary" href="producto.html?id=${p.id}">Ver ficha</a>
      </article>
    `).join('');
  }

  if (document.getElementById('catalogGrid') && typeof productos !== 'undefined') {
    let categoriaActiva = 'all';
    const searchInput = document.getElementById('productSearch');

    const filtrar = () => {
      const text = (searchInput?.value || '').toLowerCase().trim();
      const filtered = productos.filter((p) => {
        const okCat = categoriaActiva === 'all' || p.categoria === categoriaActiva;
        const okTxt = p.nombre.toLowerCase().includes(text) || p.descripcion.toLowerCase().includes(text) || p.industria.toLowerCase().includes(text);
        return okCat && okTxt;
      });
      renderCatalog(filtered);
    };

    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        categoriaActiva = btn.dataset.category || 'all';
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
        <img src="Bandasanitaria.png" alt="${p.nombre}" loading="lazy">
        <div>
          <p>${p.descripcion}</p>
          <ul class="spec-list">
            <li><strong>Material:</strong> ${p.material}</li>
            <li><strong>Temperatura máxima:</strong> ${p.temperatura}</li>
            <li><strong>Industria recomendada:</strong> ${p.industria}</li>
            <li><strong>Aplicaciones:</strong> ${p.aplicaciones}</li>
          </ul>
          <a class="btn" href="contacto.html">Solicitar cotización</a>
        </div>
      </div>
    `;
  }


  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
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
