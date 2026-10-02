/* Public JSON is rendered as escaped text. Administrative data never enters this endpoint. */
(() => {
  const page = document.querySelector('[data-portfolio-page]')?.dataset.portfolioPage;
  if (!['index', 'works', 'partners', 'pricing'].includes(page)) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr = value => Array.isArray(value) ? value : [];
  const uniq = values => [...new Set(values)];
  // Company names can be hidden without removing their project history.
  const publicCompanyName = value => /ハラハチ|harahachi/i.test(String(value??'').normalize('NFKC').replace(/\s+/g,'')) ? '' : String(value??'');
  const partnerGroup = row => String(row.id??'').toLowerCase()==='riams' || /リアムス|riams/i.test(String(row.name??'').normalize('NFKC').replace(/\s+/g,'')) ? 'co-development' : 'long-term';
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
    const tabs = rows.map((r,i) => `<button id="tab-${esc(r.id)}" role="tab" aria-selected="${i===0}" aria-controls="panel-${esc(r.id)}" tabindex="${i===0?0:-1}">${icons[r.icon] || icons.cloud}<span>${esc(r.label)}</span></button>`).join('');
    const panels = rows.map((r,i) => `<div class="skill-panel" id="panel-${esc(r.id)}" role="tabpanel" aria-labelledby="tab-${esc(r.id)}" tabindex="0" ${i?'hidden':''}><div class="skill-intro"><span class="skill-symbol">${icons[r.icon] || icons.cloud}</span></div><div class="skill-details">${arr(r.groups).map(g => `<div class="skill-row"><h4>${esc(g.name)}</h4>${tags(g.items)}</div>`).join('')}</div></div>`).join('');
    target.innerHTML = `<div class="section-title"><h2>スキル</h2></div>${rows.length ? `<div class="skill-tabs" role="tablist" aria-label="スキルの分類">${tabs}</div>${panels}<p class="skill-credits">公開条件を確認したロゴ・オリジナルマークを使用しています。<a href="assets/brands/credits.html">出典・利用条件</a></p>` : '<p>現在掲載しているスキルはありません。</p>'}`;
  }
  function projectCategories(p) {
    return uniq([p.category,...arr(p.categories),...((p.role || '').includes('ネットワークエンジニア') ? ['network'] : [])]);
  }
  function projectTags(p) { return uniq([...arr(p.tags),...arr(p.phases),...arr(p.stackGroups).flatMap(g=>arr(g.tags))]); }
  function projectArticle(p) {
    const partnerName=publicCompanyName(p.partner), clientName=publicCompanyName(p.client);
    const partnerType = partnerGroup({name:partnerName})==='co-development' ? '共同開発パートナー' : '長期パートナー';
    const partner = partnerName ? `<p class="partner-label"><span>${partnerType}</span>：${esc(partnerName)}${esc(p.partnerHonorific ?? '様')}</p>` : '';
    const phase = `<section class="project-detail-section project-phases" aria-label="担当フェーズ"><h4>担当フェーズ</h4><div class="project-tags" role="group" aria-label="担当フェーズのタグ">${arr(p.phases).map(tagButton).join('')}</div></section>`;
    const stacks = `<section class="project-detail-section project-stack" aria-label="技術スタック"><h4>技術スタック</h4><dl class="stack-groups">${arr(p.stackGroups).map(g=>`<div class="stack-group"><dt>${esc(g.label)}</dt><dd><div class="project-tags" role="group" aria-label="${esc(g.label)}のタグ">${arr(g.tags).map(tagButton).join('')}</div></dd></div>`).join('')}</dl></section>`;
    return `<article class="timeline-item ${p.current?'is-current':''}" data-category="${esc(p.category)}" data-categories="${esc(JSON.stringify(projectCategories(p)))}" data-current="${p.current===true}" data-project-year="${esc(p.year)}" data-tags="${esc(JSON.stringify(projectTags(p)))}" id="project-${esc(p.id)}" tabindex="-1"><div class="timeline-date"><span class="mono">${esc(p.period)}</span>${p.current?'<span class="status"><i></i>進行中</span>':''}</div><div class="timeline-track" aria-hidden="true"><span></span></div><div class="timeline-content">${partner}<div class="project-kicker">${clientName&&clientName!==partnerName?`<span class="project-client-label">${esc(clientName)}</span>`:''}<span class="mono">${esc(projectCategories(p).join(' / ').toUpperCase())}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><details class="project-detail"><summary>担当・技術を見る <span aria-hidden="true">+</span></summary><div class="project-detail-body"><div class="project-role"><h4>ROLE</h4><p>${esc(p.role)}</p></div>${phase}${stacks}</div></details></div></article>`;
  }
  function renderWorks(rows) {
    const target = document.querySelector('[data-work-history]');
    if (!target) return;
    const grouped = new Map();
    rows.forEach(p=>{const year=String(p.year);if(!grouped.has(year))grouped.set(year,[]);grouped.get(year).push(p);});
    const years = [...grouped.keys()].sort((a,b)=>Number(b)-Number(a)).map(year=>`<section class="work-year" data-work-year="${esc(year)}" aria-labelledby="year-${esc(year)}"><header class="work-year-heading"><h2 id="year-${esc(year)}">${esc(year)}<span>年</span></h2><span class="work-year-count"><span data-year-count>${grouped.get(year).length}</span>件</span><span class="work-year-line" aria-hidden="true"></span></header><div class="year-projects">${grouped.get(year).map(projectArticle).join('')}</div></section>`).join('');
    const counts = new Map();rows.forEach(p=>uniq(arr(p.tags)).forEach(t=>counts.set(t,(counts.get(t)||0)+1)));
    const popular=[...counts.keys()].sort((a,b)=>counts.get(b)-counts.get(a)||a.localeCompare(b)).slice(0,8).map(tagButton).join('');
    const filters=[['all','All'],['current','現在進行中'],['infrastructure','Infrastructure'],['development','Development'],['network','Network']].map(([id,label])=>{
      const count=rows.filter(p=>id==='all'||(id==='current'?p.current===true:projectCategories(p).includes(id))).length;
      const active=id==='all';
      return `<button type="button" data-filter="${id}" data-filter-label="${label}" aria-pressed="${active}" aria-label="${label}${active?`、${count}件`:''}" ${active?'class="active"':''}>${label} <span data-filter-count aria-hidden="true" ${active?'':'hidden'}>${String(count).padStart(2,'0')}</span></button>`;
    }).join('');
    target.outerHTML=`<section class="works-section wrap" data-work-history aria-label="実績一覧"><div class="works-toolbar" data-work-controls hidden><div class="work-filter-top"><div class="filters" role="group" aria-label="実績の絞り込み">${filters}</div><button class="work-clear" type="button" data-work-reset disabled>条件をクリア <span aria-hidden="true">↺</span></button></div><div class="work-search-row"><label for="work-tag-search">タグ検索</label><div class="work-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="work-tag-search" type="search" placeholder="AWS、Terraform、VPN…" aria-describedby="work-search-hint" autocomplete="off" spellcheck="false" maxlength="100"></div></div><p id="work-search-hint" class="work-search-hint">技術名・担当フェーズの一部で検索できます。タグを押すと検索欄に入ります。</p><div class="popular-tags"><span class="popular-tags-label">よく使うタグ</span><div class="work-tag-list" role="group" aria-label="よく使うタグ">${popular}</div></div></div><div class="work-results-bar"><p class="filter-status" role="status" aria-live="polite" aria-atomic="true"><strong>${rows.length}</strong> / ${rows.length} 件の実績</p><span class="work-sort-note">開始年の新しい順</span></div><div class="timeline">${years}</div><div class="work-empty" data-work-empty hidden><p>該当する実績がありません。</p><span>タグ名・カテゴリ・進行中の条件を変えてお試しください。</span><button type="button" class="work-empty-reset" data-work-reset>すべての実績を表示 <span aria-hidden="true">↗</span></button></div></section>`;
  }
  let featuredController;
  function initFeatured() {
    featuredController?.abort();
    const section=document.querySelector('[data-featured-works]');if(!section)return;
    const track=section.querySelector('.featured-track'),controls=section.querySelector('[data-featured-controls]');
    if(!track || !controls)return;
    const cards=[...track.querySelectorAll('.featured-case')],prev=controls.querySelector('[data-featured-prev]'),next=controls.querySelector('[data-featured-next]');
    featuredController=new AbortController();
    const {signal}=featuredController;
    let active=0,frame=0;
    controls.hidden=cards.length<2;
    track.tabIndex=cards.length>1?0:-1;
    track.scrollLeft=0;
    const position=index=>Math.min(cards[index].offsetLeft-cards[0].offsetLeft,Math.max(0,track.scrollWidth-track.clientWidth));
    const update=()=>{
      frame=0;if(!cards.length)return;
      active=cards.reduce((best,_,i)=>Math.abs(track.scrollLeft-position(i))<Math.abs(track.scrollLeft-position(best))?i:best,0);
      prev.disabled=active===0;next.disabled=active===cards.length-1;
      const label=controls.querySelector('[data-featured-status]');
      const title=cards[active].querySelector('h3').textContent;
      if(label.textContent!==title)label.textContent=title;
      cards.forEach((card,i)=>card.classList.toggle('is-selected',i===active));
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    const move=index=>{
      if(!cards.length)return;
      track.scrollTo({left:position(Math.max(0,Math.min(index,cards.length-1))),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    };
    prev.addEventListener('click',()=>move(active-1),{signal});
    next.addEventListener('click',()=>move(active+1),{signal});
    track.addEventListener('scroll',schedule,{passive:true,signal});
    track.addEventListener('keydown',event=>{
      if(event.target!==track || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      move(event.key==='Home'?0:event.key==='End'?cards.length-1:active+(event.key==='ArrowRight'?1:-1));
    },{signal});
    const resize=new ResizeObserver(schedule);resize.observe(track);
    signal.addEventListener('abort',()=>{resize.disconnect();cancelAnimationFrame(frame);},{once:true});
    update();
  }
  function renderFeatured(rows) {
    const target=document.querySelector('.selected-grid');if(!target)return;
    const published=rows.filter(p=>p.published!==false && /^[0-9]{4}$/.test(String(p.year??'')));
    const latestYear=published.length?Math.max(...published.map(p=>Number(p.year))):null;
    const selected=published.filter(p=>Number(p.year)===latestYear || Number(p.year)===latestYear-1).sort((a,b)=>Number(b.year)-Number(a.year));
    target.innerHTML=selected.map((p,i)=>`<a class="project-feature featured-case${i===0?' is-selected':''}" href="works.html#project-${esc(p.id)}"><div class="featured-case-meta"><span class="mono">${esc(p.period)}</span>${p.current?'<span class="project-active"><i></i>進行中</span>':''}</div><div class="featured-case-body">${publicCompanyName(p.partner)||publicCompanyName(p.client)?`<p class="project-client">${esc(publicCompanyName(p.partner)||publicCompanyName(p.client))}</p>`:''}<h3>${esc(p.title)}</h3><p class="featured-case-summary">${esc(p.summary)}</p></div><div class="featured-case-bottom"><span class="project-category">${esc(String(p.category??'').toUpperCase())}</span><span class="featured-case-action"><span>詳細を見る</span>${rightArrow}</span></div></a>`).join('') || '<p class="featured-empty">現在掲載している実績はありません。</p>';
    initFeatured();
  }
  function renderPartners(rows) {
    document.querySelectorAll('.partners-list,.company-previews').forEach(target=>{
      const hidden=new Set(JSON.parse(target.dataset.hiddenPartners||'[]'));
      const group=target.dataset.partnerGroup;
      const visible=rows.filter(p=>p.published!==false && !hidden.has(p.id) && publicCompanyName(p.name) && (!group || partnerGroup(p)===group));
      target.innerHTML=target.classList.contains('partners-list')
        ? visible.map(p=>`<article class="partner-row"><div class="partner-gallery">${arr(p.sites).map(preview).join('')}</div><div class="partner-description"><h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p>${tags(p.tags)}</div></article>`).join('')
        : visible.flatMap(p=>arr(p.sites).slice(0,1)).map(preview).join('');
      const section=target.closest('[data-partner-section]');
      if(section)section.hidden=target.childElementCount===0;
    });
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
  initFeatured();
  window.portfolioContentReady=loadContent();
})();
