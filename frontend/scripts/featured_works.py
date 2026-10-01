"""Text-first featured projects, shared in structure with the public CMS renderer."""
from html import escape


ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>'


def e(value):
    return escape(str(value or ''), quote=True)


def render_featured_works(projects):
    rows = [project for project in projects if project.get('published', True)]
    selected = ([project for project in rows if project.get('current')] or rows)[:2]
    cards = []
    for index, project in enumerate(selected):
        current = '<span class="project-active"><i></i>進行中</span>' if project.get('current') else ''
        cards.append(f'''<a class="project-feature featured-case{' is-selected' if index == 0 else ''}" href="works.html#project-{e(project['id'])}">
  <div class="featured-case-meta"><span class="mono">{e(project.get('period'))}</span>{current}</div>
  <div class="featured-case-body"><p class="project-client">{e(project.get('partner') or project.get('client'))}</p><h3>{e(project.get('title'))}</h3><p class="featured-case-summary">{e(project.get('summary'))}</p></div>
  <div class="featured-case-bottom"><span class="project-category">{e(project.get('category', '').upper())}</span><span class="featured-case-action"><span>詳細を見る</span>{ARROW}</span></div>
</a>''')
    content = ''.join(cards) or '<p class="featured-empty">現在掲載している実績はありません。</p>'
    return f'''<section class="selected-section featured-works" aria-labelledby="featured-works-heading" data-featured-works>
  <div class="featured-works-header"><div class="wrap"><div class="featured-works-heading"><h2 id="featured-works-heading">実績</h2><a class="text-link" href="works.html">すべての実績 {ARROW}</a></div><div class="featured-works-word" aria-hidden="true">WORKS<span> / WORKS</span></div></div></div>
  <div class="featured-works-body"><div class="selected-grid featured-track" id="featured-works-track" role="region" aria-label="ピックアップした実績" tabindex="0">{content}</div>
  <div class="featured-controls wrap" data-featured-controls hidden><span class="featured-count" aria-live="polite" aria-atomic="true"><span data-featured-current>01</span><span aria-hidden="true"> / </span><span class="sr-only">件目 / </span><span data-featured-total>{len(selected):02}</span><span class="sr-only">件</span></span><div class="featured-buttons"><button type="button" data-featured-prev aria-controls="featured-works-track" aria-label="前の実績" disabled>{ARROW}</button><button type="button" data-featured-next aria-controls="featured-works-track" aria-label="次の実績">{ARROW}</button></div></div></div>
</section>'''
