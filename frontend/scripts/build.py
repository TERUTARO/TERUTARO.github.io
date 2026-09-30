#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepare the existing portfolio markup for the Next.js entry points."""
from pathlib import Path
from html import escape
import json
import math
import hashlib
from work_history import render_work_history
from pricing import contact_tabs, render_pricing

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
OUTPUT = ROOT / '.generated'
PROFILE = json.loads((ROOT / 'content' / 'profile.json').read_text())

def e(value):
    return escape(str(value), quote=True)

def asset_url(path):
    revision = hashlib.sha256((PUBLIC / path).read_bytes()).hexdigest()[:12]
    return f'/{path}?v={revision}'

def arrow(direction='up'):
    path = 'M5 19 19 5M5 5h14v14' if direction == 'up' else 'M4 12h16m-6-6 6 6-6 6'
    return f'<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="{path}"/></svg>'

def skill_icon(key):
    shapes = {
        'cloud': '<path d="M7 17H6a4 4 0 0 1-.7-7.9 6.5 6.5 0 0 1 12.5-.5A4.3 4.3 0 0 1 18 17h-1M9 17h6M12 14v6"/>',
        'development': '<path d="m7 6-5 6 5 6m10-12 5 6-5 6m-3-14-4 20"/>',
        'ai': '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/><circle cx="12" cy="12" r="2.5"/>',
        'devops': '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5m-7 5v-5h14v5"/>',
    }
    return f'<svg class="skill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{shapes[key]}</svg>'

def chat_icon():
    return '<svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 14.5a3 3 0 0 1-3 3H9l-5 3v-5a3 3 0 0 1-1-2.2V6.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z"/><path d="M7.5 8.5h8m-8 4h5"/></svg>'

def social_icon(label):
    shapes = {
        'Instagram': '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
        'X': '<path d="M4 3h5l11 18h-5L4 3Zm16 0L4 21"/>',
        'Facebook': '<path d="M14 22V13h3l.5-4H14V6.5c0-1 .5-1.5 1.5-1.5H18V1h-3.5C11 1 9 3 9 6.5V9H6v4h3v9"/>',
    }
    return f'<svg class="social-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{shapes.get(label, "")}</svg>'


def link(url, label, cls='text-link'):
    return f'<a class="{cls}" href="{e(url)}" target="_blank" rel="noopener noreferrer">{label}{arrow()}</a>'

def tags(items):
    return '<div class="tags">' + ''.join(f'<span>{e(t)}</span>' for t in items) + '</div>'

def social_links():
    links = ''.join(f'<a href="{e(item["url"])}" target="_blank" rel="me noopener noreferrer" aria-label="{e(item["label"])} {e(item["handle"])}（新しいタブ）">{social_icon(item["label"])}<span>{e(item["label"])}</span>{arrow()}</a>' for item in PROFILE['socials'] if item['url'])
    return f'<nav class="social-links" aria-label="SNS">{links}</nav>'

def section_label(n, title):
    return ''

def page_head(index, title, ja, desc):
    heading_class = ' long-title' if len(ja) > 10 else ''
    return f'<section class="page-heading wrap"><h1 class="{heading_class.strip()}">{e(ja)}</h1></section>'

NAV = [('index.html', 'About', 'トップ'), ('works.html', 'Works', '実績'), ('partners.html', 'Partners', '継続のお取引'), ('events.html', 'Events', 'イベント'), ('contact.html', 'Contact', 'お問い合わせ')]

