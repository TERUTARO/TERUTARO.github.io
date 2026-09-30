# Frontend

Next.js App Router / TypeScript の公開サイトと管理画面です。どちらも静的に出力し、公開サイトをGitHub Pages、管理画面をS3 + CloudFrontへ配信します。サーバー処理はAPI Gateway / Lambda / DynamoDB、管理者認証はCognitoが担当します。

## 更新先

| 対象 | ファイル |
| --- | --- |
| ページ・メタデータの入口 | `src/app/` |
| 既存HTMLを表示する移行用コンポーネント | `src/components/portfolio-page.tsx` |
| 名前・SNS | `content/profile.json` |
| 実績・職歴・担当フェーズ・分類スタックの初期データ | `content/career.json` |
| スキル・継続のお取引先の初期データ | `content/skills.json` / `content/partners.json` |
| サービス単価・時間単価・顧問単価の初期データ | `content/pricing.json` |
| 料金ページ・お問い合わせのタブ | `scripts/pricing.py` / `public/assets/pricing.css` |
| スナップショットの本文・共通メニュー・フッター | `scripts/build.py` |
| 実績一覧・タグ・年区切り | `scripts/work_history.py` |
| デザイン・メニュー・お問い合わせ確認と送信 | `public/assets/style.css` / `main.js` |
| 公開API取得・実績/スキル/取引先/料金の更新 | `public/assets/content.js` |
| メニュー開閉の演出 | `public/assets/menu.css` / `main.js` |
| 実績検索 | `public/assets/work-history.css` / `work-history.js` |
| 水面の演出 | `public/assets/water.css` / `water.js` |
| 画像・サイト縮小表示 | `public/assets/` / `content/site-previews.json` |
| 管理画面・編集フォーム・問い合わせ一覧 | `src/app/admin/` / `src/components/admin-*.tsx` |
| 管理API・認証・編集データ定義 | `src/lib/admin-api.ts` / `admin-auth.ts` / `admin-content.ts` |
| 公開用の配信成果物生成 | `scripts/prepare-pages.mjs` |

管理画面では実績、スキル、取引先、サービス単価、エンジニア時間単価、顧問単価を作成・編集・削除し、公開状態と順序を指定できます。保存先はDynamoDBです。上記のローカルJSONは初期投入とスナップショット用で、管理画面の変更は自動で書き戻されません。プロフィール・SNS・イベント・画像の変更は引き続きリポジトリで行います。

## 開発・ビルド

```sh
npm ci
npm run dev
```

Node.js 24 LTS / npm と Python 3.9以上を使用します。開発サーバーは http://localhost:3000 。既存の `.html` 付きURLにも対応します。

`predev` / `prebuild` がPython生成器を実行し、`.generated/pages.json` を作成します。生成器や `content/` を変更した場合は `npm run prepare:content` を再実行し、ブラウザを再読み込みしてください。`.generated/` を直接編集しないでください。

```sh
npm run build
npm run typecheck
npm run preview
```

Next.jsの `output: "export"` で公開ページと管理画面を `out/` に書き出します。`postbuild` は `archive/technical-notes/` の内容を既存URLと同じ階層へコピーします。ファイルが衝突した場合はビルドを失敗させます。`npm run preview` は http://localhost:4173 で `out/` を配信します。

GitHub Pages向けにはビルド後に `npm run prepare:pages` を実行します。`admin.html`・管理画面のページデータ・`admin-config.json` を除いた `.pages/` が公開用成果物です。管理画面の配布には `out/` から管理用のHTML・Next.js静的アセット・設定を使用します。生成物はGitに含めません。配置手順は [インフラのREADME](../infrastructure/README.md) を参照してください。

## 公開APIとスナップショット

最初のHTMLはリポジトリのJSONから生成します。`content.js` が `/assets/runtime-config.json` の `apiBaseUrl` を読み、`GET /public/content` の公開済みデータでトップ・実績・取引先・料金を更新します。APIはHTMLを返さず、文字列をエスケープして描画します。スキルタブと実績検索は `portfolio:content-updated` イベントで初期化し直します。

API未設定時やJavaScript無効時はビルド時のスナップショットを表示します。接続先を読み込んだ後でAPIの取得に失敗した場合は、保存済みの内容を表示している旨を案内します。公開設定には接続先だけを含み、問い合わせや認証情報は含めません。

実績は年ごとに並べ、現在進行中・カテゴリとタグを組み合わせて検索できます。担当フェーズ・技術スタックは案件ごとの詳細にまとめています。料金はカテゴリ単位の折りたたみ表示で、サービス単価・時間単価・顧問単価を掲載します。`priceYen: null` は都度見積もり、顧問は「要相談」として表示します。

## お問い合わせと管理画面

お問い合わせは確認画面から `POST /contact` へ送信します。同じ送信内容の再試行には同じ `Idempotency-Key` を使用し、成功時に受付番号を表示します。Lambdaが入力値と送信頻度を検証してDynamoDBへ保存します。

管理画面は `/admin-config.json` の接続先とCognito設定を読み込みます。ログイン後に管理APIでコンテンツと問い合わせを取得し、編集時のversionで競合を検知します。問い合わせはページ単位で取得し、未読・既読・アーカイブを切り替えます。管理用APIの認証・初期データ投入・設定生成は [インフラのREADME](../infrastructure/README.md)、入出力の契約は [API契約](../docs/api-contract.md) を参照してください。

## 公開画面の移行用構成

公開画面は既存のPython HTML生成器をビルド時に使用します。Next.jsのServer Componentはリポジトリ内で生成した本文だけを読み込み、CSSとページ別JavaScriptを組み合わせて表示します。管理画面はReactコンポーネントで実装しています。

旧JavaScriptはページ全体を初期化するため、ナビゲーションは通常の `<a>` を維持しています。今後 `next/link` を導入する場合は、先にメニュー・タブ・検索・水面演出をReactコンポーネントへ移し、イベントやアニメーションの後始末を実装してください。

実績の「経歴」はHTMLコメントのまま保持しています。[Next.jsの静的エクスポート](https://nextjs.org/docs/app/guides/static-exports)を使用し、サーバー処理はLambda側へ分離しています。
