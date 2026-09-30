# Terraform

`environments/dev` と `environments/production` を入口に、`modules/data`、`api`、`auth`、`frontend-hosting` を共有します。state は環境ごとの S3 backend で管理します。

初回の CloudFormation bootstrap、必要な変数、plan・apply・デプロイの流れは [Infrastructure README](../README.md) を参照してください。