def shell(filename, body):
    nav = ''.join(f'<a href="{url}" {current_attr(filename, url)}><span class="menu-link-en">{name}</span><span class="menu-link-ja">{ja}</span>{arrow("right")}</a>' for url, name, ja in NAV)
    rail = ''.join(f'<a href="{url}" {current_attr(filename, url)}>{ja}</a>' for url, name, ja in NAV)
    return f'''<a class="skip-link" href="#main">本文へスキップ</a>
<header class="site-header wrap"><a class="brand" href="index.html" aria-label="terutaro トップページ"><span>terutaro</span></a><button class="menu-trigger" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="site-menu" hidden><span class="menu-lines" aria-hidden="true"></span><span class="menu-trigger-text">Menu</span></button><nav class="rail-nav" aria-label="メインナビゲーション">{rail}</nav></header>
<dialog id="site-menu" class="menu-panel" aria-label="メニュー"><div class="menu-panel-top"><a class="brand" href="index.html">terutaro</a><button class="menu-close" type="button" aria-label="メニューを閉じる" autofocus><span aria-hidden="true"></span></button></div><div class="menu-panel-body"><div class="menu-profile"><span class="profile-avatar"><img src="assets/portrait.png" alt="{e(PROFILE["name"])}のプロフィール写真" width="1254" height="1254" decoding="async"></span><p>{e(PROFILE["name"])}<span>terutaro</span></p>{social_links()}</div><nav id="main-nav" class="menu-links" aria-label="ページ一覧">{nav}</nav></div></dialog>
<noscript><nav class="fallback-nav wrap" aria-label="ページ一覧">{rail}</nav></noscript>
<main id="main">{body}</main>
<footer class="site-footer wrap"><div class="footer-top"><a class="brand" href="index.html"><span>terutaro</span></a>{social_links()}<a class="back-top" href="#" aria-label="ページの先頭へ">Back to top <span>↑</span></a></div><div class="footer-bottom"><span>© <span data-year>2026</span> terutaro</span><span>Independent engineer · Okinawa / Kanto, Japan</span></div></footer>'''

def contact_banner():
    return f'''<section class="contact-banner wrap"><h2>お問い合わせ</h2><a href="contact.html#contact-form" class="contact-action" aria-label="相談：お問い合わせフォームへ">{chat_icon()}<span>相談</span></a></section>'''

def current_attr(filename, url):
    if filename == 'pricing.html' and url == 'contact.html':
        return 'aria-current="true"'
    return 'aria-current="page"' if filename == url else ''

def generate_art():
    """An original projected toroidal surface, built as vectors."""
    paths = []
    def point(u, v):
        radius = 142 + 13 * math.sin(3 * u)
        tube = 56 + 11 * math.cos(3 * u)
        x = (radius + tube * math.cos(v)) * math.cos(u)
        y = (radius + tube * math.cos(v)) * math.sin(u)
        z = tube * math.sin(v) + 30 * math.sin(2 * u)
        # Tilt the loop into an upright organic sculpture.
        a = -0.72
        y, z = y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a)
        b = -0.38
        x, y = x * math.cos(b) - y * math.sin(b), x * math.sin(b) + y * math.cos(b)
        return 300 + x * 1.16, 286 + y * 1.30, z
    for i in range(96):
        u = i * math.tau / 96
        pts = [point(u, j * math.tau / 100) for j in range(101)]
        d = 'M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y, z in pts)
        paths.append(f'<path d="{d}" stroke="#526247" stroke-opacity=".51" stroke-width=".75"/>')
    for i in range(18):
        v = i * math.tau / 18
        pts = [point(j * math.tau / 180, v) for j in range(181)]
        d = 'M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y, z in pts)
        paths.append(f'<path d="{d}" stroke="#748065" stroke-opacity=".25" stroke-width=".65"/>')
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 570" fill="none">' + ''.join(paths) + '</svg>'
    (PUBLIC / 'assets' / 'continuity.svg').write_text(svg)

SKILL_DATA = json.loads((ROOT / 'content' / 'skills.json').read_text())
PARTNER_DATA = json.loads((ROOT / 'content' / 'partners.json').read_text())


SITE_INFO = {
    'riams': ('https://www.riams.co.jp/', 'リアムス株式会社', 'riams.co.jp'),
    'asset-compass': ('https://asset-compass.jp/', 'Asset Compass', 'asset-compass.jp'),
    'harahachi': ('https://harahachi.co.jp/', '合同会社ハラハチ', 'harahachi.co.jp'),
    'hinode': ('https://hinode-hd.com/', '日乃出工業株式会社', 'hinode-hd.com'),
    'tidal-waive': ('https://tidal-waive.com/', 'TIDAL WAIVE', 'tidal-waive.com'),
}
PREVIEW_PATH = ROOT / 'content' / 'site-previews.json'
PREVIEWS = json.loads(PREVIEW_PATH.read_text()) if PREVIEW_PATH.exists() else {}

