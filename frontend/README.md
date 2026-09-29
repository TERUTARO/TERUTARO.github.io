# Frontend

Next.js App Router / TypeScript のサイト本体です。設定は `next.config.ts`、依存関係は `package.json` と `package-lock.json` にまとめています。

## 更新先

| 対象 | ファイル |
| --- | --- |
| ページ・メタデータの入口 | `src/app/` |
| 既存HTMLを表示する移行用コンポーネント | `src/components/portfolio-page.tsx` |
| 名前・SNS | `content/profile.json` |
| 実績・職歴 | `content/career.json` |
| 本文・共通メニュー・フッター・スキル | `scripts/build.py` |
| 実績一覧・タグ・年区切り | `scripts/work_history.py` |
| デザイン・メニュー・フォーム確認 | `public/assets/style.css` / `main.js` |
| 実績検索 | `public/assets/work-history.css` / `work-history.js` |
| 水面の演出 | `public/assets/water.css` / `water.js` |
| 画像・サイト縮小表示 | `public/assets/` / `content/site-previews.json` |

## 開発・ビルド

```sh
npm ci
npm run dev
```

`predev` / `prebuild` がPython生成器を実行し、`.generated/pages.json` を作成します。生成器や `content/` を変更した場合は `npm run prepare:content` を再実行し、ブラウザを再読み込みしてください。`.generated/` を直接編集しないでください。

```sh
npm run build
npm run typecheck
npm run preview
```

Next.jsの `output: "export"` で `out/` に書き出します。`postbuild` は `archive/technical-notes/` の内容を既存URLと同じ階層へコピーします。ファイルが衝突した場合はビルドを失敗させます。旧資料のプレビューは `npm run preview` で確認します。

## 段階的な移行

今回はディレクトリ整理が中心のため、既存のHTML生成器をビルド時に使用します。Next.jsのServer Componentはリポジトリ内で生成した本文だけを読み込み、CSSとページ別JavaScriptを組み合わせて表示します。外部入力のHTMLを読み込む仕組みではありません。

旧JavaScriptはページ全体を初期化するため、ナビゲーションは通常の `<a>` を維持しています。今後 `next/link` を導入する場合は、先にメニュー・タブ・検索・水面演出をReactコンポーネントへ移し、イベントやアニメーションの後始末を実装してください。

実績の「経歴」はHTMLコメントのまま保持しています。お問い合わせは確認画面のみです。将来の送信処理は `../infrastructure/lambda/contact/` に実装し、APIの接続先が決まってからフロント側へ追加します。

[Next.jsの静的エクスポート](https://nextjs.org/docs/app/guides/static-exports)を使用し、サーバー処理はLambda側へ分離する方針です。
