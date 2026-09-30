/* Public JSON is rendered as escaped text. Administrative data never enters this endpoint. */
(() => {
  const page = document.querySelector('[data-portfolio-page]')?.dataset.portfolioPage;
  if (!['index', 'works', 'partners', 'pricing'].includes(page)) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr = value => Array.isArray(value) ? value : [];
  const uniq = values => [...new Set(values)];
  const arrow = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
  const rightArrow = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
  const tags = values => `<div class="tags">${arr(values).map(t => `<span>${esc(t)}</span>`).join('')}</div>`;
  const tagButton = tag => `<button class="work-tag" type="button" data-work-tag="${esc(tag)}" aria-pressed="false" aria-label="${esc(tag)}でタグ検索" disabled><span>${esc(tag)}</span></button>`;
  const icons = Object.fromEntries(['cloud','development','ai','devops'].map(key => [key, document.querySelector(`#tab-${key} .skill-icon`)?.outerHTML || '']));
  const previewKeys = new Set(['riams','asset-compass','harahachi','hinode']);
  const safeURL = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  };
  function preview(site) {
    const href = safeURL(site.url);
    if (!href) return '';
    const visual = previewKeys.has(site.previewKey)
      ? `<img src="/assets/sites/${esc(site.previewKey)}.webp" alt="${esc(site.label)}のWebサイト" width="960" height="600" loading="lazy" decoding="async">`
      : `<span class="site-preview-fallback"><span>${esc(site.label)}</span><span>Webサイトを開く ${arrow}</span></span>`;
    return `<a class="site-preview" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(site.label)}のWebサイトを開く（新しいタブ）"><span class="site-preview-screen">${visual}</span><span class="site-preview-title">${esc(site.label)}${arrow}</span></a>`;
  }
  function renderSkills(rows) {
    const target = document.getElementById('skills');
    if (!target) return;
    const tabs = rows.map((r,i) => `<button id="tab-${esc(r.id)}" role="tab" aria-selected="${i===0}" aria-controls="panel-${esc(r.id)}" tabindex="${i===0?0:-1}">${icons[r.icon] || icons.cloud}<span>${esc(r.label)}</span><span class="tab-arrow">↗</span></button>`).join('');
    const panels = rows.map((r,i) => `<div class="skill-panel" id="panel-${esc(r.id)}" role="tabpanel" aria-labelledby="tab-${esc(r.id)}" tabindex="0" ${i?'hidden':''}><div class="skill-intro"><span class="skill-symbol">${icons[r.icon] || icons.cloud}</span><h3>${esc(r.heading)}</h3></div><div class="skill-details">${arr(r.groups).map(g => `<div class="skill-row"><h4>${esc(g.name)}</h4>${tags(g.items)}</div>`).join('')}</div></div>`).join('');
    target.innerHTML = `<div class="section-title"><h2>スキル</h2></div>${rows.length ? `<div class="skill-tabs" role="tablist" aria-label="スキルの分類">${tabs}</div>${panels}` : '<p>現在掲載しているスキルはありません。</p>'}`;
  }
  function projectCategories(p) {
    return uniq([p.category,...arr(p.categories),...((p.role || '').includes('ネットワークエンジニア') ? ['network'] : [])]);
  }
  function projectTags(p) { return uniq([...arr(p.tags),...arr(p.phases),...arr(p.stackGroups).flatMap(g=>arr(g.tags))]); }
  function projectArticle(p) {
    const partner = p.partner ? `<p class="partner-label"><span>長期パートナー</span>：${esc(p.partner)}${esc(p.partnerHonorific ?? '様')}</p>` : '';
    const phase = `<section class="project-detail-section project-phases" aria-label="担当フェーズ"><h4>担当フェーズ</h4><div class="project-tags" role="group" aria-label="担当フェーズのタグ">${arr(p.phases).map(tagButton).join('')}</div></section>`;
    const stacks = `<section class="project-detail-section project-stack" aria-label="技術スタック"><h4>技術スタック</h4><dl class="stack-groups">${arr(p.stackGroups).map(g=>`<div class="stack-group"><dt>${esc(g.label)}</dt><dd><div class="project-tags" role="group" aria-label="${esc(g.label)}のタグ">${arr(g.tags).map(tagButton).join('')}</div></dd></div>`).join('')}</dl></section>`;
    return `<article class="timeline-item ${p.current?'is-current':''}" data-category="${esc(p.category)}" data-categories="${esc(JSON.stringify(projectCategories(p)))}" data-current="${p.current===true}" data-project-year="${esc(p.year)}" data-tags="${esc(JSON.stringify(projectTags(p)))}" id="project-${esc(p.id)}" tabindex="-1"><div class="timeline-date"><span class="mono">${esc(p.period)}</span>${p.current?'<span class="status"><i></i>進行中</span>':''}</div><div class="timeline-track" aria-hidden="true"><span></span></div><div class="timeline-content">${partner}<div class="project-kicker">${p.client&&p.client!==p.partner?`<span class="project-client-label">${esc(p.client)}</span>`:''}<span class="mono">${esc(projectCategories(p).join(' / ').toUpperCase())}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><details class="project-detail"><summary>担当・技術を見る <span aria-hidden="true">+</span></summary><div class="project-detail-body"><div class="project-role"><h4>ROLE</h4><p>${esc(p.role)}</p></div>${phase}${stacks}</div></details></div></article>`;
  }
  function renderWorks(rows) {
    const target = document.querySelector('[data-work-history]');
    if (!target) return;
    const grouped = new Map();
    rows.forEach(p=>{const year=String(p.year);if(!grouped.has(year))grouped.set(year,[]);grouped.get(year).push(p);});
    const years = [...grouped.keys()].sort((a,b)=>Number(b)-Number(a)).map(year=>`<section class="work-year" data-work-year="${esc(year)}" aria-labelledby="year-${esc(year)}"><header class="work-year-heading"><h2 id="year-${esc(year)}">${esc(year)}<span>年</span></h2><span class="work-year-count"><span data-year-count>${grouped.get(year).length}</span>件</span><span class="work-year-line" aria-hidden="true"></span></header><div class="year-projects">${grouped.get(year).map(projectArticle).join('')}</div></section>`).join('');
    const counts = new Map();rows.forEach(p=>uniq(arr(p.tags)).forEach(t=>counts.set(t,(counts.get(t)||0)+1)));
    const popular=[...counts.keys()].sort((a,b)=>counts.get(b)-counts.get(a)||a.localeCompare(b)).slice(0,8).map(tagButton).join('');
    const filters=[['all',`All <span>${rows.length}</span>`],['current',`現在進行中 <span>${rows.filter(p=>p.current).length}</span>`],['infrastructure','Infrastructure'],['development','Development'],['network','Network']].map(([id,label])=>`<button type="button" data-filter="${id}" aria-pressed="${id==='all'}" ${id==='all'?'class="active"':''}>${label}</button>`).join('');
    target.outerHTML=`<section class="works-section wrap" data-work-history aria-label="実績一覧"><div class="works-toolbar" data-work-controls hidden><div class="work-filter-top"><div class="filters" role="group" aria-label="実績の絞り込み">${filters}</div><button class="work-clear" type="button" data-work-reset disabled>条件をクリア <span aria-hidden="true">↺</span></button></div><div class="work-search-row"><label for="work-tag-search">タグ検索</label><div class="work-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="work-tag-search" type="search" placeholder="AWS、Terraform、VPN…" aria-describedby="work-search-hint" autocomplete="off" spellcheck="false" maxlength="100"></div></div><p id="work-search-hint" class="work-search-hint">技術名・担当フェーズの一部で検索できます。タグを押すと検索欄に入ります。</p><div class="popular-tags"><span class="popular-tags-label">よく使うタグ</span><div class="work-tag-list" role="group" aria-label="よく使うタグ">${popular}</div></div></div><div class="work-results-bar"><p class="filter-status" role="status" aria-live="polite" aria-atomic="true"><strong>${rows.length}</strong> / ${rows.length} 件の実績</p><span class="work-sort-note">開始年の新しい順</span></div><div class="timeline">${years}</div><div class="work-empty" data-work-empty hidden><p>該当する実績がありません。</p><span>タグ名・カテゴリ・進行中の条件を変えてお試しください。</span><button type="button" class="work-empty-reset" data-work-reset>すべての実績を表示 <span aria-hidden="true">↗</span></button></div></section>`;
  }
  function renderFeatured(rows) {
    const target=document.querySelector('.selected-grid');if(!target)return;
    let selected=rows.filter(p=>p.current);if(!selected.length)selected=rows;selected=selected.slice(0,2);
    target.innerHTML=selected.map((p,i)=>`<a class="project-feature" href="works.html#project-${esc(p.id)}"><div class="project-card-top"><span class="project-number">${String(i+1).padStart(2,'0')}</span><span class="project-category">${esc(p.category.toUpperCase())}</span>${p.current?'<span class="project-active"><i></i>進行中</span>':''}</div><div class="project-card-body"><p class="project-client">${esc(p.partner||p.client)}</p><h3>${esc(p.title)}</h3></div><div class="project-card-bottom"><span class="mono">${esc(p.period)}</span><span class="project-card-action">実績を見る ${rightArrow}</span></div></a>`).join('') || '<p>現在掲載している実績はありません。</p>';
  }
  function renderPartners(rows) {
    const target=document.querySelector('.partners-list');
    if(target)target.innerHTML=rows.map(p=>`<article class="partner-row"><div class="partner-gallery">${arr(p.sites).map(preview).join('')}</div><div class="partner-description"><h2>${esc(p.name)}</h2><p>${esc(p.summary)}</p>${tags(p.tags)}</div></article>`).join('') || '<p>現在掲載しているパートナーはありません。</p>';
    const home=document.querySelector('.company-previews');if(home)home.innerHTML=rows.flatMap(p=>arr(p.sites).slice(0,1)).map(preview).join('');
  }
  function price(item,hourly=false) {
    return item.priceYen===null?'<span class="pricing-quote">都度お見積もり</span>':`<span class="pricing-amount">${Number(item.priceYen).toLocaleString('ja-JP')}</span>${hourly?'':'<span class="pricing-currency">円</span>'}`;
  }
  function priceTables(rows,kind) {
    const groups=new Map();rows.forEach(r=>{if(!groups.has(r.category))groups.set(r.category,[]);groups.get(r.category).push(r);});
    return [...groups].map(([category,items],i)=>{
      const service=kind==='service', notes=items.some(r=>r.notes), id=`pricing-${kind}-${i+1}`;
      const headings=service?['作業内容','単位','料金（税抜）','備考']:['フェーズ','単位','料金（税抜）',...(notes?['備考']:[])];
      const body=items.map(r=>{
        const invoice=r.invoiceUnit?`<span class="pricing-invoice-unit">請求書記載単位：${esc(r.invoiceUnit)}</span>`:'';
        const note=r.notes?esc(r.notes):'<span class="pricing-no-note" aria-label="備考なし">—</span>';
        const meta=service?`<span class="pricing-mobile-meta"><span>単位：${esc(r.unit)}</span>${invoice}${r.notes?`<span class="pricing-mobile-note">備考：${esc(r.notes)}</span>`:''}</span>`:'';
        return `<tr data-pricing-sheet="${service?'services':'engineers'}" data-source-row="${esc(r.sourceRow??r.id)}"><th scope="row">${service?`<span class="pricing-product">${esc(r.product)}</span><span class="pricing-task">${esc(r.item)}</span>${meta}`:esc(r.phase)}</th><td class="pricing-unit">${esc(r.unit)}${invoice}</td><td class="pricing-price">${price(r,!service)}</td>${service||notes?`<td class="pricing-note">${note}</td>`:''}</tr>`;
      }).join('');
      return `<details class="pricing-category" aria-labelledby="${id}"><summary class="pricing-category-heading"><h3 id="${id}">${esc(category)}</h3><span class="pricing-category-count">${items.length} <span>項目</span></span><span class="pricing-toggle" aria-hidden="true">+</span></summary>${service?'<p class="pricing-scroll-hint">表は横にスクロールできます。<span aria-hidden="true">↔</span></p>':''}<div class="pricing-table-scroll" ${service||notes?`role="region" aria-labelledby="${id}" tabindex="0"`:''}><table class="pricing-table ${service?'pricing-service-table':'pricing-hourly-table'+(notes?' has-notes':'')}"><caption class="sr-only">${esc(category)}の${service?'サービス単価':'時間単価'}・税抜</caption><thead><tr>${headings.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></details>`;
    }).join('') || '<p class="content-empty">記載のない内容は都度お見積もりします。</p>';
  }
  function renderPricing(data) {
    const service=document.getElementById('service-pricing'),hourly=document.querySelector('.pricing-hourly-grid'),advisory=document.getElementById('advisory-pricing');
    if(service){service.querySelectorAll('.pricing-category,.content-empty').forEach(n=>n.remove());service.insertAdjacentHTML('beforeend',priceTables(data.services,'service'));}
    if(hourly)hourly.innerHTML=priceTables(data.engineers,'hourly');
    if(advisory){advisory.querySelectorAll('.advisory-rate').forEach(n=>n.remove());advisory.insertAdjacentHTML('beforeend',data.advisory.map(r=>`<article class="advisory-rate"><div><h3>${esc(r.title)}</h3><p>${esc(r.summary)}</p></div><div><strong>${r.priceYen===null?'要相談':`${Number(r.priceYen).toLocaleString('ja-JP')}円（税抜）`}</strong><span>${esc(r.unit)}</span></div></article>`).join(''));}
  }
  async function loadContent() {
    let configured=false;
    try {
      const configResponse=await fetch('/assets/runtime-config.json',{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!configResponse.ok)throw new Error('config');
      const config=await configResponse.json();if(!config.apiBaseUrl)return;
      const base=new URL(config.apiBaseUrl);
      if(base.protocol!=='https:' && !(base.protocol==='http:' && ['localhost','127.0.0.1'].includes(base.hostname)))throw new Error('config');
      configured=true;
      const response=await fetch(`${config.apiBaseUrl.replace(/\/$/,'')}/public/content`,{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error('content');
      const payload=await response.json(), data=payload.collections;
      if(payload.schemaVersion!==1 || !data || !['projects','skills','partners','services','engineers','advisory'].every(k=>Array.isArray(data[k])))throw new Error('schema');
      for(const values of Object.values(data))values.sort((a,b)=>(a.order??0)-(b.order??0)||String(a.id).localeCompare(String(b.id)));
      if(page==='index'){renderSkills(data.skills);renderFeatured(data.projects);renderPartners(data.partners);}
      if(page==='works')renderWorks(data.projects);
      if(page==='partners')renderPartners(data.partners);
      if(page==='pricing')renderPricing(data);
      document.documentElement.dataset.contentSource='api';
      window.dispatchEvent(new CustomEvent('portfolio:content-updated'));
    } catch {
      if(!configured)return;
      const notice=document.createElement('p');notice.className='content-notice wrap';notice.setAttribute('role','status');notice.textContent='最新情報を取得できませんでした。保存済みの内容を表示しています。';document.getElementById('main')?.prepend(notice);
      document.documentElement.dataset.contentSource='snapshot';
    }
  }
  window.portfolioContentReady=loadContent();
})();
