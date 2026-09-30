# Portfolio API contract

公開サイトはGitHub Pages、管理画面は非公開S3をオリジンにしたCloudFrontで配信します。リージョンは`ap-northeast-1`です。管理者はCognitoでログインし、API GatewayのJWT検証とLambda側の`administrators`グループ確認で管理APIを保護します。

## Routes

- `GET /public/content`: `{schemaVersion: 1, collections: {projects: [], skills: [], partners: [], services: [], engineers: [], advisory: []}}`。公開された内容だけを返し、問い合わせは含みません。
- `POST /contact`: `{name, company, email, type, message, website}`。`website`は空のhoneypot、`Idempotency-Key`はブラウザが生成するUUID。成功は`201 {id, receivedAt}`。
- `GET /admin/content/{collection}`: `{items: [{id, data, version, updatedAt}]}`。
- `PUT /admin/content/{collection}/{id}`: `{data, version}`。新規は`version: null`、変更は取得済みの整数version。成功は`{id,data,version,updatedAt}`、競合は409。
- `DELETE /admin/content/{collection}/{id}`: `{version}`。競合は409。削除は管理画面で確認後に実行。
- `GET /admin/contacts?cursor=...`: `{items: [{id,name,company,email,type,message,createdAt,status,version}], nextCursor}`。新しい順・ページ単位で取得。
- `PATCH /admin/contacts/{id}`: `{status, version}`。statusは`new/read/archived`。

エラーは`{error: "CODE", message: "日本語の案内"}`。管理APIはCognitoのaccess tokenを`Authorization: Bearer ...`で渡します。

## Content data

各dataは`id`、`order`（整数、既定0）、`published`（boolean、既定true）を持ちます。以下は公開可能なデータのみです。

- `projects`: `frontend/content/career.json`のprojectsと同じ。`title, client, year, period, category, categories?, summary, role, tags, phases, stackGroups:[{label,tags}], current, partner?, partnerHonorific?`。categoryは`infrastructure/development/network`。
- `skills`: `{id,label,heading,icon,groups:[{name,items: string[]}],order,published}`。iconは`cloud/development/ai/devops`。
- `partners`: `{id,name,summary,tags: string[],sites:[{label,url,previewKey?}],order,published}`。URLはhttpsのみ。previewKeyは既存ローカルプレビューの識別子で省略可。
- `services`: 既存pricing.jsonのservicesに共通属性を付与。`category,product,item,unit,invoiceUnit?,notes,priceYen:number|null,sourceRow?`。
- `engineers`: 既存pricing.jsonのengineersに共通属性を付与。`category,phase,unit,notes,priceYen:number|null,sourceRow?`。
- `advisory`: `{id,title,summary,unit,priceYen:number|null,order,published}`。初期値は顧問・要相談（priceYen=null）。

## AWS resources and configuration

- Content table: partition key `collection` (S), sort key `id` (S)。内部itemは`data`、`version`、`updatedAt`を保持。
- Contacts table: partition key `id` (S)。GSI `by-created-at` はpartition `entity` (S、値contact)、sort `createdAt` (S)。
- Rate-limit table: partition key `id` (S)、TTL `expiresAt` (N)。短期間の送信制限に使用。
- Lambda handlers: `contact.handler.lambda_handler`, `public.handler.lambda_handler`, `admin.handler.lambda_handler`。共通environmentは`CONTENT_TABLE`, `CONTACTS_TABLE`, `RATE_LIMIT_TABLE`（必要分だけ設定）、`ADMIN_GROUP=administrators`。
- 公開設定 `/assets/runtime-config.json`: `{apiBaseUrl}`。認証情報は含みません。
- 管理設定 `/admin-config.json`: `{apiBaseUrl,region,userPoolId,clientId}`。Cognito clientはsecretなし、自己サインアップなし、`ALLOW_USER_PASSWORD_AUTH`と`ALLOW_REFRESH_TOKEN_AUTH`。
- 管理画面はNext.jsの`/admin`を静的書き出しした`admin.html`。CloudFrontのdefault root objectも`admin.html`。

初期データは条件付き作成で投入し、再実行によって管理画面の更新を上書きしません。Terraform stateとバックエンド設定、デプロイ出力、パスワードはGit管理しません。
