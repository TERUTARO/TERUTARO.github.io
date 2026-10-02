"""Regression checks for the public site's Japanese, English and Chinese pages."""
import unittest
from html.parser import HTMLParser

from build import shell
from localization import Translator, read_catalogs, translate_html


class Document(HTMLParser):
    """Read the generated HTML as a browser would, without executing scripts."""

    def __init__(self, markup):
        super().__init__(convert_charrefs=True)
        self.elements = []
        self.text = []
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_data(self, data):
        self.text.append(data)

    def attributes(self, tag):
        return [attrs for name, attrs in self.elements if name == tag]


class LocalizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = read_catalogs()
        cls.translators = {
            locale: Translator(cls.catalog, locale) for locale in ('ja', 'en', 'zh')
        }

    def render(self, markup, locale):
        return translate_html(markup, self.translators[locale])

    def test_local_navigation_keeps_queries_fragments_and_external_urls(self):
        markup = '''<a href="works.html?source=home&amp;view=all#project-example">実績</a>
<a href="https://example.com/works.html?source=ja#about">外部</a>
<a href="#about">プロフィール</a><img src="assets/portrait.webp" alt="照屋 朝太郎のプロフィール写真">'''
        for locale, prefix in [('ja', ''), ('en', '/en'), ('zh', '/zh')]:
            with self.subTest(locale=locale):
                doc = Document(self.render(markup, locale))
                self.assertEqual([a['href'] for a in doc.attributes('a')], [
                    f'{prefix}/works.html?source=home&view=all#project-example',
                    'https://example.com/works.html?source=ja#about',
                    '#about',
                ])
                self.assertEqual(doc.attributes('img')[0]['src'], '/assets/portrait.webp')
                if locale != 'ja':
                    self.assertNotIn('プロフィール写真', doc.attributes('img')[0]['alt'])

    def test_form_submission_values_and_data_attributes_stay_in_japanese(self):
        markup = '''<section data-tags='["設計", "構築"]' data-filter-label="現在進行中">
<label for="type">ご相談の種類</label><select id="type" name="type">
<option value="インフラ構築・運用保守">インフラ構築・運用保守</option>
</select><input name="name" value="照屋 朝太郎" placeholder="山田 太郎"></section>'''
        expected_labels = {
            'en': 'Infrastructure implementation, operations and maintenance',
            'zh': '基础设施搭建与运维',
        }
        for locale, label in expected_labels.items():
            with self.subTest(locale=locale):
                doc = Document(self.render(markup, locale))
                self.assertIn(label, doc.text)
                self.assertEqual(doc.attributes('option')[0]['value'], 'インフラ構築・運用保守')
                self.assertEqual(doc.attributes('section')[0]['data-tags'], '["設計", "構築"]')
                self.assertEqual(doc.attributes('section')[0]['data-filter-label'], '現在進行中')
                self.assertEqual(doc.attributes('input')[0]['value'], '照屋 朝太郎')
                self.assertNotEqual(doc.attributes('input')[0]['placeholder'], '山田 太郎')

    def test_user_confirmation_content_and_raw_script_are_preserved(self):
        script = '<script>const label = "お問い合わせ"; const result = 1 < 2 && 3 > 2;</script>'
        style = '<style>.example::after { content: "お問い合わせ < & >"; }</style>'
        markup = script + style + '''<dd data-no-translate><span title="お問い合わせ">お問い合わせ</span>
<textarea>照屋 朝太郎</textarea>&lt;b&gt;実績&lt;/b&gt;</dd><p>お問い合わせ</p>'''
        for locale, contact in [('en', 'Contact'), ('zh', '联系我')]:
            with self.subTest(locale=locale):
                rendered = self.render(markup, locale)
                self.assertIn(script, rendered)
                self.assertIn(style, rendered)
                self.assertIn('<span title="お問い合わせ">お問い合わせ</span>', rendered)
                self.assertIn('<textarea>照屋 朝太郎</textarea>', rendered)
                self.assertIn('&lt;b&gt;実績&lt;/b&gt;', rendered)
                self.assertIn(f'<p>{contact}</p>', rendered)

    def test_text_and_attribute_escaping_do_not_create_html_elements(self):
        markup = '''<p>&lt;img src=x onerror=alert(1)&gt; &amp; &lt;script&gt;実績&lt;/script&gt;</p>
<input title="&quot; onfocus=&quot;alert(1)" placeholder="山田 太郎">'''
        for locale in ('en', 'zh'):
            with self.subTest(locale=locale):
                rendered = self.render(markup, locale)
                doc = Document(rendered)
                self.assertEqual([tag for tag, _ in doc.elements], ['p', 'input'])
                self.assertIn('<img src=x onerror=alert(1)>', ''.join(doc.text))
                self.assertEqual(doc.attributes('input')[0]['title'], '" onfocus="alert(1)')
                self.assertNotIn('onfocus', doc.attributes('input')[0])
                self.assertIn('&lt;img', rendered)
                self.assertIn('&quot;', rendered)

    def test_profile_count_and_nested_price_templates_are_localized(self):
        examples = [
            ('"照屋 朝太郎"', '"Asataro Teruya"', '"照屋 朝太郎"'),
            ('"オンプレミスインフラ"', '"On-premises infrastructure"', '"本地基础设施"'),
            ('現在進行中、3件', 'Ongoing, 3 projects', '进行中，3 个项目'),
            ('ミドルウェアのサービス単価・税抜', 'Middleware service rates, excluding tax', '中间件服务价格（不含税）'),
            ('ネットワークエンジニアの時間単価・税抜', 'Network Engineer hourly rates, excluding tax', '网络工程师小时费率（不含税）'),
            ('備考：チェーン追加含む', 'Notes: Includes adding the certificate chain', '备注：包含证书链添加'),
        ]
        for source, english, chinese in examples:
            for locale, expected in [('en', english), ('zh', chinese)]:
                with self.subTest(source=source, locale=locale):
                    self.assertEqual(self.translators[locale].text(source), expected)
        self.assertEqual(self.translators['en'].text('年'), '')
        self.assertEqual(self.translators['zh'].text('年'), '年')

    def test_every_translated_page_retains_navigation_and_three_language_targets(self):
        pages = ('index', 'works', 'partners', 'events', 'columns', 'contact', 'pricing')
        nav_pages = ('index', 'works', 'partners', 'events', 'columns', 'contact')
        for locale in ('en', 'zh'):
            for page in pages:
                with self.subTest(locale=locale, page=page):
                    doc = Document(self.render(shell(f'{page}.html', '<p>実績</p>', locale), locale))
                    anchors = doc.attributes('a')
                    regular = [a for a in anchors if 'data-locale-link' not in a]
                    self.assertTrue({f'/{locale}/{name}.html' for name in nav_pages}.issubset({a['href'] for a in regular}))
                    for selected in ('ja', 'en', 'zh'):
                        targets = [a for a in anchors if a.get('data-locale-link') == selected]
                        self.assertEqual(len(targets), 2)  # Header and expanded menu.
                        prefix = '' if selected == 'ja' else '/' + selected
                        self.assertTrue(all(a['href'] == f'{prefix}/{page}.html' for a in targets))
                        self.assertTrue(all(('aria-current' in a) == (selected == locale) for a in targets))
                    self.assertFalse(any(a['href'].startswith('/works.html') for a in regular))

    def test_repeated_translation_is_stable_for_live_dom_updates(self):
        # The browser observer may see its own changes; a second pass must settle.
        for locale in ('en', 'zh'):
            translator = self.translators[locale]
            for source in self.catalog:
                with self.subTest(locale=locale, source=source):
                    translated = translator.text(source)
                    self.assertEqual(translator.text(translated), translated)
            self.assertEqual(translator.text('unknown custom text'), 'unknown custom text')
            self.assertEqual(translator.text('constructor'), 'constructor')


if __name__ == '__main__':
    unittest.main()
