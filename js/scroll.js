/**
 * scroll.js — Scroll-reveal animations using IntersectionObserver
 */

export function initScroll() {
  // Reveal elements
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target); // fire once
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // Re-observe any dynamically added .reveal elements (e.g., guestbook cards)
  const mutationObs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.classList?.contains('reveal')) revealObserver.observe(node);
        node.querySelectorAll?.('.reveal').forEach(el => revealObserver.observe(el));
      });
    });
  });

  const app = document.getElementById('app');
  if (app) mutationObs.observe(app, { childList: true, subtree: true });

  // ── Sticky header shadow effect (if a nav is ever added) ──────────────────
  // Smooth scroll polyfill for older browsers already handled by CSS scroll-behavior: smooth;

  // ── Parallax on hero: use CSS background-attachment: fixed (same as countdown).
  // JS parallax removed — CSS fixed attachment handles it natively and works
  // consistently across devices without causing repaints on scroll.
}
