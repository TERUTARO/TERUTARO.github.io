/* Work archive: one category/status filter plus case/width-insensitive tags. */
(() => {
  const t = source => window.portfolioI18n?.t(source) ?? source;
  let activeArchive;
  function initialize() {
  const archive = document.querySelector('[data-work-history]');
  if (!archive || archive === activeArchive) return;
  activeArchive = archive;

  const controls = archive.querySelector('[data-work-controls]');
  const input = archive.querySelector('#work-tag-search');
  const filters = [...archive.querySelectorAll('[data-filter]')];
  const tagButtons = [...archive.querySelectorAll('[data-work-tag]')];
  const resetButtons = [...archive.querySelectorAll('[data-work-reset]')];
  const projects = [...archive.querySelectorAll('.timeline-item')];
  const years = [...archive.querySelectorAll('[data-work-year]')];
  const status = archive.querySelector('.filter-status');
  const empty = archive.querySelector('[data-work-empty]');
  const locale = { ja: 'ja', en: 'en', zh: 'zh-CN' }[window.portfolioI18n?.locale] || 'ja';
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase(locale).trim().replace(/\s+/g, ' ');
  const tagQueries = tag => [normalize(tag), normalize(t(tag))];
  const projectTags = new Map(projects.map(project => [project, JSON.parse(project.dataset.tags).flatMap(tagQueries)]));
  const projectCategories = new Map(projects.map(project => [project, JSON.parse(project.dataset.categories)]));
  let category = 'all';
  let composing = false;

  function update() {
    const query = normalize(input.value);
    const filterCounts = Object.fromEntries(filters.map(button => [button.dataset.filter, 0]));
    let count = 0;
    projects.forEach(project => {
      const matchesTag = !query || projectTags.get(project).some(tag => tag.includes(query));
      const matchesCategory = filter => filter === 'all' || (filter === 'current'
        ? project.dataset.current === 'true'
        : projectCategories.get(project).includes(filter));
      const matchesFilter = matchesCategory(category);
      if (matchesTag) filters.forEach(button => {
        if (matchesCategory(button.dataset.filter)) filterCounts[button.dataset.filter]++;
      });
      project.hidden = !(matchesFilter && matchesTag);
      if (!project.hidden) count++;
    });
    years.forEach(year => {
      const count = year.querySelectorAll('.timeline-item:not([hidden])').length;
      year.hidden = count === 0;
      year.querySelector('[data-year-count]').textContent = count;
    });
    filters.forEach(button => {
      const active = button.dataset.filter === category;
      const count = filterCounts[button.dataset.filter];
      const number = button.querySelector('[data-filter-count]');
      number.textContent = String(count).padStart(2, '0');
      number.hidden = !active;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', active
        ? t(`${button.dataset.filterLabel}、${count}件`)
        : t(button.dataset.filterLabel));
    });
    tagButtons.forEach(button => button.setAttribute('aria-pressed', String(Boolean(query) && tagQueries(button.dataset.workTag).includes(query))));
    resetButtons.forEach(button => { button.disabled = category === 'all' && !input.value; });
    status.replaceChildren();
    const number = document.createElement('strong');
    number.textContent = count;
    status.append(number, t(` / ${projects.length} 件の実績`));
    if (query || category !== 'all') {
      const conditions = document.createElement('span');
      conditions.className = 'sr-only';
      const label = filters.find(button => button.dataset.filter === category)?.dataset.filterLabel || category;
      conditions.textContent = ' ' + [
        category === 'current' ? t('現在進行中のみ。') : category !== 'all' ? t(`カテゴリ ${label}。`) : '',
        query ? t(`タグ「${input.value.trim()}」で検索。`) : '',
      ].filter(Boolean).join(' ');
      status.append(conditions);
    }
    empty.hidden = count !== 0;
  }

  function reset() {
    category = 'all';
    input.value = '';
    update();
  }

  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    update();
  }));
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; update(); });
  input.addEventListener('input', event => {
    if (!composing && !event.isComposing) update();
  });
  input.addEventListener('search', () => { if (!composing) update(); });
  tagButtons.forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => {
      input.value = tagQueries(button.dataset.workTag).includes(normalize(input.value)) ? '' : t(button.dataset.workTag);
      update();
    });
  });
  resetButtons.forEach(button => button.addEventListener('click', () => {
    const fromEmpty = button.closest('[data-work-empty]');
    reset();
    if (fromEmpty) input.focus();
  }));

  function revealLinkedProject() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id.startsWith('project-')) return;
    const project = document.getElementById(id);
    if (!project || !archive.contains(project) || !project.classList.contains('timeline-item')) return;
    if (project.hidden || project.closest('[data-work-year]').hidden) reset();
    project.querySelector('details').open = true;
    requestAnimationFrame(() => {
      project.focus({ preventScroll: true });
      project.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  }

  controls.hidden = false;
  update();
  revealLinkedProject();
  window.onPortfolioProjectHash = revealLinkedProject;
  }
  initialize();
  window.addEventListener('portfolio:content-updated', initialize);
  window.addEventListener('hashchange', () => window.onPortfolioProjectHash?.());
})();
