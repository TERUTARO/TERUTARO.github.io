"""Render the editable, tax-exclusive pricing tables without running a build."""
from collections import defaultdict
from html import escape


def e(value):
    return escape(str(value), quote=True)


def contact_tabs(active):
    """Ordinary document links styled as tabs; no JavaScript is required."""
    pages = [('contact', 'お問い合わせ'), ('pricing', '料金の目安')]
    if active not in {name for name, _label in pages}:
        raise ValueError(f'Unknown contact page: {active}')
    links = []
    for name, label in pages:
        current = ' aria-current="page"' if name == active else ''
        links.append(f'<a href="{name}.html"{current}>{label}</a>')
    return f'<nav class="contact-tabs wrap" aria-label="お問い合わせと料金">{"".join(links)}</nav>'


def price_cell(item, hourly=False):
    price = item['priceYen']
    if price is None:
        return '<span class="pricing-quote">都度お見積もり</span>'
    suffix = '' if hourly else '<span class="pricing-currency">円</span>'
    return f'<span class="pricing-amount">{price:,}</span>{suffix}'


def service_row(item):
    invoice_unit = (
        f'<span class="pricing-invoice-unit">請求書記載単位：{e(item["invoiceUnit"])}</span>'
        if item.get('invoiceUnit') else ''
    )
    note = e(item['notes']) if item['notes'] else '<span class="pricing-no-note" aria-label="備考なし">—</span>'
    mobile_note = f'<span class="pricing-mobile-note">備考：{e(item["notes"])}</span>' if item['notes'] else ''
    mobile_meta = f'<span class="pricing-mobile-meta"><span>単位：{e(item["unit"])}</span>{invoice_unit}{mobile_note}</span>'
    return f'''<tr data-pricing-sheet="services" data-source-row="{e(item.get('sourceRow', item.get('id', '')))}">
<th scope="row"><span class="pricing-product">{e(item['product'])}</span><span class="pricing-task">{e(item['item'])}</span>{mobile_meta}</th>
<td class="pricing-unit">{e(item['unit'])}{invoice_unit}</td>
<td class="pricing-price">{price_cell(item)}</td><td class="pricing-note">{note}</td></tr>'''


def engineer_row(item, has_notes):
    note = e(item['notes']) if item['notes'] else '<span class="pricing-no-note" aria-label="備考なし">—</span>'
    note_cell = f'<td class="pricing-note">{note}</td>' if has_notes else ''
    return f'''<tr data-pricing-sheet="engineers" data-source-row="{e(item.get('sourceRow', item.get('id', '')))}">
<th scope="row">{e(item['phase'])}</th><td class="pricing-unit">{e(item['unit'])}</td>
<td class="pricing-price">{price_cell(item, hourly=True)}</td>{note_cell}</tr>'''


def category_tables(items, kind):
    groups = defaultdict(list)
    for item in items:
        groups[item['category']].append(item)

    tables = []
    for index, (category, rows) in enumerate(groups.items(), 1):
        table_id = f'pricing-{kind}-{index}'
        services = kind == 'service'
        has_notes = any(row['notes'] for row in rows)
        if services:
            columns = '<th scope="col">作業内容</th><th scope="col">単位</th><th scope="col">料金（税抜）</th><th scope="col">備考</th>'
            body = ''.join(service_row(row) for row in rows)
            table_class = 'pricing-service-table'
        else:
            columns = '<th scope="col">フェーズ</th><th scope="col">単位</th><th scope="col">料金（税抜）</th>'
            if has_notes:
                columns += '<th scope="col">備考</th>'
            body = ''.join(engineer_row(row, has_notes) for row in rows)
            table_class = 'pricing-hourly-table' + (' has-notes' if has_notes else '')
        scroll_hint = f'<p class="pricing-scroll-hint" id="{table_id}-hint">表は横にスクロールできます。<span aria-hidden="true">↔</span></p>' if services else ''
        region = f' role="region" aria-labelledby="{table_id}" tabindex="0"' if services or has_notes else ''
        tables.append(f'''<details class="pricing-category" aria-labelledby="{table_id}">
<summary class="pricing-category-heading"><h3 id="{table_id}">{e(category)}</h3><span class="pricing-category-count">{len(rows):02d} <span>項目</span></span><span class="pricing-toggle" aria-hidden="true">+</span></summary>
{scroll_hint}<div class="pricing-table-scroll"{region}>
<table class="pricing-table {table_class}"><caption class="sr-only">{e(category)}の{'サービス単価' if services else '時間単価'}・税抜</caption><thead><tr>{columns}</tr></thead><tbody>{body}</tbody></table>
</div></details>''')
    return ''.join(tables)


def render_pricing(data):
    """Return page content; the parent builder supplies its h1 and contact tabs."""
    if data['currency'] != 'JPY' or data['taxIncluded'] is not False:
        raise ValueError('Pricing tables must be denominated in JPY, excluding tax.')
    services = category_tables(data['services'], 'service')
    engineers = category_tables(data['engineers'], 'hourly')
    advisory = ''.join(f'<article class="advisory-rate"><div><h3>{e(item["title"])}</h3><p>{e(item["summary"])}</p></div><div><strong>{"要相談" if item["priceYen"] is None else format(item["priceYen"], ",") + "円（税抜）"}</strong><span>{e(item["unit"])}</span></div></article>' for item in data.get('advisory', []))
    return f'''<div class="pricing-content wrap">
<section class="pricing-intro" aria-label="料金のご案内"><div><p class="pricing-lead">作業ごとの単価と、<br>エンジニアの時間単価をご案内します。</p><p class="pricing-unlisted">{e(data['unlistedMessage'])}</p></div><span class="pricing-tax-note">表示価格はすべて税抜です</span></section>
<nav class="pricing-section-nav" aria-label="料金表の種類"><a href="#service-pricing"><span><strong>サービス単価</strong><span>構築・設定など、作業単位ごとの料金</span></span><span aria-hidden="true">↓</span></a><a href="#hourly-pricing"><span><strong>エンジニア時間単価</strong><span>フェーズごとの1時間あたりの料金</span></span><span aria-hidden="true">↓</span></a><a href="#advisory-pricing"><span><strong>顧問単価</strong><span>顧問契約のご相談</span></span><span aria-hidden="true">↓</span></a></nav>
<section class="pricing-section" id="service-pricing" aria-labelledby="service-pricing-heading"><header class="pricing-section-heading"><span class="eyebrow">SERVICE PRICING</span><h2 id="service-pricing-heading">サービス単価</h2><span class="pricing-section-tax">すべて税抜</span></header>{services}</section>
<section class="pricing-section" id="hourly-pricing" aria-labelledby="hourly-pricing-heading"><header class="pricing-section-heading"><span class="eyebrow">HOURLY RATES</span><h2 id="hourly-pricing-heading">エンジニア時間単価</h2><span class="pricing-section-tax">すべて税抜</span></header><div class="pricing-hourly-grid">{engineers}</div></section>
<section class="pricing-section" id="advisory-pricing"><header class="pricing-section-heading"><span class="eyebrow">ADVISORY</span><h2>顧問単価</h2></header>{advisory}</section>
<section class="pricing-consultation" aria-labelledby="pricing-consultation-heading"><div><h2 id="pricing-consultation-heading">お仕事のご相談</h2><p>{e(data['unlistedMessage'])}</p></div><a class="pill-link" href="contact.html#contact-form">相談する <span aria-hidden="true">↗</span></a></section>
</div>'''
