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

  // ── Parallax (subtle) on hero ─────────────────────────────────────────────
  const hero = document.getElementById('hero');
  if (hero && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrolled = window.scrollY;
          // Move background slower than foreground for parallax
          hero.style.backgroundPositionY = `calc(50% + ${scrolled * 0.25}px)`;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
}
