# AWS infrastructure

公開サイトは GitHub Pages、管理画面は S3 + CloudFront、API は API Gateway HTTP API + Python 3.12 Lambda で配信します。保存先は DynamoDB、管理者認証は Cognito です。API とデータ形式は [API 契約](../docs/api-contract.md) を参照してください。

本番のAWSアカウントは `511417194906`、リージョンは `ap-northeast-1` です。管理画面は https://d3fkhu90dz1124.cloudfront.net 、公開APIは https://n4js9rf9n4.execute-api.ap-northeast-1.amazonaws.com です。2026年9月30日に指定アカウントへ移行しています。

```text
infrastructure/
├── cloudformation/terraform-backend.yaml
├── scripts/bootstrap_backend.py
├── lambda/{public,contact,admin,common}/
└── terraform/
    ├── environments/{dev,production}/
    └── modules/{data,api,auth,frontend-hosting}/
```

`../tidal-waive-ryukyu/event-site/infrastructure/terraform` と同じ environments / modules 構造です。dev と production は独立した state とリソースを持ちます。staging は作成しません。リージョンの既定値は `ap-northeast-1` です。

## 必要なツールと認証

- Terraform 1.10 以上、2.0 未満。S3 の `use_lockfile` を利用します。
- Python 3 と boto3。Lambda の実行環境は Python 3.12 です。
- Terraform provider: AWS `~> 6.66`、archive `~> 2.8`。環境ごとの `.terraform.lock.hcl` を Git 管理し、通常の更新では固定済みバージョンを使います。

`AWS_PROFILE`、SSO、環境変数、ロールなど、AWS SDK / provider の標準認証チェーンを使います。アクセスキー・セッション・管理者パスワードをコード、Terraform 変数、state、コマンド引数へ書き込みません。パスワードを保持する Terraform リソースも作成しません。

## State の初期作成

リポジトリのルートで実行します。以下のアカウント ID は実際の対象に置き換えてください。`--allowed-account-id` は必須で、STS の確認結果が違えば変更前に停止します。

```sh
export TF_VAR_allowed_account_id="123456789012"
python3 infrastructure/scripts/bootstrap_backend.py \
  --environment production \
  --region ap-northeast-1 \
  --allowed-account-id "$TF_VAR_allowed_account_id"
```

bootstrap は CloudFormation スタックを作成・更新して完了を待ち、対象環境の `backend.hcl` を権限 `0600` で生成します。再実行で差分がない場合も設定を再生成できます。dev は `--environment dev` を指定します。`--project` を変える場合は Terraform 側の `project` も同じ値にします。

State S3 はバージョニング、暗号化、公開拒否、HTTPS 強制、削除時の保持を設定します。DynamoDB lock table のキーは `LockID` です。スタック削除保護とリソース保持を有効にしています。

