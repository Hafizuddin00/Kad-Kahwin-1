/**
 * guestbook.js — Live guestbook powered by Google Apps Script / Google Sheets
 *
 * Uses a SHARED workbook with RSVP and Gallery.
 * Configure the URL once in js/config.js.
 */

import { SCRIPT_URL } from './config.js';
const GOOGLE_SCRIPT_URL = SCRIPT_URL;

// ─── Generate a short random ID for new messages ─────────────────────────────
function generateMsgId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Device ID — generated once, persisted in localStorage ───────────────────
function getDeviceId() {
  let id = localStorage.getItem('wedding_device_id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem('wedding_device_id', id);
  }
  return id;
}

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

// ─── Per-speech occupancy map ─────────────────────────────────────────────────
// Tracks in-flight requests per speech. Each speech is independent.
const _speechOccupied = new Map();

function isSpeechOccupied(msgId)   { return _speechOccupied.get(msgId) === true; }
function markSpeechOccupied(msgId) { _speechOccupied.set(msgId, true); }
function clearSpeechOccupied(msgId){ _speechOccupied.delete(msgId); }

// ─── Like handler factory — one instance per card ────────────────────────────
// UI reacts to every click instantly.
// Backend: only one request per speech at a time. While a request is in-flight,
// additional clicks update the UI immediately but are coalesced — only the final
// desired state is sent once the current request settles.
function makeLikeHandler(msgId, btn, countSpan) {
  // pendingState: the desired state to send after the in-flight request settles.
  // null = no pending click waiting.
  let pendingState = null; // { liked, count, wasLiked, prevCount }

  function applyState(liked, count) {
    btn.classList.toggle('loved', liked);
    btn.setAttribute('aria-pressed', String(liked));
    btn.setAttribute('aria-label', liked ? 'Unlike this wish' : 'Like this wish');
    btn.querySelector('.gb-love-icon').textContent = liked ? '❤️' : '🤍';
    countSpan.textContent = count > 0 ? String(count) : '';
  }

  function sendRequest(liked, count, revertLiked, revertCount) {
    markSpeechOccupied(msgId);
    const deviceId = getDeviceId();
    fetch(GOOGLE_SCRIPT_URL, {
      method:  'POST',
      mode:    'cors',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify({ action: 'like', msgId, deviceId }),
    })
      .then(r => r.text())
      .then(text => {
        const json = JSON.parse(text);
        if (json.status === 'ok') {
          // Only reconcile server count if no pending click is waiting
          if (pendingState === null) {
            countSpan.textContent = json.likes > 0 ? String(json.likes) : '';
          }
        } else {
          throw new Error(json.msg || 'Server error');
        }
      })
      .catch(err => {
        console.error('[Guestbook] Like error:', err);
        // Revert only if nothing is pending (pending will set its own state)
        if (pendingState === null) applyState(revertLiked, revertCount);
      })
      .finally(() => {
        clearSpeechOccupied(msgId);
        // If a click came in while we were in-flight, send it now
        if (pendingState !== null) {
          const next = pendingState;
          pendingState = null;
          sendRequest(next.liked, next.count, next.revertLiked, next.revertCount);
        }
      });
  }

  return function handle() {
    const wasLiked  = btn.classList.contains('loved');
    const prevCount = parseInt(countSpan.textContent || '0');
    const newLiked  = !wasLiked;
    const newCount  = newLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    // Always update UI instantly
    applyState(newLiked, newCount);

    if (isSpeechOccupied(msgId)) {
      // Request in-flight — coalesce: overwrite pending state with latest click
      pendingState = { liked: newLiked, count: newCount, revertLiked: wasLiked, revertCount: prevCount };
    } else {
      // No request in-flight — send immediately
      pendingState = null;
      sendRequest(newLiked, newCount, wasLiked, prevCount);
    }
  };
}

// ─── Build a single card element ─────────────────────────────────────────────
function buildCard(msg) {
  const liked = !!msg.likedByMe;
  const likes = msg.likes || 0;

  const card = document.createElement('article');
  card.className = 'gb-card';
  card.setAttribute('aria-label', `Wish from ${escapeHtml(msg.name)}`);

  card.innerHTML = `
    <div class="gb-card-header">
      <div class="gb-card-avatar" aria-hidden="true">${escapeHtml(getInitial(msg.name))}</div>
      <div>
        <div class="gb-card-name">${escapeHtml(msg.name)}</div>
        ${msg.time ? `<div class="gb-card-time">${escapeHtml(formatTime(msg.time))}</div>` : ''}
      </div>
    </div>
    <p class="gb-card-message">${escapeHtml(msg.message)}</p>
    <div class="gb-card-footer">
      <button class="gb-love-btn${liked ? ' loved' : ''}"
        aria-label="${liked ? 'Unlike' : 'Like'} this wish"
        aria-pressed="${liked}">
        <span class="gb-love-icon">${liked ? '❤️' : '🤍'}</span>
        <span class="gb-love-count">${likes > 0 ? likes : ''}</span>
      </button>
    </div>
  `;

  if (msg.id) {
    const btn       = card.querySelector('.gb-love-btn');
    const countSpan = card.querySelector('.gb-love-count');
    const handle    = makeLikeHandler(msg.id, btn, countSpan);
    btn.addEventListener('click', handle);
  }

  return card;
}

