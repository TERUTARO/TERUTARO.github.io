(() => {
  const assets = 'assets/brands/';
  const imageCache = new Map();
  const normalize = (value) => value.toLowerCase().replace(/[\s._\-/]+/g, '');
  const products = new Map(Object.entries({
    aws: 'amazonwebservices', amazonwebservices: 'amazonwebservices',
    gcp: 'googlecloud', googlecloud: 'googlecloud',
    gce: 'googlecloud', gae: 'googlecloud', gke: 'googlecloud',
    bigquery: 'googlecloud', cloudsql: 'googlecloud', cloudrun: 'googlecloud',
    cloudfunctions: 'googlecloud', vertexai: 'vertexai',
    bedrock: 'bedrock', amazonbedrock: 'bedrock', azureopenai: 'azure',
    ruby: 'ruby', typescript: 'typescript', javascript: 'javascript', php: 'php',
    googleappsscript: 'googleappsscript', rubyonrails: 'rails',
    rails: 'rails', react: 'react', nextjs: 'nextjs', vuejs: 'vuejs',
    nuxtjs: 'nuxtjs', yii: 'yii', codeigniter: 'codeigniter',
    wordpress: 'wordpress', mysql: 'mysql', jwt: 'jsonwebtokens',
    codex: 'openai', openai: 'openai', claude: 'claude', claudecode: 'claude',
    cursor: 'cursor', dify: 'dify', terraform: 'terraform', ansible: 'ansible',
    docker: 'docker', dockercompose: 'docker', github: 'github',
    githubactions: 'githubactions', gitlab: 'gitlab', gitlabcicd: 'gitlab',
    datadog: 'datadog', jira: 'jira', confluence: 'confluence',
    redmine: 'redmine', sphinx: 'sphinx', slack: 'slack', teams: 'microsoft',
    microsoftteams: 'microsoft', hyperv: 'microsoft', vmwarevsphere: 'vmware',
    vmware: 'vmware', fortigate: 'fortinet', fortinet: 'fortinet',
  }).map(([key, value]) => [normalize(key), value]));

  function findLogo(button) {
    const name = normalize(button.textContent);
    const group = normalize(button.closest('.skill-row').querySelector('h4')?.textContent || '');
    if (group === 'aws' || name.startsWith('aws')) return 'amazonwebservices';
    if (group === 'googlecloud' || group === 'gcp' || name.startsWith('gcp')) return 'googlecloud';
    if (name.startsWith('cisco')) return 'cisco';
    if (name.startsWith('yamaha')) return 'yamahacorporation';
    if (name.startsWith('github')) return products.get(name) || 'github';
    return products.get(name) || null;
  }

  function loadLogo(name) {
    if (!imageCache.has(name)) {
      imageCache.set(name, new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image.src);
        image.onerror = () => resolve(null);
        image.src = `${assets}${name}.svg`;
      }));
    }
    return imageCache.get(name);
  }

  let teardown = () => {};
  function initialize() {
    teardown();
    const section = document.getElementById('skills');
    if (!section) return;
    const listeners = new AbortController();
    const states = [];
    const on = (element, name, listener) => element.addEventListener(name, listener, { signal: listeners.signal });

    section.querySelectorAll('.skill-panel').forEach((panel) => {
      const symbol = panel.querySelector('.skill-symbol');
      if (!symbol) return;
      symbol.setAttribute('aria-hidden', 'true');
      symbol.querySelector('.skill-brand-mark')?.remove();
      symbol.classList.remove('has-product-logo');
      delete symbol.dataset.logo;
      const image = document.createElement('img');
      image.className = 'skill-brand-mark';
      image.alt = '';
      image.draggable = false;
      image.width = 200;
      image.height = 200;
      symbol.append(image);
      const state = { panel, hovered: null, focused: null, pinned: null, revision: 0 };
      states.push(state);

      function render() {
        const revision = ++state.revision;
        const target = state.focused || state.hovered || state.pinned;
        const logo = target ? findLogo(target) : null;
        panel.querySelectorAll('.skill-tag').forEach((button) => {
          button.setAttribute('aria-pressed', String(button === state.pinned));
        });
        // A pending image must never replace a newer tag or a newly selected tab.
        if (!logo) {
          symbol.classList.remove('has-product-logo');
          delete symbol.dataset.logo;
          return;
        }
        loadLogo(logo).then((src) => {
          if (revision !== state.revision || !panel.isConnected || panel.hidden) return;
          if (!src) {
            symbol.classList.remove('has-product-logo');
            delete symbol.dataset.logo;
            return;
          }
          image.src = src;
          symbol.dataset.logo = logo;
          symbol.classList.add('has-product-logo');
        });
      }

      state.reset = () => {
        state.hovered = state.focused = state.pinned = null;
        render();
      };

      panel.querySelectorAll('.skill-row .tags > span, .skill-row .tags > .skill-tag').forEach((tag) => {
        const button = tag.tagName === 'BUTTON' ? tag : document.createElement('button');
        button.type = 'button';
        button.className = 'skill-tag';
        button.textContent = tag.textContent;
        button.setAttribute('aria-label', `${tag.textContent}のロゴを表示`);
        button.setAttribute('aria-pressed', 'false');
        if (button !== tag) tag.replaceWith(button);
        on(button, 'pointerenter', (event) => {
          if (event.pointerType === 'touch') return;
          state.focused = null;
          state.hovered = button;
          render();
        });
        on(button, 'pointerleave', (event) => {
          if (event.pointerType === 'touch') return;
          if (state.hovered === button) state.hovered = null;
          render();
        });
        on(button, 'focus', () => {
          if (button.matches(':focus-visible')) state.focused = button;
          render();
        });
        on(button, 'blur', () => {
          if (state.focused === button) state.focused = null;
          render();
        });
        on(button, 'click', () => {
          state.focused = null;
          state.pinned = state.pinned === button ? null : button;
          render();
        });
      });
    });

    const observer = new MutationObserver(() => {
      states.forEach((state) => { if (state.panel.hidden) state.reset(); });
    });
    states.forEach((state) => observer.observe(state.panel, { attributes: true, attributeFilter: ['hidden'] }));
    on(document, 'pointerdown', (event) => {
      states.forEach((state) => {
        const tag = event.target.closest?.('.skill-tag');
        if (!tag || !state.panel.contains(tag)) state.reset();
      });
    });
    on(document, 'keydown', (event) => {
      if (event.key === 'Escape') states.forEach((state) => state.reset());
    });
    teardown = () => {
      listeners.abort();
      observer.disconnect();
      states.forEach((state) => state.reset());
    };
  }

  initialize();
  window.addEventListener('portfolio:content-updated', initialize);
})();
