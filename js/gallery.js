/**
 * gallery.js — Guest photo gallery with category filter + upload
 *
 * Upload flow:
 *   1. Resize image client-side
 *   2. Upload to ImgBB (free image host) → get a permanent URL
 *   3. POST { action:'gallery', category, imageUrl } to Apps Script
 *   4. Apps Script saves a row to the Gallery sheet
 *   5. Gallery fetches rows and renders using imageUrl
 *
 * Configure both keys in js/config.js.
 */

import { SCRIPT_URL, IMGBB_KEY } from './config.js';
const GALLERY_SCRIPT_URL = SCRIPT_URL;

const MAX_FILE_BYTES  = 5 * 1024 * 1024; // 5 MB
const MAX_IMG_DIM     = 1200;             // resize longest edge to this before upload

// Category display labels
const CATEGORY_LABELS = {
  pengantin: 'Pengantin',
  tetamu:    'Tetamu',
  majlis:    'Majlis',
  makanan:   'Makanan',
  lain:      'Lain-lain',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Resize an image File to at most MAX_IMG_DIM on the longest edge, return base64 string */
function resizeAndEncode(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        let targetW = w, targetH = h;
        if (w > MAX_IMG_DIM || h > MAX_IMG_DIM) {
          if (w >= h) { targetW = MAX_IMG_DIM; targetH = Math.round(h * MAX_IMG_DIM / w); }
          else        { targetH = MAX_IMG_DIM; targetW = Math.round(w * MAX_IMG_DIM / h); }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = targetW;
        canvas.height = targetH;
        canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function showUploadAlert(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className   = `gallery-upload-alert ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

// ─── Carousel state ───────────────────────────────────────────────────────────
const carouselState = {
  photos:      [],  // full filtered list
  page:        0,
  pageSize:    () => window.innerWidth <= 768 ? 6 : 8,
  totalPages:  function() { return Math.ceil(this.photos.length / this.pageSize()) || 1; },
};

// ─── Render grid (one page at a time) ────────────────────────────────────────
function renderPhotos(photos, grid, emptyEl, activeFilter) {
  // Store filtered photos in carousel state and reset to page 0
  const filtered = activeFilter === 'all'
    ? photos
    : photos.filter(p => p.category === activeFilter);

  carouselState.photos = filtered;
  carouselState.page   = 0;

  // Update count
  const countEl = document.getElementById('gallery-photo-count');
  if (countEl) countEl.textContent = filtered.length;

  renderPage(grid, emptyEl);
  updateCarouselControls();
}

function renderPage(grid, emptyEl) {
  grid.innerHTML = '';

  const { photos, page } = carouselState;
  const ps    = carouselState.pageSize();
  const start = page * ps;
  const slice = photos.slice(start, start + ps);

  if (!photos.length) {
    emptyEl?.classList.remove('hidden');
    return;
  }
  emptyEl?.classList.add('hidden');

  slice.forEach((photo, i) => {
    // Support imageUrl (live), driveUrl (old), imageBase64/URL (demo)
    const src = photo.imageUrl || photo.driveUrl || photo.imageBase64 || '';
    if (!src) return;

    const catLabel = CATEGORY_LABELS[photo.category] || photo.category || '';

    const fig = document.createElement('figure');
    fig.className        = 'gallery-item';
    fig.dataset.category = photo.category || 'lain';
    fig.dataset.index    = String(start + i); // absolute index across all pages

    fig.innerHTML = `
      <img src="${escapeHtml(src)}" alt="${escapeHtml(photo.caption || catLabel + ' — ' + (photo.uploader || ''))}" loading="lazy" />
      ${photo.caption ? `<figcaption class="gallery-caption">${escapeHtml(photo.caption)}</figcaption>` : ''}
      <span class="gallery-item-badge">${escapeHtml(catLabel)}</span>
    `;

    grid.appendChild(fig);
  });

  // Slide-in animation direction
  grid.classList.remove('slide-left', 'slide-right');
  void grid.offsetWidth; // reflow
  grid.classList.add('slide-in');
  setTimeout(() => grid.classList.remove('slide-in'), 350);
}

function updateCarouselControls() {
  const prevBtn   = document.getElementById('gallery-prev');
  const nextBtn   = document.getElementById('gallery-next');
  const dotsWrap  = document.getElementById('gallery-dots');
  const pageLabel = document.getElementById('gallery-page-label');

  const total = carouselState.totalPages();
  const cur   = carouselState.page;

  if (prevBtn) prevBtn.disabled = cur === 0;
  if (nextBtn) nextBtn.disabled = cur === total - 1;

  // Dots
  if (dotsWrap) {
    dotsWrap.innerHTML = '';
    // Only show dots if more than 1 page
    if (total > 1) {
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('button');
        dot.className   = 'gallery-dot' + (i === cur ? ' active' : '');
        dot.setAttribute('aria-label', `Halaman ${i + 1}`);
        dot.dataset.page = String(i);
        dotsWrap.appendChild(dot);
      }
    }
  }

  if (pageLabel && total > 1) {
    pageLabel.textContent = `${cur + 1} / ${total}`;
    pageLabel.style.display = '';
  } else if (pageLabel) {
    pageLabel.style.display = 'none';
  }
}

function navigatePage(dir, grid, emptyEl) {
  const total = carouselState.totalPages();
  const next  = carouselState.page + dir;
  if (next < 0 || next >= total) return;

  // Add directional class before swap
  grid.classList.add(dir > 0 ? 'exit-left' : 'exit-right');
  setTimeout(() => {
    carouselState.page = next;
    grid.classList.remove('exit-left', 'exit-right');
    renderPage(grid, emptyEl);
    updateCarouselControls();
  }, 220);
}

// ─── Fetch photos ─────────────────────────────────────────────────────────────
async function fetchPhotos(grid, emptyEl, skeletonEl, activeFilter) {
  if (!GALLERY_SCRIPT_URL) return [];

  skeletonEl?.classList.remove('hidden');
  grid.innerHTML = '';

  try {
    const res  = await fetch(`${GALLERY_SCRIPT_URL}?action=gallery&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    skeletonEl?.classList.add('hidden');
    const photos = Array.isArray(data) ? data : [];
    renderPhotos(photos, grid, emptyEl, activeFilter);
    return photos;
  } catch (err) {
    console.error('[Gallery] Fetch error:', err);
    skeletonEl?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');
    return [];
  }
}

// ─── Upload to ImgBB then save metadata to Sheets ────────────────────────────
async function uploadToImgBB(base64DataUrl) {
  // Strip the data URL prefix — ImgBB wants raw base64
  const raw = base64DataUrl.replace(/^data:[^;]+;base64,/, '');
  const form = new FormData();
  form.append('key',    IMGBB_KEY);
  form.append('image',  raw);

  const res  = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`ImgBB HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`ImgBB error: ${json.error?.message || 'unknown'}`);
  // Return the display URL (medium size if available, else full)
  return json.data.medium?.url || json.data.url;
}

async function submitPhoto(payload, alertEl, btnEl, btnText, btnLoading) {
  btnEl.disabled = true;
  btnText.classList.add('hidden');
  btnLoading.classList.remove('hidden');

  try {
    // Step 1 — upload image to ImgBB
    const imageUrl = await uploadToImgBB(payload.imageBase64);

    // Step 2 — save metadata (URL, not base64) to Google Sheets
    await fetch(GALLERY_SCRIPT_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify({
        action:   'gallery',
        category: payload.category,
        imageUrl,
      }),
    });

    showUploadAlert(alertEl, 'Gambar berjaya dihantar! 📸', 'success');
    return true;
  } catch (err) {
    console.error('[Gallery] Upload error:', err);
    showUploadAlert(alertEl, 'Gagal menghantar gambar. Cuba lagi.', 'error');
    return false;
  } finally {
    btnEl.disabled = false;
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
  }
}

// ─── Upload modal open/close ──────────────────────────────────────────────────
function initUploadModal() {
  const modal     = document.getElementById('gallery-upload-modal');
  const openBtn   = document.getElementById('gallery-upload-open-btn');
  const closeBtn  = document.getElementById('gallery-modal-close');
  const backdrop  = document.getElementById('gallery-modal-backdrop');

  if (!modal) return;

  function openModal() {
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    closeBtn?.focus();
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    openBtn?.focus();
  }

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (!modal.hasAttribute('hidden') && e.key === 'Escape') closeModal();
  });
}


function initUploadForm(onSuccess) {
  const form        = document.getElementById('gallery-upload-form');
  const fileInput   = document.getElementById('upload-file');
  const dropZone    = document.getElementById('upload-drop-zone');
  const dropInner   = document.getElementById('upload-drop-inner');
  const previewWrap = document.getElementById('upload-preview-wrap');
  const previewImg  = document.getElementById('upload-preview-img');
  const removeBtn   = document.getElementById('upload-preview-remove');
  const nameInput   = document.getElementById('upload-name');
  const catSelect   = document.getElementById('upload-category');
  const captionInput= document.getElementById('upload-caption');
  const nameErr     = document.getElementById('upload-name-err');
  const catErr      = document.getElementById('upload-cat-err');
  const fileErr     = document.getElementById('upload-file-err');
  const alertEl     = document.getElementById('gallery-upload-alert');
  const submitBtn   = document.getElementById('gallery-upload-btn');
  const btnText     = submitBtn?.querySelector('.gallery-upload-btn-text');
  const btnLoading  = submitBtn?.querySelector('.gallery-upload-btn-loading');

  if (!form) {
    console.error('[Gallery] Upload form not found — cannot init');
    return;
  }

  let selectedFile = null;

  function showPreview(file) {
    selectedFile = file;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewWrap.classList.remove('hidden');
    dropInner.classList.add('hidden');
  }

  function clearPreview() {
    selectedFile = null;
    previewImg.src = '';
    previewWrap.classList.add('hidden');
    dropInner.classList.remove('hidden');
    fileInput.value = '';
  }

  // File input change
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) showPreview(fileInput.files[0]);
  });

  // Remove preview
  removeBtn?.addEventListener('click', clearPreview);

  // Click on drop zone opens file picker
  dropZone.addEventListener('click', (e) => {
    if (e.target === removeBtn) return;
    if (!selectedFile) fileInput.click();
  });
  dropZone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !selectedFile) fileInput.click();
  });

  // Drag and drop
  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', ()  => { dropZone.classList.remove('drag-over'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) showPreview(file);
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear errors
    [catErr, fileErr].forEach(el => { if (el) el.textContent = ''; });
    catSelect?.classList.remove('invalid');

    const category = catSelect?.value || '';
    let valid = true;

    if (!category) {
      if (catErr) catErr.textContent = 'Sila pilih kategori.';
      catSelect?.classList.add('invalid');
      valid = false;
    }
    if (!selectedFile) {
      if (fileErr) fileErr.textContent = 'Sila pilih gambar.';
      valid = false;
    } else if (selectedFile.size > MAX_FILE_BYTES) {
      if (fileErr) fileErr.textContent = 'Gambar terlalu besar. Maks 5 MB.';
      valid = false;
    }

    if (!valid) return;

    try {
      const imageBase64 = await resizeAndEncode(selectedFile);
      const ok = await submitPhoto({ category, caption: '', uploader: '', imageBase64 }, alertEl, submitBtn, btnText, btnLoading);
      if (ok) {
        form.reset();
        clearPreview();
        setTimeout(() => {
          document.getElementById('gallery-upload-modal')?.setAttribute('hidden', '');
          document.body.style.overflow = '';
          document.getElementById('gallery-upload-open-btn')?.focus();
        }, 1800);
        onSuccess();
      }
    } catch (err) {
      console.error('[Gallery] Encode error:', err);
      showUploadAlert(alertEl, 'Gagal memproses gambar. Cuba lagi.', 'error');
    }
  });
}

// ─── Demo mode (no backend) ───────────────────────────────────────────────────
function setupDemoMode(grid, emptyEl, skeletonEl) {
  skeletonEl?.classList.add('hidden');

  const demo = [
    { uploader: 'Siti Aminah',  category: 'pengantin', caption: 'Pengantin cantik!',        imageBase64: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&q=75', time: '' },
    { uploader: 'Ahmad Fadzil', category: 'tetamu',    caption: 'Bersama keluarga',          imageBase64: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=75', time: '' },
    { uploader: 'Nur Hafiza',   category: 'majlis',    caption: 'Hiasan dewan yang cantik',  imageBase64: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?w=900&q=75', time: '' },
    { uploader: 'Rizal Hakim',  category: 'makanan',   caption: 'Hidangan sedap!',           imageBase64: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=75', time: '' },
    { uploader: 'Farah Liyana', category: 'pengantin', caption: 'Akad nikah',                imageBase64: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=75', time: '' },
    { uploader: 'Zulaikha',     category: 'lain',      caption: 'Kenangan manis',            imageBase64: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=600&q=75', time: '' },
  ];

  // sessionStorage for submitted photos in demo mode
  const stored = JSON.parse(sessionStorage.getItem('gallery_photos') || '[]');
  let allPhotos = [...stored, ...demo];

  function rerender(filter) {
    renderPhotos(allPhotos, grid, emptyEl, filter || getCurrentFilter());
  }

  function getCurrentFilter() {
    return document.querySelector('.gallery-filter-btn.active')?.dataset.filter || 'all';
  }

  rerender('all');

  // Intercept upload form in demo mode
  const form       = document.getElementById('gallery-upload-form');
  const fileInput  = document.getElementById('upload-file');
  const dropZone   = document.getElementById('upload-drop-zone');
  const dropInner  = document.getElementById('upload-drop-inner');
  const previewWrap= document.getElementById('upload-preview-wrap');
  const previewImg = document.getElementById('upload-preview-img');
  const removeBtn  = document.getElementById('upload-preview-remove');
  const nameInput  = document.getElementById('upload-name');
  const catSelect  = document.getElementById('upload-category');
  const captionInput= document.getElementById('upload-caption');
  const nameErr    = document.getElementById('upload-name-err');
  const catErr     = document.getElementById('upload-cat-err');
  const fileErr    = document.getElementById('upload-file-err');
  const alertEl    = document.getElementById('gallery-upload-alert');
  const submitBtn  = document.getElementById('gallery-upload-btn');
  const btnText    = submitBtn?.querySelector('.gallery-upload-btn-text');
  const btnLoading = submitBtn?.querySelector('.gallery-upload-btn-loading');

  let selectedFile = null;

  function showPreview(file) {
    selectedFile = file;
    previewImg.src = URL.createObjectURL(file);
    previewWrap.classList.remove('hidden');
    dropInner.classList.add('hidden');
  }
  function clearPreview() {
    selectedFile = null;
    previewImg.src = '';
    previewWrap.classList.add('hidden');
    dropInner.classList.remove('hidden');
    fileInput.value = '';
  }

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) showPreview(fileInput.files[0]); });
  removeBtn?.addEventListener('click', clearPreview);
  dropZone.addEventListener('click',   (e) => { if (e.target !== removeBtn && !selectedFile) fileInput.click(); });
  dropZone.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !selectedFile) fileInput.click(); });
  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) showPreview(file);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    [nameErr, catErr, fileErr].forEach(el => { if (el) el.textContent = ''; });
    [nameInput, catSelect].forEach(el => el?.classList.remove('invalid'));

    const uploader = nameInput?.value.trim() || '';
    const category = catSelect?.value || '';
    const caption  = captionInput?.value.trim() || '';
    let valid = true;

    if (uploader.length < 2) { if (nameErr) nameErr.textContent = 'Sila masukkan nama anda.'; nameInput?.classList.add('invalid'); valid = false; }
    if (!category)           { if (catErr)  catErr.textContent  = 'Sila pilih kategori.';     catSelect?.classList.add('invalid'); valid = false; }
    if (!selectedFile)       { if (fileErr) fileErr.textContent = 'Sila pilih gambar.'; valid = false; }
    else if (selectedFile.size > MAX_FILE_BYTES) { if (fileErr) fileErr.textContent = 'Gambar terlalu besar. Maks 5 MB.'; valid = false; }
    if (!valid) return;

    if (btnText)    btnText.classList.add('hidden');
    if (btnLoading) btnLoading.classList.remove('hidden');
    if (submitBtn)  submitBtn.disabled = true;

    try {
      const imageBase64 = await resizeAndEncode(selectedFile);
      const newPhoto = { uploader, category, caption, imageBase64, time: new Date().toISOString() };
      const freshStored = JSON.parse(sessionStorage.getItem('gallery_photos') || '[]');
      freshStored.unshift(newPhoto);
      sessionStorage.setItem('gallery_photos', JSON.stringify(freshStored));
      allPhotos = [...freshStored, ...demo];
      form.reset();
      clearPreview();
      rerender(getCurrentFilter());
      showUploadAlert(alertEl, 'Gambar berjaya dihantar! 📸 (Demo — pasang Google Sheets untuk simpanan kekal)', 'success');
      setTimeout(() => {
        document.getElementById('gallery-upload-modal')?.setAttribute('hidden', '');
        document.body.style.overflow = '';
        document.getElementById('gallery-upload-open-btn')?.focus();
      }, 1800);
    } catch {
      showUploadAlert(alertEl, 'Gagal memproses gambar. Cuba lagi.', 'error');
    } finally {
      if (btnText)    btnText.classList.remove('hidden');
      if (btnLoading) btnLoading.classList.add('hidden');
      if (submitBtn)  submitBtn.disabled = false;
    }
  });

  return rerender;
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────
function initFilters(onFilterChange) {
  const filterBtns = document.querySelectorAll('.gallery-filter-btn');
  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onFilterChange(btn.dataset.filter);
    });
  });
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function initLightbox() {
  const lightbox   = document.getElementById('lightbox');
  const lbImg      = document.getElementById('lb-img');
  const lbCaption  = document.getElementById('lb-caption');
  const lbClose    = document.getElementById('lb-close');
  const lbPrev     = document.getElementById('lb-prev');
  const lbNext     = document.getElementById('lb-next');
  const lbBackdrop = document.getElementById('lb-backdrop');

  if (!lightbox) return;

  // Lightbox navigates across ALL filtered photos, not just the current page
  let currentIndex = 0;

  function getPhoto(index) {
    return carouselState.photos[index] || null;
  }

  function openLightbox(index) {
    const photo = getPhoto(index);
    if (!photo) return;
    lbImg.src             = photo.imageUrl || photo.driveUrl || photo.imageBase64 || '';
    lbImg.alt             = photo.caption || photo.uploader || '';
    lbCaption.textContent = photo.caption || '';
    currentIndex          = index;
    lightbox.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function closeLightbox() {
    lightbox.setAttribute('hidden', '');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  function navigate(dir) {
    const total = carouselState.photos.length;
    if (!total) return;
    currentIndex = (currentIndex + dir + total) % total;
    const photo = getPhoto(currentIndex);
    lbImg.style.opacity   = '0';
    lbImg.style.transform = `translateX(${dir > 0 ? '-20px' : '20px'})`;
    setTimeout(() => {
      lbImg.src             = photo.imageUrl || photo.driveUrl || photo.imageBase64 || '';
      lbImg.alt             = photo.caption || photo.uploader || '';
      lbCaption.textContent = photo.caption || '';
      lbImg.style.opacity   = '1';
      lbImg.style.transform = 'none';
    }, 180);
  }

  if (lbImg) lbImg.style.transition = 'opacity 0.18s ease, transform 0.18s ease';

  // Open lightbox on grid item click — map to absolute index via data-index
  document.addEventListener('click', (e) => {
    const item = e.target.closest('#gallery-grid .gallery-item');
    if (!item) return;
    const idx = parseInt(item.dataset.index, 10);
    if (!isNaN(idx)) openLightbox(idx);
  });

  lbClose?.addEventListener('click', closeLightbox);
  lbBackdrop?.addEventListener('click', closeLightbox);
  lbPrev?.addEventListener('click', () => navigate(-1));
  lbNext?.addEventListener('click', () => navigate(+1));

  document.addEventListener('keydown', (e) => {
    if (lightbox.hasAttribute('hidden')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(+1);
  });

  let touchStartX = 0;
  lightbox.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? +1 : -1);
  });
}

// ─── Main init ────────────────────────────────────────────────────────────────
export function initGallery() {
  const grid       = document.getElementById('gallery-grid');
  const emptyEl    = document.getElementById('gallery-empty');
  const skeletonEl = document.getElementById('gallery-skeleton');
  const noticeEl   = document.getElementById('gallery-config-notice');
  const prevBtn    = document.getElementById('gallery-prev');
  const nextBtn    = document.getElementById('gallery-next');
  const dotsWrap   = document.getElementById('gallery-dots');
  const refreshBtn = document.getElementById('gallery-refresh-btn');
  const countEl    = document.getElementById('gallery-photo-count');

  if (!grid) return;

  initLightbox();

  // Carousel prev/next buttons
  prevBtn?.addEventListener('click', () => navigatePage(-1, grid, emptyEl));
  nextBtn?.addEventListener('click', () => navigatePage(+1, grid, emptyEl));

  // Dot navigation
  dotsWrap?.addEventListener('click', (e) => {
    const dot = e.target.closest('.gallery-dot');
    if (!dot) return;
    const target = parseInt(dot.dataset.page, 10);
    if (target === carouselState.page) return;
    const dir = target > carouselState.page ? 1 : -1;
    grid.classList.add(dir > 0 ? 'exit-left' : 'exit-right');
    setTimeout(() => {
      carouselState.page = target;
      grid.classList.remove('exit-left', 'exit-right');
      renderPage(grid, emptyEl);
      updateCarouselControls();
    }, 220);
  });

  // Touch swipe on the grid itself
  let swipeStartX = 0;
  grid.addEventListener('touchstart', e => { swipeStartX = e.changedTouches[0].clientX; }, { passive: true });
  grid.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - swipeStartX;
    if (Math.abs(dx) > 60) navigatePage(dx < 0 ? +1 : -1, grid, emptyEl);
  });

  // Re-render on resize (page size may change between mobile/desktop)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      carouselState.page = 0;
      renderPage(grid, emptyEl);
      updateCarouselControls();
    }, 250);
  });

  let currentFilter = 'all';
  let allPhotos     = [];

  if (!GALLERY_SCRIPT_URL) {
    // Demo mode
    noticeEl?.classList.remove('hidden');
    initUploadModal();
    const rerender = setupDemoMode(grid, emptyEl, skeletonEl);
    initFilters((filter) => { currentFilter = filter; rerender(filter); });
    return;
  }

  // Live mode
  async function refresh() {
    allPhotos = await fetchPhotos(grid, emptyEl, skeletonEl, currentFilter);
  }

  initFilters((filter) => {
    currentFilter = filter;
    renderPhotos(allPhotos, grid, emptyEl, currentFilter);
  });

  refreshBtn?.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    refresh().finally(() => setTimeout(() => refreshBtn.classList.remove('spinning'), 600));
  });

  initUploadModal();
  initUploadForm(refresh);

  refresh();
}
