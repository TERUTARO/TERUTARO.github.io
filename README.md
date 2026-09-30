# terutaro

照屋 朝太郎の個人サイト。公開URL: https://terutaro.github.io/

## ディレクトリ

```text
.
├── frontend/                 # Next.js / TypeScript（サイト本体）
│   ├── src/app/              # トップ・実績・企業様・イベント・お問い合わせ・料金
│   ├── src/components/       # 既存画面を表示する移行用コンポーネント
│   ├── src/lib/              # ビルド済みコンテンツの読み込み
│   ├── public/assets/        # 画像・既存CSS/JavaScript
│   ├── content/              # プロフィール・実績・料金・サイトプレビューのデータ
│   └── scripts/              # コンテンツ生成・旧資料の公開出力へのコピー
├── infrastructure/           # インフラ定義とLambda
│   ├── lambda/contact/       # 問い合わせ用Lambdaの雛形
│   └── terraform/            # Terraformの追加先
├── archive/technical-notes/  # 過去の技術資料（元の階層を保持）
├── docs/                     # デザイン・掲載情報の補足
└── .github/workflows/        # Next.jsのビルド・GitHub Pages公開
```

## ローカル開発

Node.js 24 LTS / npm と Python 3.9以上を使用します。

```sh
cd frontend
npm ci
npm run dev
```

http://localhost:3000 を開きます。既存の `.html` 付きURLも開発サーバーで利用できます。

```sh
cd frontend
npm run build
npm run typecheck
npm run preview
```

`npm run build` はコンテンツ生成 → Next.jsの静的出力 → 旧資料のコピーを実行します。公開成果物は `frontend/out/` です。プレビューは http://localhost:4173 。生成物・依存パッケージはGitに含めません。

## 今回の整理範囲

サイトの配置とNext.jsの入口を整備しています。既存画面のHTML生成・CSS・JavaScriptは継続利用し、Next.jsのページから表示します。画面ごとのReactコンポーネント化は次の段階で進められる構成です。更新先と移行の仕組みは [frontend/README.md](frontend/README.md) に記載しています。

問い合わせフォームは現在も確認画面までのモックです。Lambdaは未実装を示す `501` を返す入口のみで、AWSリソースの作成・実送信・フロントからの接続はまだ行いません。詳細は [infrastructure/README.md](infrastructure/README.md) を参照してください。

## 公開

`master` へのpush時にGitHub Actionsでビルドし、`frontend/out/` をGitHub Pagesへ公開します。Pagesの公開元は **GitHub Actions** を使用します。既存の `index.html` / `works.html` などのURLを維持します。

過去の技術資料はビルド後に元の公開階層へコピーするため、`/Ansible/Ansible-01.html` などのURLも維持します。原本の管理場所は [archive/](archive/README.md) です。

デザイン・掲載情報については [docs/portfolio.md](docs/portfolio.md) を参照してください。
