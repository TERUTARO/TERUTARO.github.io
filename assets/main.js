'use strict';

// Native links and semantic HTML work without a framework or a build server.
const menuButton = document.querySelector('.menu-trigger');
const menuPanel = document.querySelector('#site-menu');
menuButton.hidden = false;
function closeMenu() {
  menuPanel.close();
}
menuButton.addEventListener('click', () => {
  menuPanel.showModal();
  menuButton.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
});
menuPanel.querySelector('.menu-close').addEventListener('click', closeMenu);
menuPanel.addEventListener('close', () => {
  menuButton.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
  menuButton.focus({ preventScroll: true });
});
menuPanel.addEventListener('click', (event) => {
  if (event.target === menuPanel) closeMenu();
});
// Restore the normal page if the browser returns to a cached, open menu.
window.addEventListener('pageshow', () => {
  if (menuPanel.open) closeMenu();
});

const clock = document.querySelector('[data-clock]');
function updateClock() {
  if (clock) clock.textContent = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()) + ' JST';
}
updateClock();
if (clock) setInterval(updateClock, 60_000);
document.querySelectorAll('[data-year]').forEach((element) => { element.textContent = new Date().getFullYear(); });

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

const filters = [...document.querySelectorAll('[data-filter]')];
const projects = [...document.querySelectorAll('.timeline-item')];
filters.forEach((filter) => filter.addEventListener('click', () => {
  const category = filter.dataset.filter;
  filters.forEach((button) => {
    button.classList.toggle('active', button === filter);
    button.setAttribute('aria-pressed', String(button === filter));
  });
  let count = 0;
  projects.forEach((project) => {
    project.hidden = category !== 'all' && project.dataset.category !== category;
    if (!project.hidden) count++;
  });
  document.querySelector('.filter-status').textContent = `${count}件の実績を表示`;
}));
// Deep links reveal the project on initial navigation and later hash changes.
function revealLinkedProject() {
  if (!location.hash.startsWith('#project-')) return;
  const project = document.getElementById(location.hash.slice(1));
  if (!project) return;
  if (project.hidden) document.querySelector('[data-filter="all"]').click();
  project.querySelector('details').open = true;
}
revealLinkedProject();
window.addEventListener('hashchange', revealLinkedProject);

const form = document.getElementById('contact-form');
if (form) {
  const message = form.elements.namedItem('message');
  const counter = document.getElementById('message-count');
  const confirmation = document.getElementById('contact-confirmation');
  const values = document.getElementById('confirmation-values');
  const labels = { name: 'お名前', company: '会社名 / 屋号', email: 'メールアドレス', type: 'ご相談の種類', message: 'ご相談内容' };
  const validate = () => {
    form.elements.namedItem('name').setCustomValidity(form.elements.namedItem('name').value.trim() ? '' : 'お名前を入力してください。');
    message.setCustomValidity(message.value.trim().length >= 10 ? '' : 'ご相談内容を10文字以上で入力してください。');
    counter.textContent = String(message.value.length);
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
    form.hidden = true;
    confirmation.hidden = false;
    document.getElementById('confirmation-title').focus();
  });
  document.getElementById('edit-form').addEventListener('click', () => {
    confirmation.hidden = true;
    form.hidden = false;
    form.elements.namedItem('name').focus();
  });
}
