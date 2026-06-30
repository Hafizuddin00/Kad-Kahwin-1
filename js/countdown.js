/**
 * countdown.js — Live countdown timer to the wedding date
 */

// ── Wedding date — update this! ───────────────────────────────────────────────
const WEDDING_DATE = new Date('2027-01-24T10:00:00');

export function initCountdown() {
  const elDays    = document.getElementById('cd-days');
  const elHours   = document.getElementById('cd-hours');
  const elMinutes = document.getElementById('cd-minutes');
  const elSeconds = document.getElementById('cd-seconds');
  const timerEl   = document.getElementById('countdown-timer');
  const marriedEl = document.getElementById('countdown-married');

  if (!elDays || !elHours || !elMinutes || !elSeconds) return;

  // Pad single digits
  const pad = n => String(n).padStart(2, '0');

  // Flip animation helper
  function setWithFlip(el, value) {
    if (el.textContent === value) return; // no change
    el.classList.add('flipping');
    setTimeout(() => {
      el.textContent = value;
      el.classList.remove('flipping');
    }, 200);
  }

  function tick() {
    const now  = Date.now();
    const diff = WEDDING_DATE.getTime() - now;

    if (diff <= 0) {
      // Already married!
      if (timerEl)   timerEl.style.display   = 'none';
      if (marriedEl) marriedEl.classList.remove('hidden');
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days    = Math.floor(totalSeconds / 86400);
    const hours   = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600)  / 60);
    const seconds = totalSeconds % 60;

    setWithFlip(elDays,    pad(days));
    setWithFlip(elHours,   pad(hours));
    setWithFlip(elMinutes, pad(minutes));
    setWithFlip(elSeconds, pad(seconds));
  }

  // Run immediately, then every second
  tick();
  setInterval(tick, 1000);
}
