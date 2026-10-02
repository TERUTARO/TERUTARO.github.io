/* The same reviewed catalogs render static pages and live CMS content. */
(() => {
  'use strict';
  const root = document.querySelector('[data-portfolio-page]');
  if (!root) return;
  const locale = root.dataset.locale || 'ja';
  const languages = {ja: 'ja', en: 'en', zh: 'zh-CN'};
  const entries = window.portfolioCatalog || {};
  const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const templates = Object.entries(entries).filter(([key]) => /\{\w+\}/.test(key)).map(([key, value]) => ({
    pattern: new RegExp('^' + key.split(/\{\w+\}/).map(escapeRegExp).join('(.*?)') + '$', 's'),
    names: [...key.matchAll(/\{(\w+)\}/g)].map(match => match[1]), value,
  }));
  function t(value, depth = 0) {
    value = String(value ?? '');
    if (locale === 'ja' || !value.trim() || depth > 4) return value;
    const core = value.trim();
    let translated = Object.hasOwn(entries, core) ? entries[core] : undefined;
    if (translated === undefined && core.startsWith('"') && core.endsWith('"')) translated = '"' + t(core.slice(1, -1), depth + 1) + '"';
    if (translated === undefined) {
      for (const {pattern, names, value: target} of templates) {
        const match = core.match(pattern);
        if (!match) continue;
        translated = target;
        names.forEach((name, index) => { translated = translated.replaceAll('{' + name + '}', t(match[index + 1], depth + 1)); });
        break;
      }
    }
    return translated === undefined ? value : value.match(/^\s*/)[0] + translated + value.match(/\s*$/)[0];
  }
  function localURL(value) {
    if (value.startsWith('assets/')) return '/' + value;
    const match = value.match(/^\/?(index|works|partners|events|columns|contact|pricing)\.html([?#].*)?$/);
    return match ? '/' + (locale === 'ja' ? '' : locale + '/') + match[1] + '.html' + (match[2] || '') : value;
  }
  const ignored = 'script,style,[data-no-translate]';
  const attributes = ['aria-label', 'alt', 'title', 'placeholder'];
  function translate(node) {
    if (!node || !root.contains(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.parentElement?.closest(ignored + ',textarea')) {
        const value = t(node.nodeValue);
        if (value !== node.nodeValue) node.nodeValue = value;
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest(ignored)) return;
    for (const name of attributes) {
      if (!node.hasAttribute(name)) continue;
      const before = node.getAttribute(name), after = t(before);
      if (before !== after) node.setAttribute(name, after);
    }
    if (!node.hasAttribute('data-locale-link')) {
      for (const name of ['href', 'src', 'srcset']) {
        if (!node.hasAttribute(name)) continue;
        const before = node.getAttribute(name), after = localURL(before);
        if (before !== after) node.setAttribute(name, after);
      }
    }
    for (const child of node.childNodes) translate(child);
  }
  window.portfolioI18n = {locale, t, translate, localURL};
  document.documentElement.lang = languages[locale];
  document.documentElement.dataset.locale = locale;
  translate(root);
  // New CMS rows, filter counts and form status messages use the same catalog.
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(translate);
      else translate(record.target);
    }
  }).observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes});
  window.addEventListener('portfolio:content-updated', () => translate(root));

  function updateLanguageLinks() {
    root.querySelectorAll('[data-locale-link]').forEach(link => {
      const url = new URL(link.href, location.href);
      url.search = location.search;
      url.hash = location.hash;
      link.href = url.href;
    });
  }
  updateLanguageLinks();
  window.addEventListener('hashchange', updateLanguageLinks);
  root.querySelectorAll('[data-locale-link]').forEach(link => {
    link.addEventListener('click', () => {
      try { localStorage.setItem('portfolio-language', link.dataset.localeLink); } catch { /* Storage may be disabled. */ }
    });
  });
  try {
    const preferred = localStorage.getItem('portfolio-language');
    if (locale === 'ja' && ['/', '/index.html'].includes(location.pathname) && ['en', 'zh'].includes(preferred)) {
      location.replace('/' + preferred + '/index.html' + location.search + location.hash);
    }
  } catch { /* Explicit language URLs remain usable without storage. */ }
})();
