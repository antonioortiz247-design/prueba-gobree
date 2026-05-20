(() => {
  const nav = document.getElementById('mainNav');
  const toggle = document.querySelector('.menu-toggle');
  if (!nav) return;

  const isMobileNav = () => window.matchMedia && window.matchMedia('(max-width: 980px)').matches;

  const ensureBackdrop = () => {
    let el = document.querySelector('.nav-backdrop');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'nav-backdrop';
    document.body.appendChild(el);
    return el;
  };

  const closeSubmenus = () => {
    nav.querySelectorAll('.nav-submenu.open').forEach((el) => el.classList.remove('open'));
  };

  if (toggle) {
    const backdrop = ensureBackdrop();
    toggle.setAttribute('aria-controls', 'mainNav');
    toggle.setAttribute('aria-expanded', 'false');

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
      if (!isMobileNav() || !nav.classList.contains('open')) return;
      const t = e.target;
      if (nav.contains(t) || toggle.contains(t) || backdrop.contains(t)) return;
      setOpen(false);
    });

    window.addEventListener('resize', () => {
      if (!isMobileNav()) setOpen(false);
    });
  }

  if (!document.getElementById('navDropdownStyles')) {
    const style = document.createElement('style');
    style.id = 'navDropdownStyles';
    style.textContent = `
      .nav-item-dropdown { position: relative; }
      .nav-item-dropdown > a { display: inline-flex; align-items: center; gap: .35rem; }
      .nav-item-dropdown > a::after { content: '▾'; font-size: .72em; opacity: .75; }
      .nav-submenu {
        position: absolute; top: calc(100% + .45rem); left: 0; min-width: 240px;
        background: #fff; border-radius: 10px; box-shadow: 0 10px 28px rgba(0,0,0,.14);
        padding: .45rem; display: none; z-index: 1000;
      }
      .nav-submenu.open { display: block; }
      .nav-submenu a { display:block; padding:.55rem .65rem; border-radius:8px; white-space:nowrap; }
      .nav-submenu a:hover { background: rgba(37, 99, 235, .10); }
      @media (max-width: 980px) {
        .nav-item-dropdown { width: 100%; }
        .nav-item-dropdown > a { width: 100%; justify-content: space-between; }
        .nav-submenu { position: static; box-shadow: none; border-radius: 0; padding: .1rem 0 .35rem .85rem; }
        .nav-submenu a { padding: .62rem .65rem; }
      }
    `;
    document.head.appendChild(style);
  }

  const menus = [
    { hrefs: ['sectores', 'sectores.html', '/sectores', '/sectores.html'], items: [
      { label: 'Alimentaria', url: '/sectores/alimentaria' },
      { label: 'Logística y Puertos', url: '/sectores/logistica-y-puertos' },
      { label: 'Industria Textil', url: '/sectores/industria-textil' },
      { label: 'Ver todos los sectores', url: '/sectores' }
    ]},
    { hrefs: ['productos', 'productos.html', '/productos', '/productos.html'], items: [
      { label: 'Bandas transportadoras', url: '/productos?categoria=Transportadoras%20Planas' },
      { label: 'Bandas dentadas', url: '/productos?categoria=Bandas%20Dentadas' },
      { label: 'Bandas modulares', url: '/productos?categoria=Bandas%20Modulares' },
      { label: 'Ver catálogo completo', url: '/productos' }
    ]}
  ];

  const normalizeHref = (href) => {
    const raw = (href || '').trim();
    if (!raw) return '';
    if (raw.startsWith('#')) return '';
    try {
      const parsed = new URL(raw, window.location.origin);
      return parsed.pathname.replace(/\/$/, '');
    } catch {
      return raw.split('#')[0].split('?')[0].replace(/^https?:\/\/[^/]+/i, '').replace(/\/$/, '');
    }
  };

  const resolveNavLink = (menu) => {
    const links = Array.from(nav.querySelectorAll('a[href]'));
    return links.find((a) => {
      if (a.parentElement?.classList.contains('nav-item-dropdown')) return false;
      const clean = normalizeHref(a.getAttribute('href'));
      if (!clean) return false;
      return menu.hrefs.some((candidate) => {
        const c = normalizeHref(candidate);
        return clean === c || clean.endsWith(`/${c.replace(/^\//, '')}`);
      });
    }) || null;
  };

  menus.forEach((menu) => {
    const link = resolveNavLink(menu);
    if (!link) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-item-dropdown';
    link.replaceWith(wrapper);
    wrapper.appendChild(link);
    const submenu = document.createElement('div');
    submenu.className = 'nav-submenu';
    submenu.setAttribute('aria-label', `Submenú ${link.textContent?.trim() || ''}`);
    submenu.innerHTML = menu.items.map((item) => `<a href="${item.url}">${item.label}</a>`).join('');
    wrapper.appendChild(submenu);

    const toggleSubmenu = (show) => submenu.classList.toggle('open', !!show);
    wrapper.addEventListener('mouseenter', () => toggleSubmenu(true));
    wrapper.addEventListener('mouseleave', () => toggleSubmenu(false));
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 980) {
        e.preventDefault();
        const open = !submenu.classList.contains('open');
        nav.querySelectorAll('.nav-submenu.open').forEach((el) => { if (el !== submenu) el.classList.remove('open'); });
        toggleSubmenu(open);
      }
    });
  });
})();
