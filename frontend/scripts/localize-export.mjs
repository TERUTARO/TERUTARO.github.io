// The shared root layout has Japanese as its default. Give each standalone
// exported document its own language before it is served, including without JS.
import { readFile, writeFile } from 'node:fs/promises';
for (const [locale, language] of [['en', 'en'], ['zh', 'zh-CN']]) {
  for (const page of ['index', 'works', 'partners', 'events', 'columns', 'contact', 'pricing']) {
    const path = `out/${locale}/${page}.html`;
    const html = await readFile(path, 'utf8');
    if (!html.includes('<html lang="ja"')) throw new Error(`Missing root language: ${path}`);
    await writeFile(path, html.replace('<html lang="ja"', `<html lang="${language}"`));
  }
}
console.log('Set document languages for 14 translated pages.');