// ─── Prepend a single new card without re-rendering ──────────────────────────
function prependCard(msg, grid, countEl, emptyEl) {
  emptyEl?.classList.add('hidden');
  const card = buildCard(msg);
  card.classList.add('gb-card-new'); // trigger slide-in animation
  grid.prepend(card);
  // Scroll to top so user sees their new message
  grid.scrollTo({ top: 0, behavior: 'smooth' });
  // Update count
  if (countEl) countEl.textContent = String(grid.querySelectorAll('.gb-card').length);
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

  validMessages.forEach(msg => grid.appendChild(buildCard(msg)));
}

// ─── Fetch messages ───────────────────────────────────────────────────────────
async function fetchMessages(grid, countEl, emptyEl, skeletonEl) {
  if (!GOOGLE_SCRIPT_URL) return [];

  skeletonEl?.classList.remove('hidden');
  grid.innerHTML = '';

  try {
    const deviceId = getDeviceId();
    const url  = `${GOOGLE_SCRIPT_URL}?action=guestbook&deviceId=${encodeURIComponent(deviceId)}&t=${Date.now()}`;
    const res  = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = JSON.parse(text);

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
async function submitMessage({ id, name, message }, alertEl, btnEl, btnText, btnLoading) {
  btnEl.disabled = true;
  btnText.classList.add('hidden');
  btnLoading.classList.remove('hidden');

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify({ action: 'guestbook', id, name, message }),
    });
    // no-cors returns opaque response — assume success if no throw

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
      { id: 'demo1', name: 'Emily Johnson',   message: 'Wishing you both a lifetime of happiness and love! Congratulations! 🎉', time: new Date(Date.now() - 60000 * 30).toISOString(),  likes: 5,  likedByMe: false },
      { id: 'demo2', name: 'Michael Chen',    message: 'May your love story be forever beautiful. So happy for you both! ❤️',   time: new Date(Date.now() - 60000 * 90).toISOString(),  likes: 3,  likedByMe: false },
      { id: 'demo3', name: 'Sophia Patel',    message: 'Two hearts, one beautiful journey. Sending all our love on your special day!', time: new Date(Date.now() - 60000 * 180).toISOString(), likes: 8, likedByMe: true  },
      { id: 'demo4', name: 'David Williams',  message: 'The best is yet to come! Congratulations Dinie & Fatihqa 🥂',           time: new Date(Date.now() - 60000 * 300).toISOString(), likes: 2,  likedByMe: false },
      { id: 'demo5', name: 'Olivia Martinez', message: 'Wishing you both endless love, laughter and happily ever after! 💍',    time: new Date(Date.now() - 60000 * 420).toISOString(), likes: 6,  likedByMe: false },
      { id: 'demo6', name: 'Lucas Thompson',  message: 'A perfect match! May your days be filled with joy and your home with love.', time: new Date(Date.now() - 60000 * 600).toISOString(), likes: 1, likedByMe: false },
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

    const msgId = generateMsgId();
    const ok = await submitMessage({ id: msgId, name, message }, alertEl, submitBtn, btnText, btnLoading);
    if (ok) {
      form.reset();
      if (charCount) charCount.textContent = '0 / 400';
      prependCard(
        { id: msgId, name, message, time: new Date().toISOString(), likes: 0, likedByMe: false },
        grid, countEl, emptyEl
      );
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
      const newMsg = { id: generateMsgId(), time: new Date().toISOString(), name, message, likes: 0, likedByMe: false };
      localMessages.unshift(newMsg);
      persist();

      form.reset();
      if (charCount) charCount.textContent = '0 / 400';
      // Prepend only the new card — no full re-render
      prependCard(newMsg, grid, countEl, emptyEl);
      showAlert(alertEl, 'Your wish has been saved! 💌 (Demo mode — configure Google Sheets for persistence)', 'success');

      if (btnText)    btnText.classList.remove('hidden');
      if (btnLoading) btnLoading.classList.add('hidden');
      if (submitBtn)  submitBtn.disabled = false;
    }, 900);
  });
}
