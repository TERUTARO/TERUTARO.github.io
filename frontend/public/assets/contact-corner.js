'use strict';

(() => {
  const t = source => window.portfolioI18n?.t(source) ?? source;
  const corner = document.querySelector('.contact-corner');
  if (!corner) return;

  const surface = corner.querySelector('.contact-corner-surface');
  const toggle = corner.querySelector('.contact-corner-toggle');
  const panel = corner.querySelector('.contact-corner-panel');
  let restoringFocus = false;

  const setOpen = (open) => {
    corner.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', t(open ? 'お問い合わせを閉じる' : 'お問い合わせを開く'));
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
  };

  corner.querySelector('.contact-corner-fallback').hidden = true;
  toggle.hidden = false;
  surface.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') setOpen(true);
  });
  surface.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !corner.contains(document.activeElement)) setOpen(false);
  });
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  toggle.addEventListener('focus', () => {
    if (!restoringFocus && toggle.matches(':focus-visible')) setOpen(true);
  });
  corner.addEventListener('focusout', (event) => {
    if (!corner.contains(event.relatedTarget)) setOpen(false);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!corner.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;
    const restoreFocus = corner.contains(document.activeElement);
    setOpen(false);
    if (restoreFocus) {
      restoringFocus = true;
      toggle.focus({ preventScroll: true });
      restoringFocus = false;
    }
  });
  window.addEventListener('pagehide', () => setOpen(false));
  window.addEventListener('pageshow', () => setOpen(false));
})();
