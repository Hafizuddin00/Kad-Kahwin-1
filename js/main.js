/**
 * main.js — Entry point
 * Loads all components, injects CSS, and initialises all modules.
 *
 * ─── SHARED GOOGLE SHEETS SETUP ──────────────────────────────────────────────
 *
 * All three features (RSVP, Guestbook, Gallery) share ONE Google Sheets
 * workbook and ONE Apps Script Web App deployment.
 * Gallery photos are saved to Google Drive; only the Drive link is stored in Sheets.
 *
 * Step 1 — Create the workbook
 *   Open Google Sheets and create a new spreadsheet.
 *   Add three sheets (tabs) named exactly:
 *     • RSVP
 *     • Guestbook
 *     • Gallery
 *
 *   Column headers (row 1) for each tab:
 *
 *   RSVP:      Timestamp | Name | Phone | Attendance | Guests | Dietary | Message
 *   Guestbook: Timestamp | Name | Message
 *   Gallery:   Timestamp | Category | ImageUrl
 *
 * Step 2 — Add the Apps Script
 *   Extensions → Apps Script → replace ALL existing code with the script below.
 *   No folder ID needed — the script creates a "Wedding Gallery" folder in your
 *   Drive automatically on the first photo upload.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  function getSheet(name) {
 *    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
 *  }
 *
 *  function doPost(e) {
 *    var data = JSON.parse(e.postData.contents);
 *    var ts   = new Date().toISOString();
 *
 *    if (data.action === 'rsvp') {
 *      getSheet('RSVP').appendRow([
 *        ts, data.name, data.phone, data.attendance,
 *        data.guests, data.dietary, data.message
 *      ]);
 *
 *    } else if (data.action === 'guestbook') {
 *      getSheet('Guestbook').appendRow([ts, data.name, data.message]);
 *
 *    } else if (data.action === 'gallery') {
 *      getSheet('Gallery').appendRow([
 *        ts, data.category, data.imageUrl
 *      ]);
 *
 *    } else {
 *      return ContentService
 *        .createTextOutput(JSON.stringify({ status: 'error', msg: 'Unknown action' }))
 *        .setMimeType(ContentService.MimeType.JSON);
 *    }
 *
 *    return ContentService
 *      .createTextOutput(JSON.stringify({ status: 'ok' }))
 *      .setMimeType(ContentService.MimeType.JSON);
 *  }
 *
 *  function doGet(e) {
 *    var action = e.parameter.action;
 *
 *    if (action === 'guestbook') {
 *      var rows = getSheet('Guestbook').getDataRange().getValues();
 *      var messages = rows.slice(1).map(function(row) {
 *        return { time: row[0], name: row[1], message: row[2] };
 *      }).reverse();
 *      return ContentService
 *        .createTextOutput(JSON.stringify(messages))
 *        .setMimeType(ContentService.MimeType.JSON);
 *    }
 *
 *    if (action === 'gallery') {
 *      var rows = getSheet('Gallery').getDataRange().getValues();
 *      var photos = rows.slice(1).map(function(row) {
 *        return {
 *          time: row[0], category: row[1], imageUrl: row[2]
 *        };
 *      }).reverse();
 *      return ContentService
 *        .createTextOutput(JSON.stringify(photos))
 *        .setMimeType(ContentService.MimeType.JSON);
 *    }
 *
 *    return ContentService
 *      .createTextOutput(JSON.stringify({ status: 'error', msg: 'Unknown action' }))
 *      .setMimeType(ContentService.MimeType.JSON);
 *  }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Step 3 — Deploy
 *   Deploy → New deployment → Type: Web App
 *   Execute as: Me | Who has access: Anyone
 *   Copy the Web App URL.
 *   (If updating an existing deployment: Deploy → Manage deployments →
 *    Edit → New version → Deploy)
 *
 * Step 4 — Set the URL
 *   Paste the URL into js/config.js — one value powers all three features.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initCountdown }  from './countdown.js';
import { initGallery }    from './gallery.js';
import { initGuestbook }  from './guestbook.js';
import { initScroll }     from './scroll.js';
import { SCRIPT_URL }     from './config.js';

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

// ─── RSVP form ───────────────────────────────────────────────────────────────
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const nameVal     = document.getElementById('rsvp-name')?.value.trim() || '';
    const phoneVal    = document.getElementById('rsvp-phone')?.value.trim() || '';
    const attVal      = document.querySelector('input[name="attendance"]:checked')?.value || '';
    const guestsVal   = document.getElementById('rsvp-guests')?.value || '';
    const dietaryVal  = document.getElementById('rsvp-dietary')?.value.trim() || '';
    const messageVal  = msgArea?.value.trim() || '';

    let valid = true;

    if (nameVal.length < 2) {
      showError('rsvp-name-err', 'Sila masukkan nama penuh anda.');
      document.getElementById('rsvp-name')?.classList.add('invalid');
      valid = false;
    }
    if (!attVal) {
      showError('rsvp-att-err', 'Sila pilih kehadiran anda.');
      valid = false;
    }
    if (!valid) return;

    // Loading state
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text')?.classList.add('hidden');
    submitBtn.querySelector('.btn-loading')?.classList.remove('hidden');

    const payload = {
      action:     'rsvp',
      name:       nameVal,
      phone:      phoneVal,
      attendance: attVal,
      guests:     attVal === 'yes' ? guestsVal : '',
      dietary:    attVal === 'yes' ? dietaryVal : '',
      message:    attVal === 'yes' ? messageVal : '',
    };

    // Submit to Google Sheets if configured, otherwise local demo
    if (SCRIPT_URL) {
      try {
        await fetch(SCRIPT_URL, {
          method:  'POST',
          mode:    'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body:    JSON.stringify(payload),
        });
        // no-cors returns opaque response — assume success if no throw
      } catch (err) {
        console.error('[RSVP] Submit error:', err);
        // Still show success to user — don't leave them hanging on a network blip
      }
    }

    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text')?.classList.remove('hidden');
    submitBtn.querySelector('.btn-loading')?.classList.add('hidden');

    form.classList.add('hidden');
    successBox.classList.remove('hidden');

    const message = attVal === 'yes'
      ? `Kami telah menerima RSVP anda dan tidak sabar untuk meraikan bersama anda, ${nameVal}!`
      : `Kami kesal anda tidak dapat hadir, ${nameVal}. Anda tetap dalam hati kami!`;
    if (successMsg) successMsg.textContent = message;
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
