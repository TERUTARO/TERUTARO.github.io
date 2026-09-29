# Infrastructure

AWS などのインフラ定義と、問い合わせ用 Lambda のコードをここで管理します。
今回の整理では配置と入口だけを用意しています。AWS リソースの作成、デプロイ、フロントエンドからの API 呼び出しは未実装です。

```text
infrastructure/
├── lambda/
│   └── contact/
│       └── handler.py  # 問い合わせ用 Lambda の入口
└── terraform/
    └── README.md       # インフラ定義の追加先
```

## 問い合わせ用 Lambda

`lambda/contact/handler.py` は Python の標準ライブラリだけで動作します。
将来デプロイする際のハンドラー名は `handler.lambda_handler` です。
API Gateway の Lambda プロキシ統合に合わせたレスポンス形式で、現在は常に HTTP `501` と `CONTACT_NOT_IMPLEMENTED` を返します。入力内容の送信・保存・ログ出力は行いません。

リポジトリのルートから、AWS に接続せずに動作を確認できます。

```sh
python3 - <<'PY'
import json
import runpy

handler = runpy.run_path("infrastructure/lambda/contact/handler.py")
response = handler["lambda_handler"]({}, None)
print(json.dumps(response, ensure_ascii=False, indent=2))
PY
```

本実装では、受付先と送信方法を決めてから入力検証、送信処理、フロントエンドとの接続を追加します。現在のサイトのお問い合わせフォームは確認画面までのモックです。

実装形式の参考: [AWS Lambda の Python ハンドラー](https://docs.aws.amazon.com/lambda/latest/dg/python-handler.html)、[API Gateway の Lambda プロキシ統合](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)。
