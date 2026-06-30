/**
 * gallery.js — Gallery filter + lightbox
 */

export function initGallery() {
  initFilters();
  initLightbox();
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────
function initFilters() {
  const filterBtns = document.querySelectorAll('.gallery-filter-btn');
  const items      = document.querySelectorAll('.gallery-item');

  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // Update active state
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show/hide items
      items.forEach(item => {
        const cat = item.dataset.category;
        const show = filter === 'all' || cat === filter;

        if (show) {
          item.classList.remove('hidden-item');
          item.style.animation = 'none';
          // Trigger reflow for animation restart
          void item.offsetHeight;
          item.style.animation = '';
        } else {
          item.classList.add('hidden-item');
        }
      });
    });
  });
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function initLightbox() {
  const lightbox  = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lb-img');
  const lbCaption = document.getElementById('lb-caption');
  const lbClose   = document.getElementById('lb-close');
  const lbPrev    = document.getElementById('lb-prev');
  const lbNext    = document.getElementById('lb-next');
  const lbBackdrop = document.getElementById('lb-backdrop');

  if (!lightbox) return;

  // Build ordered list of items (respects filter visibility)
  function getVisibleItems() {
    return Array.from(document.querySelectorAll('.gallery-item:not(.hidden-item)'));
  }

  let currentIndex = 0;

  function openLightbox(index, items) {
    const item = items[index];
    const img  = item.querySelector('img');
    const cap  = item.querySelector('.gallery-caption');

    lbImg.src         = img.src.replace('w=600', 'w=1200');
    lbImg.alt         = img.alt;
    lbCaption.textContent = cap ? cap.textContent : '';
    currentIndex      = index;

    lightbox.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    lbImg.focus();
  }

  function closeLightbox() {
    lightbox.setAttribute('hidden', '');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  function navigate(dir) {
    const items = getVisibleItems();
    if (!items.length) return;
    currentIndex = (currentIndex + dir + items.length) % items.length;
    const item = items[currentIndex];
    const img  = item.querySelector('img');
    const cap  = item.querySelector('.gallery-caption');

    // Transition out
    lbImg.style.opacity   = '0';
    lbImg.style.transform = `translateX(${dir > 0 ? '-20px' : '20px'})`;

    setTimeout(() => {
      lbImg.src             = img.src.replace('w=600', 'w=1200');
      lbImg.alt             = img.alt;
      lbCaption.textContent = cap ? cap.textContent : '';
      lbImg.style.opacity   = '1';
      lbImg.style.transform = 'none';
    }, 180);
  }

  // Attach transition styles
  if (lbImg) {
    lbImg.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
  }

  // Click on gallery item
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    const items = getVisibleItems();
    const index = items.indexOf(item);
    if (index === -1) return;
    openLightbox(index, items);
  });

  // Close
  lbClose?.addEventListener('click', closeLightbox);
  lbBackdrop?.addEventListener('click', closeLightbox);

  // Prev / Next
  lbPrev?.addEventListener('click', () => navigate(-1));
  lbNext?.addEventListener('click', () => navigate(+1));

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (lightbox.hasAttribute('hidden')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowLeft')   navigate(-1);
    if (e.key === 'ArrowRight')  navigate(+1);
  });

  // Touch swipe
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? +1 : -1);
  });
}