def site_image(key, title):
    item = PREVIEWS.get(key, {})
    path = item.get('image', '')
    if item.get('available') and path and (PUBLIC / path).is_file():
        return f'<img src="{e(path)}" alt="{e(title)}のWebサイト" width="960" height="600" loading="lazy" decoding="async">'
    return f'<span class="site-preview-fallback"><span>{e(title)}</span><span>Webサイトを開く {arrow()}</span></span>'

def site_preview(key, show_title=True):
    url, title, domain = SITE_INFO[key]
    caption = f'<span class="site-preview-title">{e(title)}{arrow()}</span>' if show_title else ''
    return f'''<a class="site-preview" href="{e(url)}" target="_blank" rel="noopener noreferrer" aria-label="{e(title)}のWebサイトを開く（新しいタブ）"><span class="site-preview-screen">{site_image(key, title)}</span>{caption}</a>'''

def skills():
    rows = sorted((r for r in SKILL_DATA if r.get('published', True)), key=lambda r: r.get('order', 0))
    tabs = ''.join(f'<button id="tab-{e(row["id"])}" role="tab" aria-selected="{str(i == 0).lower()}" aria-controls="panel-{e(row["id"])}" tabindex="{0 if i == 0 else -1}">{skill_icon(row["icon"])}<span>{e(row["label"])}</span><span class="tab-arrow">↗</span></button>' for i, row in enumerate(rows))
    panels = ''
    for i, row in enumerate(rows):
        groups = ''.join(f'<div class="skill-row"><h4>{e(group["name"])}</h4>{tags(group["items"])}</div>' for group in row['groups'])
        panels += f'<div class="skill-panel" id="panel-{e(row["id"])}" role="tabpanel" aria-labelledby="tab-{e(row["id"])}" tabindex="0" {"hidden" if i else ""}><div class="skill-intro"><span class="skill-symbol">{skill_icon(row["icon"])}</span><h3>{e(row["heading"])}</h3></div><div class="skill-details">{groups}</div></div>'
    return f'<section class="skills-section wrap" id="skills"><div class="section-title"><h2>スキル</h2></div><div class="skill-tabs" role="tablist" aria-label="スキルの分類">{tabs}</div>{panels}</section>'


def partner_preview(site):
    title, url = site['label'], site['url']
    return f'<a class="site-preview" href="{e(url)}" target="_blank" rel="noopener noreferrer" aria-label="{e(title)}のWebサイトを開く（新しいタブ）"><span class="site-preview-screen">{site_image(site.get("previewKey", ""), title)}</span><span class="site-preview-title">{e(title)}{arrow()}</span></a>'


def profile_resource():
    def string(value):
        return f'<span class="hcl-string">{e(json.dumps(value, ensure_ascii=False))}</span>'

    def field(key, value, indent=2):
        return ' ' * indent + f'<span class="hcl-key">{key.ljust(10)}</span> = {value}'

    lines = [
        f'<span class="hcl-keyword">resource</span> {string("profile")} {string("terutaro")} {{',
        field('name', string(PROFILE['name'])),
        field('base', f'[{string("沖縄")}, {string("関東")}]'),
        field('work_style', string('フリーランス')),
        field('since', string('2019-04')),
        field('strength', string('インフラ')),
        '',
        '  <span class="hcl-key">skills</span> = [',
        f'    {string("インフラ構築・運用保守")},',
        f'    {string("Web開発")},',
        f'    {string("AI基盤")},',
        '  ]',
        '',
        '  <span class="hcl-keyword">community</span> {',
        field('name', string('TIDAL WAIVE'), 4),
        field('role', string('主催'), 4),
        '  }',
        '}',
    ]
    code = '\n'.join(lines)
    return f'<div class="profile-resource"><div class="profile-resource-header"><span>profile.details.at</span><span aria-hidden="true">{{ }}</span></div><pre aria-label="Terraformリソース風のプロフィール"><code>{code}</code></pre></div>'


