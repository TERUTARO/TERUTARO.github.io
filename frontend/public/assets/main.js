'use strict';

// Native links and semantic HTML work without a framework or a build server.
const menuButton = document.querySelector('.menu-trigger');
const menuPanel = document.querySelector('#site-menu');
const menuMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let menuFrame = 0;
let menuCloseTimer = 0;
let menuOpenTimer = 0;
let menuRestoreFocus = true;
menuButton.hidden = false;
menuPanel.dataset.menuState = 'closed';

function cancelMenuTimers() {
  cancelAnimationFrame(menuFrame);
  clearTimeout(menuCloseTimer);
  clearTimeout(menuOpenTimer);
  menuFrame = menuCloseTimer = menuOpenTimer = 0;
}

function resetMenu() {
  cancelMenuTimers();
  menuPanel.classList.remove('is-visible', 'is-closing');
  menuPanel.dataset.menuState = 'closed';
  menuButton.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

function finishMenuClose() {
  if (menuPanel.open) menuPanel.close();
  resetMenu();
}

function openMenu() {
  if (menuPanel.open && menuPanel.dataset.menuState !== 'closing') return;
  cancelMenuTimers();
  menuRestoreFocus = true;
  menuPanel.classList.remove('is-closing');
  menuPanel.dataset.menuState = 'opening';
  if (!menuPanel.open) {
    menuPanel.scrollTop = 0;
    menuPanel.querySelector('.menu-panel-body').scrollTop = 0;
  }
  menuPanel.showModal();
  menuButton.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
  // Resolve the off-screen start position before revealing the sheet.
  getComputedStyle(menuPanel, '::after').transform;
  const reveal = () => {
    menuPanel.classList.add('is-visible');
    menuOpenTimer = window.setTimeout(() => {
      menuPanel.dataset.menuState = 'open';
    }, menuMotion.matches ? 0 : 1000);
  };
  if (menuMotion.matches) reveal();
  else menuFrame = requestAnimationFrame(reveal);
}

function closeMenu({ immediate = false, restoreFocus = true } = {}) {
  if (!menuPanel.open) return;
  if (menuPanel.dataset.menuState === 'closing' && !immediate) return;
  cancelMenuTimers();
  menuRestoreFocus = restoreFocus;
  menuPanel.dataset.menuState = 'closing';
  menuPanel.classList.remove('is-visible');
  menuPanel.classList.add('is-closing');
  // Keep the native modal, focus trap and scroll lock until the sheet has left.
  if (immediate || menuMotion.matches) finishMenuClose();
  else menuCloseTimer = window.setTimeout(finishMenuClose, 680);
}

menuButton.addEventListener('click', openMenu);
menuPanel.querySelector('.menu-close').addEventListener('click', () => closeMenu());
menuPanel.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeMenu();
});
menuPanel.addEventListener('close', () => {
  // A queued close event must not clear a menu that was already reopened.
  if (menuPanel.open) return;
  resetMenu();
  if (menuRestoreFocus) menuButton.focus({ preventScroll: true });
});
menuPanel.addEventListener('click', (event) => {
  if (event.target === menuPanel) closeMenu();
});
menuMotion.addEventListener('change', () => {
  if (!menuMotion.matches || !menuPanel.open) return;
  if (menuPanel.dataset.menuState === 'closing') finishMenuClose();
  else {
    cancelMenuTimers();
    menuPanel.classList.add('is-visible');
    menuPanel.dataset.menuState = 'open';
  }
});
// Store and restore a closed menu when navigating through the back-forward cache.
window.addEventListener('pagehide', () => {
  if (menuPanel.open) closeMenu({ immediate: true, restoreFocus: false });
});
window.addEventListener('pageshow', () => {
  if (menuPanel.open) closeMenu({ immediate: true });
  else resetMenu();
});

const portraitNote = document.querySelector('.portrait-note');
if (portraitNote) {
  const portraitButton = portraitNote.querySelector('.portrait-trigger');
  portraitNote.dataset.enhanced = 'true';
  const showPortraitNote = (visible) => portraitNote.classList.toggle('is-open', visible);
  portraitNote.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') showPortraitNote(true);
  });
  portraitNote.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !portraitButton.matches(':focus-visible')) showPortraitNote(false);
  });
  portraitButton.addEventListener('focus', () => {
    if (portraitButton.matches(':focus-visible')) showPortraitNote(true);
  });
  portraitButton.addEventListener('blur', () => showPortraitNote(false));
  portraitButton.addEventListener('click', (event) => {
    showPortraitNote(event.pointerType === 'touch'
      ? !portraitNote.classList.contains('is-open') : true);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!portraitNote.contains(event.target)) showPortraitNote(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') showPortraitNote(false);
  });
}

