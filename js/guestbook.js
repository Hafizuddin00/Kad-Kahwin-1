/**
 * guestbook.js — Live guestbook powered by Google Apps Script / Google Sheets
 *
 * Uses a SHARED workbook with RSVP and Gallery.
 * Configure the URL once in js/config.js.
 */

import { SCRIPT_URL } from './config.js';
const GOOGLE_SCRIPT_URL = SCRIPT_URL;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
      hour:  '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function getInitial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// ─── Render ──────────────────────────────────────────────────────────────────
function renderMessages(messages, grid, countEl, emptyEl) {
  grid.innerHTML = '';

  const validMessages = messages.filter(m => m.name && m.message);

  if (countEl) countEl.textContent = validMessages.length;

  if (!validMessages.length) {
    emptyEl?.classList.remove('hidden');
    return;
  }
  emptyEl?.classList.add('hidden');

  validMessages.forEach((msg, i) => {
    const card = document.createElement('article');
    card.className = 'gb-card';
    card.setAttribute('aria-label', `Wish from ${escapeHtml(msg.name)}`);
    card.style.animationDelay = `${i * 60}ms`;

    card.innerHTML = `
      <div class="gb-card-header">
        <div class="gb-card-avatar" aria-hidden="true">${escapeHtml(getInitial(msg.name))}</div>
        <div>
          <div class="gb-card-name">${escapeHtml(msg.name)}</div>
          ${msg.time ? `<div class="gb-card-time">${escapeHtml(formatTime(msg.time))}</div>` : ''}
        </div>
      </div>
      <p class="gb-card-message">${escapeHtml(msg.message)}</p>
    `;

    grid.appendChild(card);
  });
}

// ─── Fetch messages ───────────────────────────────────────────────────────────
async function fetchMessages(grid, countEl, emptyEl, skeletonEl) {
  if (!GOOGLE_SCRIPT_URL) return [];

  skeletonEl?.classList.remove('hidden');
  grid.innerHTML = '';

  try {
    // Cache-bust with timestamp to avoid stale responses
    const url  = `${GOOGLE_SCRIPT_URL}?action=guestbook&t=${Date.now()}`;
    const res  = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    skeletonEl?.classList.add('hidden');
    renderMessages(Array.isArray(data) ? data : [], grid, countEl, emptyEl);
    return data;
  } catch (err) {
    console.error('[Guestbook] Fetch error:', err);
    skeletonEl?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');
    return [];
  }
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function submitMessage({ name, message }, alertEl, btnEl, btnText, btnLoading) {
  btnEl.disabled = true;
  btnText.classList.add('hidden');
  btnLoading.classList.remove('hidden');

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify({ action: 'guestbook', name, message }),
    });
    // no-cors returns opaque response — can't read res.ok, assume success if no throw

    showAlert(alertEl, 'Your wish has been sent! 💌', 'success');
    return true;
  } catch (err) {
    console.error('[Guestbook] Submit error:', err);
    showAlert(alertEl, 'Could not send your wish. Please try again.', 'error');
    return false;
  } finally {
    btnEl.disabled = false;
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
  }
}