def home(data):
    company_previews = ''.join(partner_preview(row['sites'][0]) for row in PARTNER_DATA if row.get('published', True) and row['sites'])
    return f'''
<section class="hero wrap water-surface" data-water-surface><div data-water-content>
  <div class="hero-topline"><span class="eyebrow">FREELANCE ENGINEER</span><span class="location"><span class="small-dot"></span> OKINAWA / KANTO, JAPAN <span class="mono" data-clock></span></span></div>
  <div class="hero-grid">
    <div class="hero-copy"><h1>terutaro</h1><div class="hero-name"><span class="portrait-note"><button type="button" class="portrait-trigger" aria-label="{e(PROFILE["name"])}のプロフィール写真" aria-describedby="portrait-tooltip"><span class="profile-avatar"><img src="assets/portrait.png" alt="" width="1254" height="1254" fetchpriority="high"></span></button><span class="portrait-tooltip" id="portrait-tooltip" role="tooltip">今はアフロだよ</span></span><span>{e(PROFILE["name"])}</span></div><p>沖縄・関東を拠点に活動するフリーランスエンジニア。<br>インフラ構築・運用保守、Web開発、AI基盤などできます</p><p class="hero-strength">インフラが得意</p><a class="pill-link" href="works.html">実績を見る {arrow('right')}</a></div>
    <div class="hero-art" aria-hidden="true"><span class="art-corner top-left">+</span><span class="art-corner top-right">+</span><div class="art-orbit"></div><img src="assets/continuity.svg" alt="" width="600" height="570" fetchpriority="high"><span class="art-corner bottom-left">+</span><span class="art-corner bottom-right">+</span></div>
  </div>
  <div class="hero-bottom"><a href="#about">プロフィール <span>↓</span></a></div>
</div></section>
<section class="about-section wrap" id="about"><div class="about-grid"><div class="about-title"><h2>プロフィール</h2><div class="profile-name">{e(PROFILE["name"])} <span>terutaro</span></div>{social_links()}</div>{profile_resource()}</div></section>
{skills()}
<section class="selected-section wrap"><div class="section-title"><h2>実績</h2><a class="text-link" href="works.html">すべての実績 {arrow()}</a></div><div class="selected-grid">
<a class="project-feature" href="works.html#project-affiliate-platform-operations"><div class="project-card-top"><span class="project-number">01</span><span class="project-category">INFRASTRUCTURE</span><span class="project-active"><i></i>進行中</span></div><div class="project-card-body"><p class="project-client">B社 D</p><h3>大手アフィリエイトサイト<br>基盤運用保守</h3></div><div class="project-card-bottom"><span class="mono">2025.09 — 現在</span><span class="project-card-action">実績を見る {arrow('right')}</span></div></a>
<a class="project-feature" href="works.html#project-internal-ai-platform-operations"><div class="project-card-top"><span class="project-number">02</span><span class="project-category">AI PLATFORM</span><span class="project-active"><i></i>進行中</span></div><div class="project-card-body"><p class="project-client">E社 K</p><h3>大手商品価格比較サイト<br>社内AI基盤運用保守</h3></div><div class="project-card-bottom"><span class="mono">2025.09 — 現在</span><span class="project-card-action">実績を見る {arrow('right')}</span></div></a>
</div></section>
<section class="partner-showcase wrap"><div class="section-title"><h2>長期でお世話になっている企業様</h2><a class="text-link" href="partners.html">お取引について {arrow()}</a></div><div class="company-previews">{company_previews}</div></section>
<section class="community-showcase wrap"><div class="section-title"><h2>イベント</h2><a class="text-link" href="events.html">イベント一覧 {arrow()}</a></div><div class="community-preview-grid">{site_preview('tidal-waive', False)}<div class="community-details"><h3>TIDAL WAIVE</h3><p>{e(PROFILE["name"])}が主催するコミュニティ。</p>{link('https://tidal-waive.com/', '公式サイト')}</div></div></section>
{contact_banner()}'''

