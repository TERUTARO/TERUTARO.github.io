"""Render the searchable work archive without importing the page builder."""
from collections import Counter, defaultdict
from html import escape
import json
from content_visibility import public_company_name


def e(value):
    return escape(str(value), quote=True)


def tag_button(tag):
    return f'<button class="work-tag" type="button" data-work-tag="{e(tag)}" aria-pressed="false" aria-label="{e(tag)}でタグ検索" disabled><span>{e(tag)}</span></button>'


def project_categories(item):
    """Keep the primary category, explicit additions, and the stated role."""
    categories = list(dict.fromkeys([item['category'], *item.get('categories', [])]))
    if 'ネットワークエンジニア' in item.get('role', '') and 'network' not in categories:
        categories.append('network')
    return categories


def project_search_tags(item):
    tags = list(item['tags']) + item.get('phases', [])
    for group in item.get('stackGroups', []):
        tags.extend(group['tags'])
    return list(dict.fromkeys(tags))


def project_details(item):
    phases = item.get('phases', [])
    groups = item.get('stackGroups', [])
    phase_section = ''
    stack_section = ''
    if phases:
        phase_tags = ''.join(tag_button(phase) for phase in phases)
        phase_section = f'<section class="project-detail-section project-phases" aria-label="担当フェーズ"><h4>担当フェーズ</h4><div class="project-tags" role="group" aria-label="担当フェーズのタグ">{phase_tags}</div></section>'
    if groups:
        rows = ''.join(f'<div class="stack-group"><dt>{e(group["label"])}</dt><dd><div class="project-tags" role="group" aria-label="{e(group["label"])}のタグ">{"".join(tag_button(tag) for tag in group["tags"])}</div></dd></div>' for group in groups)
        stack_section = f'<section class="project-detail-section project-stack" aria-label="技術スタック"><h4>技術スタック</h4><dl class="stack-groups">{rows}</dl></section>'
    return f'<details class="project-detail"><summary>担当・技術を見る <span aria-hidden="true">+</span></summary><div class="project-detail-body"><div class="project-role"><h4>ROLE</h4><p>{e(item["role"])}</p></div>{phase_section}{stack_section}</div></details>'


def render_work_history(data):
    projects = data['projects']
    filter_counts = Counter(category for item in projects for category in project_categories(item))
    filter_counts['all'] = len(projects)
    filter_counts['current'] = sum(item.get('current') is True for item in projects)
    filter_labels = [('all', 'All'), ('current', '現在進行中'), ('infrastructure', 'Infrastructure'), ('development', 'Development'), ('network', 'Network')]
    filter_buttons = []
    for key, label in filter_labels:
        selected = key == 'all'
        class_attribute = ' class="active"' if selected else ''
        accessible_label = f'{label}、{filter_counts[key]}件' if selected else label
        hidden = '' if selected else ' hidden'
        filter_buttons.append(f'<button{class_attribute} type="button" data-filter="{key}" data-filter-label="{label}" aria-pressed="{str(selected).lower()}" aria-label="{accessible_label}">{label} <span data-filter-count aria-hidden="true"{hidden}>{filter_counts[key]:02d}</span></button>')
    filters = ''.join(filter_buttons)
    grouped = defaultdict(list)
    tag_counts = Counter(tag for item in projects for tag in set(item['tags']))
    popular_tags = sorted(tag_counts, key=lambda tag: (-tag_counts[tag], tag.casefold()))[:8]
    popular = ''.join(tag_button(tag) for tag in popular_tags)
    for item in projects:
        grouped[str(item['year'])].append(item)

    years = []
    for year in sorted(grouped, reverse=True):
        articles = []
        for item in grouped[year]:
            current = item.get('current') is True
            categories = project_categories(item)
            category_label = ' / '.join(category.upper() for category in categories)
            status = '<span class="status"><i></i>進行中</span>' if current else ''
            search_tags = project_search_tags(item)
            partner = public_company_name(item.get('partner'))
            client = public_company_name(item.get('client'))
            partner_honorific = item.get('partnerHonorific', '様')
            partner_label = f'<p class="partner-label"><span>長期パートナー</span>：{e(partner)}{e(partner_honorific)}</p>' if partner else ''
            client_label = f'<span class="project-client-label">{e(client)}</span>' if client and client != partner else ''
            articles.append(f'''<article class="timeline-item {'is-current' if current else ''}" data-category="{e(item['category'])}" data-categories="{e(json.dumps(categories, ensure_ascii=False))}" data-current="{str(current).lower()}" data-project-year="{e(year)}" data-tags="{e(json.dumps(search_tags, ensure_ascii=False))}" id="project-{e(item['id'])}" tabindex="-1">
<div class="timeline-date"><span class="mono">{e(item['period'])}</span>{status}</div><div class="timeline-track" aria-hidden="true"><span></span></div>
<div class="timeline-content">{partner_label}<div class="project-kicker">{client_label}<span class="mono">{e(category_label)}</span></div><h3>{e(item['title'])}</h3><p>{e(item['summary'])}</p>{project_details(item)}</div></article>''')
        years.append(f'''<section class="work-year" data-work-year="{e(year)}" aria-labelledby="year-{e(year)}"><header class="work-year-heading"><h2 id="year-{e(year)}">{e(year)}<span>年</span></h2><span class="work-year-count"><span data-year-count>{len(articles)}</span>件</span><span class="work-year-line" aria-hidden="true"></span></header><div class="year-projects">{''.join(articles)}</div></section>''')

    return f'''<section class="works-section wrap" data-work-history aria-label="実績一覧">
<div class="works-toolbar" data-work-controls hidden><div class="work-filter-top"><div class="filters" role="group" aria-label="実績の絞り込み">{filters}</div><button class="work-clear" type="button" data-work-reset disabled>条件をクリア <span aria-hidden="true">↺</span></button></div>
<div class="work-search-row"><label for="work-tag-search">タグ検索</label><div class="work-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="work-tag-search" type="search" placeholder="AWS、Terraform、VPN…" aria-describedby="work-search-hint" autocomplete="off" spellcheck="false" maxlength="100"></div></div><p id="work-search-hint" class="work-search-hint">技術名・担当フェーズの一部で検索できます。タグを押すと検索欄に入ります。</p><div class="popular-tags"><span class="popular-tags-label">よく使うタグ</span><div class="work-tag-list" role="group" aria-label="よく使うタグ">{popular}</div></div></div>
<div class="work-results-bar"><p class="filter-status" role="status" aria-live="polite" aria-atomic="true"><strong>{len(projects)}</strong> / {len(projects)} 件の実績</p><span class="work-sort-note">開始年の新しい順</span></div>
<div class="timeline">{''.join(years)}</div><div class="work-empty" data-work-empty hidden><p>該当する実績がありません。</p><span>タグ名・カテゴリ・進行中の条件を変えてお試しください。</span><button type="button" class="work-empty-reset" data-work-reset>すべての実績を表示 <span aria-hidden="true">↗</span></button></div>
<p class="source-note">2025年6月版の職務経歴書をもとに、2025年9月開始の案件・2026年の実績と追加情報を反映しています。過去資料の「現在」表記は2025年6月時点です。</p></section>'''
