(() => {
  document.querySelectorAll('a[href="index.html"], a[href="../index.html"], a[href="../../index.html"]').forEach((a) => {
    a.setAttribute('href', '/');
  });

  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return;

    const hashIndex = href.indexOf('#');
    const queryIndex = href.indexOf('?');
    const cut = Math.min(hashIndex === -1 ? href.length : hashIndex, queryIndex === -1 ? href.length : queryIndex);
    const path = href.slice(0, cut);
    const rest = href.slice(cut);

    if (path.endsWith('index.html')) {
      a.setAttribute('href', '/' + rest.replace(/^\/+/, ''));
      return;
    }
    if (path.endsWith('.html')) a.setAttribute('href', path.slice(0, -5) + rest);
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const targetId = a.getAttribute('href');
      if (!targetId) return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
