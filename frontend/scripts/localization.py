"""Shared source-text catalogs for static pages and CMS-rendered content."""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ('ja', 'en', 'zh')
LANGS = {'ja': 'ja', 'en': 'en', 'zh': 'zh-CN'}
PAGE_NAMES = ('index', 'works', 'partners', 'events', 'columns', 'contact', 'pricing')
ATTRIBUTES = {'aria-label', 'alt', 'title', 'placeholder'}


def read_catalogs():
    catalog = {}
    for path in sorted((ROOT / 'content' / 'i18n').glob('*.json')):
        for source, translations in json.loads(path.read_text()).items():
            catalog.setdefault(source, {}).update(translations)
    return catalog


def page_url(name, locale):
    return f'/{"" if locale == "ja" else locale + "/"}{name}.html'


def local_url(value, locale):
    # Public pages share one asset root; archived notes and external links stay put.
    if value.startswith('assets/'):
        return '/' + value
    match = re.fullmatch(r'/?(index|works|partners|events|columns|contact|pricing)\.html([?#].*)?', value)
    return page_url(match[1], locale) + (match[2] or '') if match else value


class Translator:
    def __init__(self, catalog, locale):
        self.locale = locale
        self.entries = {key.strip(): value[locale] for key, value in catalog.items() if locale in value}
        self.templates = []
        for source, target in self.entries.items():
            names = re.findall(r'\{(\w+)\}', source)
            if names:
                parts = re.split(r'\{\w+\}', source)
                pattern = '(.*?)'.join(re.escape(part) for part in parts)
                self.templates.append((re.compile('^' + pattern + '$', re.S), names, target))

    def text(self, value, depth=0):
        if self.locale == 'ja' or not value.strip() or depth > 4:
            return value
        core = value.strip()
        translated = self.entries.get(core)
        if translated is None and core.startswith('"') and core.endswith('"'):
            translated = '"' + self.text(core[1:-1], depth + 1) + '"'
        if translated is None:
            for pattern, names, target in self.templates:
                match = pattern.fullmatch(core)
                if match:
                    translated = target
                    for name, part in zip(names, match.groups()):
                        translated = translated.replace('{' + name + '}', self.text(part, depth + 1))
                    break
        if translated is None:
            return value
        return value[:len(value) - len(value.lstrip())] + translated + value[len(value.rstrip()):]


class LocalizedHTML(HTMLParser):
    def __init__(self, translator):
        super().__init__(convert_charrefs=True)
        self.translator = translator
        self.output = []
        self.stack = []

    def start(self, tag, attrs, closing='>'):
        attributes = dict(attrs)
        skip = bool(self.stack and self.stack[-1][1]) or 'data-no-translate' in attributes or tag in {'script', 'style'}
        rendered = []
        for name, value in attrs:
            if value is not None:
                if name in ATTRIBUTES and not skip:
                    value = self.translator.text(value)
                if name in {'src', 'srcset', 'href'} and 'data-locale-link' not in attributes:
                    value = local_url(value, self.translator.locale)
            rendered.append(name if value is None else f'{name}="{escape(value, quote=True)}"')
        self.output.append('<' + tag + (' ' + ' '.join(rendered) if rendered else '') + closing)
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'} and closing != '/>':
            self.stack.append((tag, skip))

    def handle_starttag(self, tag, attrs):
        self.start(tag, attrs)

    def handle_startendtag(self, tag, attrs):
        self.start(tag, attrs, '/>')

    def handle_endtag(self, tag):
        self.output.append(f'</{tag}>')
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_data(self, data):
        if self.stack and self.stack[-1][0] in {'script', 'style'}:
            self.output.append(data)
            return
        value = data if self.stack and self.stack[-1][1] else self.translator.text(data)
        self.output.append(escape(value, quote=False))

    def handle_comment(self, data):
        self.output.append('<!--' + data + '-->')


def translate_html(markup, translator):
    parser = LocalizedHTML(translator)
    parser.feed(markup)
    return ''.join(parser.output)


def language_switcher(page, locale):
    labels = {'ja': 'JP', 'en': 'EN', 'zh': '中文'}
    names = {'ja': '日本語', 'en': 'English', 'zh': '简体中文'}
    links = ''
    for code in LOCALES:
        current = ' aria-current="true"' if code == locale else ''
        links += f'<a href="{page_url(page, code)}" data-locale-link="{code}" lang="{LANGS[code]}" hreflang="{LANGS[code]}" aria-label="{names[code]}"{current}>{labels[code]}</a>'
    return f'<nav class="language-switcher" aria-label="Language" data-no-translate>{links}</nav>'


def write_browser_catalogs(catalog):
    destination = ROOT / 'public' / 'assets' / 'i18n'
    destination.mkdir(exist_ok=True)
    for locale in LOCALES:
        if locale == 'ja':
            continue
        entries = {key.strip(): value[locale] for key, value in catalog.items() if locale in value}
        payload = json.dumps(entries, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
        (destination / f'{locale}.js').write_text('window.portfolioCatalog=' + payload + ';\n')
