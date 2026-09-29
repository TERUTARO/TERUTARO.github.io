# Terraform

AWS リソース定義を追加するためのディレクトリです。現在は `.tf` ファイル、バックエンド設定、環境別設定を用意していません。

問い合わせ API を実装する際は、Lambda と HTTP の入口、実行に必要な IAM 権限などをここで定義します。AWS アカウント・リージョン・受付先・送信方式が決まってから、実際の構成に合わせて追加します。

Lambda のアプリケーションコードは [`../lambda/contact/handler.py`](../lambda/contact/handler.py) に配置します。
