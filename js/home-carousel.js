(() => {
  const homeCarousel = document.getElementById('homeCarousel');
  if (!homeCarousel) return;

  const indicatorsEl = document.getElementById('homeCarouselIndicators');
  const captionEl = document.getElementById('homeCarouselCaption');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');

  const createCarousel = (carouselEl, indicators, caption) => {
    let slides = Array.from(carouselEl.querySelectorAll('.hero-slide'));
    let items = slides.map((img) => ({ alt: img.getAttribute('alt') || 'Gobree Belt', caption: '' }));
    let currentSlide = 0;
    let autoPlayInterval;

    const setupSlides = (slideList) => {
      slideList.forEach((slide) => {
        slide.style.cursor = 'pointer';
        slide.onclick = () => {
          if (!lightbox || !lightboxImg) return;
          lightboxImg.src = slide.src;
          lightbox.classList.add('open');
          lightbox.setAttribute('aria-hidden', 'false');
        };
      });
    };
    const setCaption = (i) => { if (caption) caption.textContent = (items[i] && items[i].caption) || ''; };
    const stopAutoPlay = () => { if (autoPlayInterval) clearInterval(autoPlayInterval); };
    const nextSlide = () => setSlide(currentSlide + 1);
    const startAutoPlay = () => { stopAutoPlay(); autoPlayInterval = setInterval(nextSlide, 5000); };
    const buildIndicators = () => {
      if (!indicators) return;
      indicators.innerHTML = slides.map((_, i) => `<div class="indicator ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('');
      indicators.querySelectorAll('.indicator').forEach((ind) => {
        ind.addEventListener('click', () => setSlide(parseInt(ind.dataset.index, 10), { restart: true }));
      });
    };
    const setSlide = (index, action) => {
      if (!slides.length) return;
      const a = action || {};
      slides[currentSlide]?.classList.remove('active');
      if (indicators) Array.from(indicators.querySelectorAll('.indicator'))[currentSlide]?.classList.remove('active');
      currentSlide = (index + slides.length) % slides.length;
      slides[currentSlide]?.classList.add('active');
      if (indicators) Array.from(indicators.querySelectorAll('.indicator'))[currentSlide]?.classList.add('active');
      setCaption(currentSlide);
      if (a.restart) startAutoPlay();
    };

    const applyImages = (images) => {
      if (!Array.isArray(images) || !images.length) return;
      stopAutoPlay();
      currentSlide = 0;
      items = images.map((img) => ({ alt: img?.alt ? String(img.alt) : 'Gobree Belt', caption: img?.caption ? String(img.caption) : '' }));
      carouselEl.innerHTML = images.map((img, index) => `<img class="hero-slide ${index === 0 ? 'active' : ''}" src="${img.url}" alt="${img.alt || 'Gobree Belt'}" loading="${index === 0 ? 'eager' : 'lazy'}">`).join('');
      slides = Array.from(carouselEl.querySelectorAll('.hero-slide'));
      setupSlides(slides);
      buildIndicators();
      setCaption(0);
      startAutoPlay();
    };

    setupSlides(slides);
    buildIndicators();
    setCaption(0);
    startAutoPlay();
    return { applyImages };
  };

  const carousel = createCarousel(homeCarousel, indicatorsEl, captionEl);
  (async () => {
    try {
      const r = await fetch('/api/hero', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      if (data?.images?.length) carousel.applyImages(data.images);
    } catch (e) {}
  })();
})();
