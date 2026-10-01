(() => {
  'use strict';

  const header = document.querySelector('.site-header');
  if (!header) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scrollFrame = 0;
  let navigationTimer = 0;

  const updateHeader = () => {
    scrollFrame = 0;
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeader);
  }, { passive: true });
  updateHeader();

  const indicators = [...document.querySelectorAll('.rail-nav, .menu-links')].map((nav) => {
    const selected = nav.querySelector('a[aria-current]');
    if (!selected) return null;
    const indicator = document.createElement('span');
    indicator.className = 'navigation-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.hidden = true;
    nav.append(indicator);
    let active = selected;

    const position = (link = active, animate = false) => {
      active = link;
      if (!nav.offsetWidth || !link.offsetHeight) {
        indicator.hidden = true;
        return;
      }
      indicator.classList.toggle('is-positioning', !animate);
      indicator.style.width = `${link.offsetWidth}px`;
      indicator.style.height = `${link.offsetHeight}px`;
      indicator.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
      indicator.hidden = false;
      nav.classList.add('has-navigation-indicator');
      // Commit initial/resize placement so only deliberate selection moves animate.
      if (!animate) {
        indicator.getBoundingClientRect();
        indicator.classList.remove('is-positioning');
      }
    };

    nav.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link || link.parentElement !== nav || event.defaultPrevented ||
          event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || destination.href === location.href) return;
      position(link, true);
      if (reducedMotion.matches) return;
      // Normal document links retain their semantics; allow the fine outline to
      // reach the selected row before the destination document takes over.
      event.preventDefault();
      clearTimeout(navigationTimer);
      navigationTimer = window.setTimeout(() => location.assign(destination.href), 320);
    });

    const resizeObserver = new ResizeObserver(() => position());
    resizeObserver.observe(nav);
    [...nav.querySelectorAll(':scope > a')].forEach((link) => resizeObserver.observe(link));
    position();
    return { position, reset: () => position(selected) };
  }).filter(Boolean);

  const menu = document.querySelector('#site-menu');
  if (menu) {
    new MutationObserver(() => {
      if (menu.open) indicators.forEach(({ position }) => position());
    }).observe(menu, { attributes: true, attributeFilter: ['open'] });
  }
  window.addEventListener('pageshow', () => {
    clearTimeout(navigationTimer);
    updateHeader();
    indicators.forEach(({ reset }) => reset());
  });
  window.addEventListener('pagehide', () => clearTimeout(navigationTimer));
})();