function showAlert(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className   = `gb-alert ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// ─── Main init ────────────────────────────────────────────────────────────────
export function initGuestbook() {
  const form       = document.getElementById('guestbook-form');
  const grid       = document.getElementById('guestbook-grid');
  const countEl    = document.getElementById('gb-message-count');
  const emptyEl    = document.getElementById('gb-empty');
  const skeletonEl = document.getElementById('gb-skeleton');
  const alertEl    = document.getElementById('gb-alert');
  const refreshBtn = document.getElementById('gb-refresh-btn');
  const noticeEl   = document.getElementById('gb-config-notice');

  if (!form || !grid) return;

  // Show setup notice if URL not configured
  if (!GOOGLE_SCRIPT_URL) {
    noticeEl?.classList.remove('hidden');
    skeletonEl?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');

    // Add demo messages so the UI isn't empty
    const demoMessages = [
      { name: 'Emily Johnson',  message: 'Wishing you both a lifetime of happiness and love! Congratulations! 🎉', time: new Date(Date.now() - 60000 * 30).toISOString() },
      { name: 'Michael Chen',   message: 'May your love story be forever beautiful. So happy for you both! ❤️',   time: new Date(Date.now() - 60000 * 90).toISOString() },
      { name: 'Sophia Patel',   message: 'Two hearts, one beautiful journey. Sending all our love on your special day!', time: new Date(Date.now() - 60000 * 180).toISOString() },
      { name: 'David Williams', message: 'The best is yet to come! Congratulations Sarah & James 🥂',               time: new Date(Date.now() - 60000 * 300).toISOString() },
      { name: 'Olivia Martinez',message: 'Wishing you both endless love, laughter and happily ever after! 💍',      time: new Date(Date.now() - 60000 * 420).toISOString() },
      { name: 'Lucas Thompson', message: 'A perfect match! May your days be filled with joy and your home with love.', time: new Date(Date.now() - 60000 * 600).toISOString() },
    ];
    renderMessages(demoMessages, grid, countEl, emptyEl);
    setupLocalMode(form, grid, countEl, emptyEl, alertEl);
    return;
  }

  // ── Real Google Sheets mode ──
  const nameInput  = document.getElementById('gb-name');
  const msgInput   = document.getElementById('gb-message');
  const nameErr    = document.getElementById('gb-name-err');
  const msgErr     = document.getElementById('gb-msg-err');
  const charCount  = document.getElementById('gb-char-count');
  const submitBtn  = document.getElementById('gb-submit-btn');
  const btnText    = submitBtn?.querySelector('.gb-btn-text');
  const btnLoading = submitBtn?.querySelector('.gb-btn-loading');

  // Char counter
  msgInput?.addEventListener('input', () => {
    const len = msgInput.value.length;
    charCount.textContent = `${len} / 400`;
    charCount.style.color = len > 380 ? '#e57373' : '#bbb';
  });

  // Initial fetch
  fetchMessages(grid, countEl, emptyEl, skeletonEl);

  // Manual refresh only
  refreshBtn?.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    fetchMessages(grid, countEl, emptyEl, null)
      .finally(() => setTimeout(() => refreshBtn.classList.remove('spinning'), 600));
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear errors
    if (nameErr) nameErr.textContent = '';
    if (msgErr)  msgErr.textContent  = '';
    nameInput?.classList.remove('invalid');
    msgInput?.classList.remove('invalid');

    const name    = nameInput?.value.trim() || '';
    const message = msgInput?.value.trim()  || '';
    let valid     = true;

    if (name.length < 2) {
      if (nameErr) nameErr.textContent = 'Please enter your name.';
      nameInput?.classList.add('invalid');
      valid = false;
    }
    if (message.length < 5) {
      if (msgErr) msgErr.textContent = 'Please write at least a few words.';
      msgInput?.classList.add('invalid');
      valid = false;
    }
    if (!valid) return;

    const ok = await submitMessage({ name, message }, alertEl, submitBtn, btnText, btnLoading);
    if (ok) {
      form.reset();
      if (charCount) charCount.textContent = '0 / 400';
      // Refresh the list
      await fetchMessages(grid, countEl, emptyEl, null);
    }
  });
}

// ─── Local / Demo mode (no backend) ──────────────────────────────────────────
function setupLocalMode(form, grid, countEl, emptyEl, alertEl) {
  const nameInput  = document.getElementById('gb-name');
  const msgInput   = document.getElementById('gb-message');
  const nameErr    = document.getElementById('gb-name-err');
  const msgErr     = document.getElementById('gb-msg-err');
  const charCount  = document.getElementById('gb-char-count');
  const submitBtn  = document.getElementById('gb-submit-btn');
  const btnText    = submitBtn?.querySelector('.gb-btn-text');
  const btnLoading = submitBtn?.querySelector('.gb-btn-loading');
  const refreshBtn = document.getElementById('gb-refresh-btn');

  // In-memory store (survives page stay, resets on reload)
  let localMessages = JSON.parse(sessionStorage.getItem('gb_messages') || '[]');

  function persist() {
    sessionStorage.setItem('gb_messages', JSON.stringify(localMessages));
  }

  function rerender() {
    renderMessages(localMessages, grid, countEl, emptyEl);
  }

  // Char counter
  msgInput?.addEventListener('input', () => {
    const len = msgInput.value.length;
    if (charCount) {
      charCount.textContent = `${len} / 400`;
      charCount.style.color = len > 380 ? '#e57373' : '#bbb';
    }
  });

  refreshBtn?.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    rerender();
    setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (nameErr) nameErr.textContent = '';
    if (msgErr)  msgErr.textContent  = '';
    nameInput?.classList.remove('invalid');
    msgInput?.classList.remove('invalid');

    const name    = nameInput?.value.trim() || '';
    const message = msgInput?.value.trim()  || '';
    let valid     = true;

    if (name.length < 2) {
      if (nameErr) nameErr.textContent = 'Please enter your name.';
      nameInput?.classList.add('invalid');
      valid = false;
    }
    if (message.length < 5) {
      if (msgErr) msgErr.textContent = 'Please write at least a few words.';
      msgInput?.classList.add('invalid');
      valid = false;
    }
    if (!valid) return;

    // Simulate network delay
    if (btnText)    btnText.classList.add('hidden');
    if (btnLoading) btnLoading.classList.remove('hidden');
    if (submitBtn)  submitBtn.disabled = true;

    setTimeout(() => {
      const newMsg = { time: new Date().toISOString(), name, message };
      localMessages.unshift(newMsg);
      persist();

      form.reset();
      if (charCount) charCount.textContent = '0 / 400';
      rerender();
      showAlert(alertEl, 'Your wish has been saved! 💌 (Demo mode — configure Google Sheets for persistence)', 'success');

      if (btnText)    btnText.classList.remove('hidden');
      if (btnLoading) btnLoading.classList.add('hidden');
      if (submitBtn)  submitBtn.disabled = false;
    }, 900);
  });
}
