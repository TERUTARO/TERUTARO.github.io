# terutaro

照屋 朝太郎の個人サイト。公開URL: https://terutaro.github.io/

公開サイトは Next.js の静的出力を GitHub Pages へ配信します。実績・スキル・取引先・料金は管理画面から更新でき、お問い合わせは API Gateway → Lambda → DynamoDB に保存します。管理画面は Cognito で認証し、非公開 S3 をオリジンとする CloudFront から配信します。

## ディレクトリ

```text
.
├── frontend/                 # Next.js / TypeScript（サイト本体）
│   ├── src/app/              # 公開ページ・料金・管理画面
│   ├── src/components/       # 公開画面の移行用コンポーネント・管理UI
│   ├── src/lib/              # コンテンツ読み込み・管理API・Cognito認証
│   ├── public/assets/        # 画像・既存CSS/JavaScript
│   ├── content/              # 公開時のスナップショット・初期投入データ
│   └── scripts/              # 本文生成・旧資料コピー・Pages用出力の分離
├── infrastructure/           # インフラ定義とLambda
│   ├── lambda/               # 公開内容・お問い合わせ・管理API・共通検証
│   ├── cloudformation/       # Terraform state用 S3 / DynamoDB
│   ├── terraform/            # dev / production のAWSリソース
│   └── scripts/              # 初期投入・設定生成・管理画面の配置
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

`npm run build` はコンテンツ生成 → Next.jsの静的出力 → 旧資料のコピーを実行し、`frontend/out/` を作成します。プレビューは http://localhost:4173 。生成物・依存パッケージはGitに含めません。

## コンテンツとお問い合わせ

公開ページはビルド時のHTMLを表示した後、`/public/content` から公開済みデータを取得して更新します。APIが利用できない場合やJavaScriptが無効な場合も、リポジトリ内のデータから生成したスナップショットを表示できます。管理画面での変更はDynamoDBに保存され、リポジトリのJSONやスナップショットへ自動では書き戻しません。

実績には現在進行中・カテゴリ・タグによる検索と年ごとの区切りを設け、担当フェーズと技術スタックを展開できます。料金ページはサービス単価・エンジニア時間単価をカテゴリごとに折りたたみ、顧問単価も掲載します。

お問い合わせは入力確認後に送信し、受付番号を表示します。Lambdaが入力検証・送信頻度制限・重複防止を行い、管理者は管理画面で問い合わせを確認して未読・既読・アーカイブを切り替えます。問い合わせデータは公開コンテンツと別のテーブルに保存します。

更新先とフロントの構成は [frontend/README.md](frontend/README.md)、APIの形式は [docs/api-contract.md](docs/api-contract.md) を参照してください。

## 公開

同じNext.jsビルドから、配信先に合わせて成果物を分けます。

- 公開サイト：`npm run prepare:pages` で管理画面の入口と設定を除いた `frontend/.pages/` を作成し、GitHub Pagesへ公開します。`master` へのpush時にGitHub Actionsがビルド・型チェック・公開を実行します。Pagesの公開元は **GitHub Actions** を使用します。
- 管理画面：`frontend/out/` から `admin.html`・Next.js静的アセット・管理設定をS3へ配置します。管理APIはCognitoのaccess tokenと管理者グループで保護します。

API接続先は公開用 `/assets/runtime-config.json`、管理用 `/admin-config.json` で設定します。AWS構築、管理者作成、初期データ投入、管理画面の配置手順は [infrastructure/README.md](infrastructure/README.md) にまとめています。

既存の `index.html` / `works.html` などのURLを維持します。過去の技術資料もビルド後に元の公開階層へコピーするため、`/Ansible/Ansible-01.html` などのURLを維持します。原本の管理場所は [archive/](archive/README.md) です。

デザイン・掲載情報については [docs/portfolio.md](docs/portfolio.md) を参照してください。