def works(data):
    career = ''.join(f'<div class="career-item"><span class="mono">{e(item["year"])}</span><div><h3>{e(item["title"])}</h3><p>{e(item["description"])}</p></div></div>' for item in data['career'])
    return page_head('01', 'Works', '実績', '') + render_work_history(data) + f'''<!--
<section class="career-section wrap">{section_label('02', 'The journey')}<div class="career-grid"><div><h2>経歴</h2></div><div class="career-list">{career}</div></div></section>
-->
<section class="personal-section wrap">{section_label('03', 'Personal projects')}<div class="section-title"><h2>個人活動</h2></div><div class="personal-grid"><article><span class="mono">COMMUNITY</span><h3>TIDAL WAIVE</h3><p>{e(PROFILE["name"])}が主催するコミュニティ。</p>{link('https://tidal-waive.com/', 'コミュニティサイト')}</article><article><span class="mono">PERSONAL PROJECT</span><h3>ぷろんぷとん</h3>{link('https://prompton.site/', 'サイトを見る')}</article><article><span class="mono">PERSONAL PROJECT</span><h3>tideline</h3><span class="paused">現在保守停止中</span></article></div></section>{contact_banner()}'''

def partners():
    body = ''
    for row in sorted(PARTNER_DATA, key=lambda r: r.get('order', 0)):
        if not row.get('published', True):
            continue
        gallery = ''.join(partner_preview(site) for site in row['sites'])
        body += f'<article class="partner-row"><div class="partner-gallery">{gallery}</div><div class="partner-description"><h2>{e(row["name"])}</h2><p>{e(row["summary"])}</p>{tags(row["tags"])}</div></article>'
    return page_head('02', 'Partners', '長期でお世話になっている企業様', '') + f'<section class="partners-list wrap">{body}</section>{contact_banner()}'


def events():
    event_rows = ''
    for i, eid in enumerate(['153907', '150116', '142247', '139485']):
        key = f'connpass-{eid}'
        item = PREVIEWS.get(key, {})
        image_html = f'<span class="event-thumbnail">{site_image(key, "connpass イベント " + eid)}</span>' if item.get('available') else ''
        title = item.get('title', f'イベント #{eid}').removesuffix(' - connpass')
        preview_class = 'has-preview' if image_html else ''
        event_rows += f'<a class="event-row {preview_class}" href="https://connpass.com/event/{eid}/" target="_blank" rel="noopener noreferrer">{image_html}<span class="mono event-index">{i+1:02d}</span><div><span class="event-id">connpass / #{eid}</span><h3>{e(title)}</h3></div><span class="event-action">イベントを見る {arrow()}</span></a>'
    return page_head('03', 'Events', 'イベント', '') + f'''<section class="event-feature wrap">{site_preview('tidal-waive', False)}<div class="event-feature-copy"><h2>TIDAL WAIVE</h2><p>{e(PROFILE["name"])}が主催するコミュニティ。</p>{link('https://tidal-waive.com/', '公式サイト', 'pill-link')}</div></section><section class="event-archive wrap"><div class="section-title"><h2>Conpass</h2></div>{event_rows}</section>{contact_banner()}'''