backend は `use_lockfile = true` と `dynamodb_table` を併記します。DynamoDB ロックは [HashiCorp 公式で非推奨](https://developer.hashicorp.com/terraform/language/backend/s3#state-locking)ですが、今回の指定に従って併用しています。将来の Terraform 更新時は両方式の対応を確認してください。

## Plan と適用

```sh
cd infrastructure/terraform/environments/production
terraform init -backend-config=backend.hcl
terraform fmt -check -recursive ../../
terraform validate
terraform plan -out=production.tfplan
terraform apply production.tfplan
terraform output
```

`allowed_account_id` に既定値はありません。上記の `TF_VAR_allowed_account_id`、または Git 管理外の `terraform.tfvars` で必ず指定します。`terraform.tfvars.example` に入力例があります。provider と S3 backend の両方で対象アカウントを制限します。environment はディレクトリに固定しています。

GitHub Pages と、この環境で作成した管理用 CloudFront の origin は CORS に自動登録されます。追加の origin は `additional_cors_origins` へ完全な HTTPS origin を指定してください。dev だけは `http://localhost:3000` なども指定できます。ワイルドカード・URL パス・末尾 `/` は使いません。

## リソースと公開設定

| Module | 内容 |
| --- | --- |
| data | コンテンツ、問い合わせ、送信頻度制限の 3 テーブル。問い合わせの `by-created-at` GSI、頻度制限の TTL `expiresAt` |
| api | 閲覧・問い合わせ・管理の 3 Lambda と、契約に記載された 7 routes。関数ごとに IAM を分離 |
| auth | 自己登録を許可しない Cognito user pool、secret を持たない client、`administrators` グループ |
| frontend-hosting | 非公開 S3、CloudFront OAC、HTTPS、セキュリティヘッダー。default root は `admin.html` |

公開 GET と問い合わせ POST に認証は不要です。管理 route は Cognito の JWT authorizer と `aws.cognito.signin.user.admin` scope を必須にし、Lambda でも `administrators` グループを確認します。ブラウザは `USER_PASSWORD_AUTH` と refresh token のフローを利用します。

問い合わせは route 単位で毎秒 5 件、burst 10 件に制限します。Lambda は DynamoDB でも送信頻度を制限し、Idempotency-Key による条件付き作成を行います。API access log は request ID・route・status・応答サイズだけを記録し、本文・入力値・認証ヘッダー・IP・query は含めません。API と Lambda のログ保持は 14 日です。

production はコンテンツ・問い合わせの PITR と DynamoDB / Cognito の削除保護を有効にします。`enable_deletion_protection` の既定値は production が `true`、dev が `false` です。この変数は DynamoDB 3 テーブルと Cognito user pool の削除保護だけを変更し、PITR は変更しません。管理 S3 は空でない状態での削除を許可しません。

Terraform の outputs は次のとおりです。

- `api_base_url`
- `admin_url`, `admin_bucket_name`, `admin_distribution_id`
- `user_pool_id`, `user_pool_client_id`
- `content_table_name`, `contacts_table_name`, `rate_limit_table_name`
- `region`

公開サイトの `/assets/runtime-config.json` には `{apiBaseUrl}`、管理 S3 の `/admin-config.json` には `{apiBaseUrl,region,userPoolId,clientId}` を配置します。これらの ID は公開設定で、認証情報を含みません。管理画面に必要な `admin.html` と Next.js の静的 assets を S3 に配置してください。管理画面の入口自体は配信されますが、内容・問い合わせデータは認証済み API からだけ取得します。

管理者ユーザーとパスワードは Terraform 管理外で作成し、`administrators` グループに登録します。初期コンテンツは条件付きで投入し、管理画面から保存したデータを再投入で上書きしません。

## 管理画面と初期データの配置

適用後、リポジトリのルートから実行します。outputs の JSON と初期ログイン情報は Git 管理外に置きます。

```sh
umask 077
mkdir -p infrastructure/.local
terraform -chdir=infrastructure/terraform/environments/production output -json > infrastructure/.local/production-outputs.json
python3 infrastructure/scripts/write_runtime_config.py --outputs infrastructure/.local/production-outputs.json
npm --prefix frontend run build
python3 infrastructure/scripts/deploy_admin.py \
  --outputs infrastructure/.local/production-outputs.json \
  --directory frontend/out \
  --allowed-account-id "$TF_VAR_allowed_account_id"
python3 infrastructure/scripts/create_admin.py \
  --outputs infrastructure/.local/production-outputs.json \
  --username terutaro \
  --credentials-file /private/tmp/terutaro-admin-login.txt \
  --allowed-account-id "$TF_VAR_allowed_account_id"
```

管理者の招待メールは送信せず、一時パスワードは指定したローカルファイルへ保存します。最初のログインでパスワード変更が必要です。既存ユーザーのパスワードは再実行でリセットしません。

`seed_content.py` の `--table` は `content_table_name` の出力値に合わせます。既定の production では次のように実行します。

```sh
python3 infrastructure/scripts/seed_content.py --table terutaro-production-content --dry-run
python3 infrastructure/scripts/seed_content.py \
  --table terutaro-production-content \
  --region ap-northeast-1 \
  --allowed-account-id "$TF_VAR_allowed_account_id"
```

dry-run は AWS に接続しません。実投入ではアカウント ID を検証してから書き込みます。公開サイト側は通常の GitHub Pages 配信手順で更新します。

## ローカル検証

```sh
terraform -chdir=infrastructure/terraform/environments/dev init -backend=false
terraform -chdir=infrastructure/terraform/environments/dev validate
terraform -chdir=infrastructure/terraform/environments/production init -backend=false
terraform -chdir=infrastructure/terraform/environments/production validate
terraform fmt -check -recursive infrastructure/terraform
python3 infrastructure/scripts/bootstrap_backend.py --help
```

`init -backend=false` と `validate` は AWS リソースを作りません。Lambda zip は `archive_file` が全 Lambda ディレクトリから生成し、tests・Python cache・`.env`・仮想環境を除外します。plan が作成した `.build/` の zip は apply が終わるまで保持してください。

backend.hcl、tfvars、plan、state、`.terraform/`、zip、デプロイ出力、認証情報は Git 管理しません。provider の更新では [AWS provider の公式リリース](https://github.com/hashicorp/terraform-provider-aws/releases) と [archive provider の公式リリース](https://github.com/hashicorp/terraform-provider-archive/releases) を確認してから lockfile を更新します。

## AWS アカウントを移行する場合

移行元と移行先で作業ディレクトリ・`TF_DATA_DIR`・backend 設定・outputs・AWS profile を分け、各操作で `allowed_account_id` を対象アカウントに合わせます。同じ `production` 名でも別アカウントのリソースです。旧 backend 設定、`terraform state pull` の結果、outputs、管理対象の resource ID 一覧を Git 管理外へ権限 `0600` で保全してから、新アカウントを初期化してください。

新アカウントは新しい CloudFormation backend と空の Terraform state から構築します。新規 backend の接続には `terraform init -reconfigure -backend-config=backend.hcl` を使い、旧リソースの state を新アカウントへ `-migrate-state` しません。新側の削除保護は既定値 `true` を維持します。

データ移行には `infrastructure/scripts/migrate_data.py` を使い、移行元・移行先それぞれの outputs、profile、アカウント ID、バックアップ先を明示します。Content と Contacts は DynamoDB の生の item を保存・コピーします。公開 API だけのコピーでは非公開コンテンツや `version`、`updatedAt`、問い合わせの `payloadHash` を失うため、代用できません。送信頻度制限の短命 TTL データは移行しません。Cognito のユーザーと初期パスワードは新 pool で作成します。

次の環境変数を対象の profile とアカウント ID に設定し、outputs のパスを保存先に合わせます。事前確認では末尾に `--dry-run` を付けます。migration の dry-run は AWS の読み取りを行いますが、書き込みません。

```sh
python3 infrastructure/scripts/migrate_data.py \
  --source-profile "$SOURCE_PROFILE" \
  --destination-profile "$DESTINATION_PROFILE" \
  --source-account-id "$SOURCE_ACCOUNT_ID" \
  --destination-account-id "$DESTINATION_ACCOUNT_ID" \
  --source-outputs /private/tmp/source-outputs.json \
  --destination-outputs /private/tmp/destination-outputs.json \
  --backup-dir /private/tmp/terutaro-migration-backups
```

コピー先の既存 item が同じなら再作成を避け、異なる場合は上書きせず停止します。新側へ `seed_content.py` を先に実行しないでください。本コピーは旧側の書き込み停止後に行います。DynamoDB の Scan はテーブル全体の同時点 snapshot ではないため、通常稼働中のコピーだけで完了扱いにしません。

切り替えと旧環境の撤去は、次の順序で行います。

1. 新側の構築、管理画面の配置、認証、公開取得、管理操作、問い合わせを検証します。検証用に作成した item は取り除き、移行先は空にします。削除対象は旧 state に記載された ID と、この構築で作成した旧 CloudFormation backend の実 ID に限定します。
2. 旧側専用の Terraform 作業ディレクトリで `terraform plan -var='enable_deletion_protection=false' -out=disable-protection.tfplan` を作り、DynamoDB 3 テーブルと Cognito の保護解除だけであることを確認して適用します。保護解除は通常の apply として先に完了させます。
3. 旧 contact / admin Lambda の書き込み受付を一時停止し、処理中のリクエストが完了するまで待ちます。reserved concurrency を `0` にする場合、停止対象は旧 state の該当 2 関数だけです。public の読み取りは維持できます。通常の Terraform apply で concurrency が元に戻る可能性があるため、停止後は通常の apply を行いません。
4. 最終の生データコピーと全 item の一致検証を行い、GitHub Pages の runtime-config と管理画面の案内を新側へ切り替えます。新 URL の実動作を確認するまで旧データを削除しません。旧 API を参照したままのブラウザでは再読み込みが必要になる場合があります。
5. 旧 state の `admin_bucket_name` だけを対象に、S3 の全 object version と delete marker を列挙・保存してから削除します。`ExpectedBucketOwner` は旧アカウントを指定します。通常の `s3 rm --recursive` では非現行 version が残ります。削除結果の `Errors` を確認し、全 version / marker が空であることを再確認します。`force_destroy = false` は維持します。
6. 旧作業ディレクトリで `terraform plan -destroy -var='enable_deletion_protection=false' -out=destroy.tfplan` を作成します。計画の全 ID が保全した旧 state と一致し、新側や既存の無関係なリソースを含まないことを確認してから、その保存済み plan を適用します。CloudFront の無効化・削除などの依存順序は Terraform に処理させます。
7. 旧 state の管理リソースが空になったことを確認し、最終 state を保全します。旧 backend の S3 と DynamoDB はここまで残します。
8. 旧 CloudFormation スタックの termination protection を解除してスタックを削除します。テンプレートの S3・bucket policy・DynamoDB はすべて `Retain` のため、この操作だけでは消えません。削除前に取得した当該スタックの実 ID を使って、次項の残存 backend を処理します。

残存 backend は Terraform が完全に停止した後、最後に撤去します。旧 lock table の deletion protection を明示的に解除して削除し、旧 state bucket は state 履歴の保全後に全 version / delete marker を削除してから bucket を削除します。いずれも旧スタックの実 ID と旧アカウントを照合します。名前の prefix に一致する全リソースをまとめて削除する手順や、先に state bucket を削除する手順は使いません。
