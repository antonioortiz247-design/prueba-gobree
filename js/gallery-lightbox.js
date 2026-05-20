(() => {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  if (!lightbox || !lightboxImg) return;

  document.querySelectorAll('.gallery-img').forEach((img) => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
    });
  });

  document.querySelectorAll('.close, #lightbox').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target === el || el.classList.contains('close')) {
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
      }
    });
  });
})();