def contact():
    return page_head('04', 'Contact', 'お問い合わせ', '') + contact_tabs('contact') + '''<section class="contact-layout wrap"><div class="contact-aside"><h2>相談</h2><div class="contact-services"><span>01 / インフラ構築・運用保守</span><span>02 / Webシステム開発</span><span>03 / AI基盤・開発支援</span><span>04 / その他のご相談</span></div><div class="preview-note"><span class="small-dot"></span><div><strong>お仕事のご相談を受け付けています。</strong><p>担当内容やご希望の時期などをお知らせください。</p></div></div></div><div class="contact-form-area"><form id="contact-form"><div class="contact-honeypot" aria-hidden="true"><label for="website">この欄は入力しないでください</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div><div class="form-row"><label for="name">お名前 <span>必須</span></label><input id="name" name="name" autocomplete="name" required maxlength="100" placeholder="山田 太郎"></div><div class="form-row"><label for="company">会社名 / 屋号 <span class="optional">任意</span></label><input id="company" name="company" autocomplete="organization" maxlength="150" placeholder="株式会社〇〇"></div><div class="form-row"><label for="email">メールアドレス <span>必須</span></label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="hello@example.com"></div><div class="form-row"><label for="type">ご相談の種類 <span>必須</span></label><select id="type" name="type" required><option value="">選択してください</option><option>インフラ構築・運用保守</option><option>Webシステム開発</option><option>AI基盤・開発支援</option><option>その他のご相談</option></select></div><div class="form-row"><label for="message">ご相談内容 <span>必須</span></label><textarea id="message" name="message" required minlength="10" maxlength="3000" rows="6" placeholder="ご相談の背景や実現したいこと、ご希望の時期などをお聞かせください。（10文字以上）"></textarea><div class="field-counter"><span>10〜3,000文字</span><span><span id="message-count">0</span> / 3,000</span></div></div><p class="form-note">入力内容はお問い合わせへの対応のために使用します。</p><noscript><p class="form-note">確認画面を表示するにはJavaScriptを有効にしてください。入力内容は送信されません。</p></noscript><button class="submit-button" id="review-contact" type="button">入力内容を確認する <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button></form><section class="contact-confirmation" id="contact-confirmation" hidden aria-labelledby="confirmation-title"><h2 id="confirmation-title" tabindex="-1">ご相談内容の確認</h2><p>内容をご確認のうえ、送信ボタンを押してください。</p><dl id="confirmation-values"></dl><button class="submit-button" type="button" id="edit-form">入力内容を修正する <span>←</span></button><p id="contact-send-error" class="form-note" role="alert" hidden></p><button class="submit-button" id="send-contact" type="button">この内容で送信する <span>↗</span></button></section><section id="contact-success" class="contact-confirmation" hidden><h2 id="contact-success-title" tabindex="-1">お問い合わせを受け付けました</h2><p>内容を確認のうえ、ご連絡します。</p><p class="form-note">受付番号：<span id="contact-receipt"></span></p></section></div></section>'''

def pricing():
    data = json.loads((ROOT / 'content' / 'pricing.json').read_text())
    return page_head('05', 'Pricing', '料金の目安', '') + contact_tabs('pricing') + render_pricing(data)


def main():
    data_path = ROOT / 'content' / 'career.json'
    data = json.loads(data_path.read_text())
    generate_art()
    pages = [
        ('index.html', f'{PROFILE["name"]} | 沖縄・関東のフリーランスエンジニア', f'沖縄・関東を拠点に活動する{PROFILE["name"]}のポートフォリオ。インフラ・Web開発・AI基盤の構築から運用保守まで。', home(data)),
        ('works.html', '実績', f'インフラ構築、Web開発、ネットワーク、AI基盤。{PROFILE["name"]}の実績をご紹介します。', works(data)),
        ('partners.html', '長期でお世話になっている企業様', 'リアムス株式会社、合同会社ハラハチ、日乃出工業株式会社との取り組み。', partners()),
        ('events.html', 'イベント・コミュニティ', f'{PROFILE["name"]}主催のTIDAL WAIVEと、これまでのConpassイベント。', events()),
        ('contact.html', 'お問い合わせ', 'インフラ、Web開発、AI基盤に関するお仕事のご相談。', contact()),
        ('pricing.html', '料金の目安', 'インフラ構築・設定などのサービス単価とエンジニアの時間単価。記載のない内容は都度お見積もりします。', pricing()),
    ]
    generated = {}
    for filename, title, description, body in pages:
        scripts = [asset_url('assets/main.js'), asset_url('assets/content.js')]
        if filename == 'index.html':
            scripts.append(asset_url('assets/water.js'))
        if filename == 'works.html':
            scripts.append(asset_url('assets/work-history.js'))
        generated[filename.removesuffix('.html')] = {
            'title': title,
            'description': description,
            'body': shell(filename, body),
            'scripts': scripts,
        }
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / 'pages.json').write_text(json.dumps(generated, ensure_ascii=False, indent=2) + '\n')
    print(f'Prepared {len(generated)} pages for Next.js')

if __name__ == '__main__':
    main()