const clock = document.querySelector('[data-clock]');
function updateClock() {
  if (clock) clock.textContent = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()) + ' JST';
}
updateClock();
if (clock) setInterval(updateClock, 60_000);
document.querySelectorAll('[data-year]').forEach((element) => { element.textContent = new Date().getFullYear(); });

function initializeSkillTabs() {
  const list = document.querySelector('.skill-tabs');
  if (!list || list.dataset.initialized) return;
  list.dataset.initialized = 'true';
  const tabs = [...document.querySelectorAll('[role="tab"]')];
function activateTab(selected) {
  tabs.forEach((tab) => {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    activateTab(tabs[next]);
    tabs[next].focus();
  });
});

}
initializeSkillTabs();
window.addEventListener('portfolio:content-updated', initializeSkillTabs);

const form = document.getElementById('contact-form');
if (form) {
  const message = form.elements.namedItem('message');
  const counter = document.getElementById('message-count');
  const confirmation = document.getElementById('contact-confirmation');
  const values = document.getElementById('confirmation-values');
  let requestKey = null;
  let requestBody = null;
  let sending = false;
  const sendButton = document.getElementById('send-contact');
  const editButton = document.getElementById('edit-form');
  const sendError = document.getElementById('contact-send-error');
  const labels = { name: 'お名前', company: '会社名 / 屋号', email: 'メールアドレス', type: 'ご相談の種類', message: 'ご相談内容' };
  const validate = () => {
    form.elements.namedItem('name').setCustomValidity(form.elements.namedItem('name').value.trim() ? '' : 'お名前を入力してください。');
    message.setCustomValidity([...message.value.trim()].length >= 10 ? '' : 'ご相談内容を10文字以上で入力してください。');
    counter.textContent = String([...message.value].length);
  };
  form.addEventListener('input', validate);
  document.getElementById('review-contact').addEventListener('click', () => form.requestSubmit());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    validate();
    if (!form.reportValidity()) return;
    values.replaceChildren();
    const data = new FormData(form);
    Object.entries(labels).forEach(([name, label]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = data.get(name).trim() || '未入力';
      row.append(term, detail);
      values.append(row);
    });
    const payload = Object.fromEntries([...data].map(([key,value]) => [key,String(value).trim()]));
    const serialized = JSON.stringify(payload);
    if (serialized !== requestBody) { requestBody = serialized; requestKey = crypto.randomUUID(); }
    sendError.hidden = true;
    form.hidden = true;
    confirmation.hidden = false;
    document.getElementById('confirmation-title').focus();
  });
  editButton.addEventListener('click', () => {
    if (sending) return;
    confirmation.hidden = true;
    form.hidden = false;
    form.elements.namedItem('name').focus();
  });
  sendButton.addEventListener('click', async () => {
    if (sending || !requestBody || !requestKey) return;
    sending = true;
    sendButton.disabled = editButton.disabled = true;
    sendButton.textContent = '送信しています…';
    sendError.hidden = true;
    try {
      const configResponse = await fetch('/assets/runtime-config.json', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!configResponse.ok) throw new Error('送信先を取得できませんでした。時間をおいて再度お試しください。');
      const { apiBaseUrl } = await configResponse.json();
      if (!apiBaseUrl) throw new Error('現在、送信機能を準備しています。時間をおいて再度お試しください。');
      const url = new URL(apiBaseUrl);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('送信先を確認できませんでした。');
      const response = await fetch(`${apiBaseUrl.replace(/\/$/,'')}/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
        body: requestBody, signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '送信できませんでした。時間をおいて再度お試しください。');
      confirmation.hidden = true;
      document.getElementById('contact-success').hidden = false;
      document.getElementById('contact-receipt').textContent = result.id || '受付済み';
      document.getElementById('contact-success-title').focus();
      form.reset();
      requestBody = requestKey = null;
    } catch (error) {
      sendError.textContent = error.name === 'TimeoutError' || error instanceof TypeError
        ? '通信を確認できませんでした。もう一度送信できます。同じ内容が二重に登録されることはありません。'
        : error.message;
      sendError.hidden = false;
    } finally {
      sending = false;
      sendButton.disabled = editButton.disabled = false;
      sendButton.textContent = 'この内容で送信する ↗';
    }
  });
}
