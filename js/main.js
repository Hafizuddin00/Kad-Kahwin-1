/**
 * main.js — Entry point
 * Loads all components, injects CSS, and initialises all modules.
 */

import { initCountdown }  from './countdown.js';
import { initGallery }    from './gallery.js';
import { initGuestbook }  from './guestbook.js';
import { initScroll }     from './scroll.js';

// ─── Component manifest ──────────────────────────────────────────────────────
const COMPONENTS = [
  { name: 'hero',       css: 'hero.css'      },
  { name: 'event',      css: 'event.css'     },
  { name: 'countdown',  css: 'countdown.css' },
  { name: 'gallery',    css: 'gallery.css'   },
  { name: 'location',   css: 'location.css'  },
  { name: 'rsvp',       css: 'rsvp.css'      },
  { name: 'guestbook',  css: 'guestbook.css' },
  { name: 'footer',     css: 'footer.css'    },
];

// ─── CSS loader ──────────────────────────────────────────────────────────────
function loadCSS(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

// ─── Component loader ────────────────────────────────────────────────────────
async function loadComponent(name) {
  const res = await fetch(`components/${name}.html`);
  if (!res.ok) throw new Error(`Failed to load component: ${name} (${res.status})`);
  return res.text();
}

// ─── Sequential component insertion ─────────────────────────────────────────
async function loadAllComponents(app) {
  for (const comp of COMPONENTS) {
    try {
      loadCSS(`css/${comp.css}`);
      const html = await loadComponent(comp.name);
      app.insertAdjacentHTML('beforeend', html);
    } catch (err) {
      console.error(err);
    }
  }
}

// ─── RSVP form (standalone — no external dep needed) ─────────────────────────
function initRSVP() {
  const form       = document.getElementById('rsvp-form');
  const submitBtn  = document.getElementById('rsvp-submit-btn');
  const successBox = document.getElementById('rsvp-success');
  const successMsg = document.getElementById('rsvp-success-msg');
  const resetBtn   = document.getElementById('rsvp-reset-btn');
  const msgArea    = document.getElementById('rsvp-message');
  const charCount  = document.getElementById('rsvp-msg-count');

  if (!form) return;

  // Char counter
  msgArea?.addEventListener('input', () => {
    const len = msgArea.value.length;
    charCount.textContent = `${len} / 500`;
    charCount.style.color = len > 480 ? '#e57373' : 'rgba(255,255,255,0.4)';
  });

  // Hide guest count when declining
  document.querySelectorAll('input[name="attendance"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const gc = document.getElementById('guest-count-group');
      const dg = document.getElementById('dietary-group');
      const mg = document.getElementById('message-group');
      const isNo = radio.value === 'no';
      if (gc) gc.style.display = isNo ? 'none' : '';
      if (dg) dg.style.display = isNo ? 'none' : '';
      if (mg) mg.style.display = isNo ? 'none' : '';
    });
  });

  // Validate helper
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }
  function clearErrors() {
    document.querySelectorAll('.form-error').forEach(el => (el.textContent = ''));
    document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();

    let valid = true;
    const nameVal = document.getElementById('rsvp-name')?.value.trim();
    const attVal  = document.querySelector('input[name="attendance"]:checked')?.value;

    if (!nameVal || nameVal.length < 2) {
      showError('rsvp-name-err', 'Please enter your full name.');
      document.getElementById('rsvp-name')?.classList.add('invalid');
      valid = false;
    }
    if (!attVal) {
      showError('rsvp-att-err', 'Please select your attendance.');
      valid = false;
    }

    if (!valid) return;

    // Simulate submit
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text')?.classList.add('hidden');
    submitBtn.querySelector('.btn-loading')?.classList.remove('hidden');

    setTimeout(() => {
      form.classList.add('hidden');
      successBox.classList.remove('hidden');

      const message = attVal === 'yes'
        ? `We've received your RSVP and can't wait to celebrate with you, ${nameVal}!`
        : `We're sorry you can't make it, ${nameVal}. You'll be in our hearts!`;
      if (successMsg) successMsg.textContent = message;
    }, 1200);
  });

  resetBtn?.addEventListener('click', () => {
    form.classList.remove('hidden');
    successBox.classList.add('hidden');
    form.reset();
    clearErrors();
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text')?.classList.remove('hidden');
    submitBtn.querySelector('.btn-loading')?.classList.add('hidden');
    if (charCount) charCount.textContent = '0 / 500';
    // Restore hidden groups on reset
    ['guest-count-group', 'dietary-group', 'message-group'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
  });
}

// ─── Back to top ─────────────────────────────────────────────────────────────
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ─── Footer year ─────────────────────────────────────────────────────────────
function initFooterYear() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

// ─── Nav highlight on scroll ─────────────────────────────────────────────────
function initActiveNav() {
  const sections = ['hero','event','countdown','gallery','location','rsvp','guestbook'];
  const links    = document.querySelectorAll('.footer-nav a');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(l => {
          l.style.color = l.getAttribute('href') === `#${id}`
            ? 'var(--gold-light)'
            : '';
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

// ─── Loading screen ──────────────────────────────────────────────────────────
function hideLoadingScreen() {
  const ls = document.getElementById('loading-screen');
  if (!ls) return;
  ls.classList.add('hidden');
  // Remove from DOM after transition
  ls.addEventListener('transitionend', () => ls.remove(), { once: true });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
(async function bootstrap() {
  const app = document.getElementById('app');
  if (!app) return;

  await loadAllComponents(app);

  // Small tick to allow DOM paint before initialising
  requestAnimationFrame(() => {
    initScroll();
    initCountdown();
    initGallery();
    initGuestbook();
    initRSVP();
    initBackToTop();
    initFooterYear();
    initActiveNav();
    hideLoadingScreen();
  });
})();
