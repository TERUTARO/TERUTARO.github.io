# 旧技術資料

`technical-notes/` は、以前から公開している技術資料と旧サイトの関連アセットです。今回の整理ではファイルの配置だけを変更し、資料本文・スクリプト・画像の内容は変更していません。

ビルド後に `technical-notes/` の中身を `frontend/out/` の直下へコピーします。公開URLには `archive/` を追加せず、`/Ansible/Ansible-01.html`、`/LINUX/index.html` などの従来のURLと相対リンクを維持します。`assets/css/`、`assets/js/`、`assets/fonts/`、`assets/sass/` は旧サイト用です。

資料を更新する場合は `technical-notes/` 内の該当ファイルを編集し、リポジトリのルートから次を実行してください。

```sh
cd frontend
npm run build
```

`scripts/copy-archive.mjs` がビルド後に資料を出力へ統合します。既存ディレクトリは共有できますが、同じ出力先へのファイル上書きとシンボリックリンクは拒否します。再実行する場合も、まず Next.js をビルドして出力を作り直してください。

一部の古い資料には、存在しない画像や `py-modindex.html` への参照など、整理前からのリンク切れがあります。今回のディレクトリ移動ではこれらの参照先を変更していません。
