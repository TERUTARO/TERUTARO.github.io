---
description: Issue を実装して PR を作り、@codex review の指摘が無くなるまで直してからマージする
argument-hint: <Issue の URL または番号>
---

# Issue 対応 → PR → Codex レビュー → マージ

対象の Issue: $ARGUMENTS

指定された Issue を実装し、PR を作成し、`@codex review` の指摘が無くなるまで修正を繰り返してからマージする。
途中で判断に迷っても止まらず、対象リポジトリの `CLAUDE.md` / `AGENTS.md` / `.aicommon/` のルールに従って進めること。

## 0. 前提

- GitHub の操作は `gh` コマンドで行う（`gh auth status` で認証済みであること）
- 対象リポジトリは Issue の URL から決める（`https://github.com/<owner>/<repo>/issues/<番号>`）。番号だけ渡されたときは `issue-write.env`（または `.env`）の `ISSUE_WRITE_REPO`、それも無ければカレントディレクトリの `origin` のリポジトリとみなす
- Issue の追加先（起票・GitHub Projects への登録）はリポジトリ名を直接書かず、環境変数で決める。正はリポジトリ直下の `issue-write.env`（非機密・コミット済み）で、人が `.env` に同じキーを書いていれば `.env` を優先する（Claude Code は `.env` を読めない設定のリポジトリがある）
  - `ISSUE_WRITE_TYPE`: `repo`（`ISSUE_WRITE_REPO` に起票）/ `project`（起票したうえで `ISSUE_WRITE_PROJECTS` にも登録）/ 空欄（カレントの `origin` に起票、Projects 登録なし）
  - `ISSUE_WRITE_REPO`: 起票先リポジトリ（`owner/repo`）
  - `ISSUE_WRITE_PROJECTS`: 登録先 Projects（`owner/番号` をカンマ区切り）
  - `ISSUE_WRITE_REPO` と `ISSUE_WRITE_PROJECTS` はどちらも記載しておき、使わない方は空欄にして `ISSUE_WRITE_TYPE` で分別する
- ローカルのクローンは `repo.nosync/<owner>/<repo>` を正とし、作業は **git worktree** で行う（元のクローンのブランチを切り替えない）

## 1. Issue を読む

```bash
gh issue view <番号> --repo <owner>/<repo> --json number,title,body,labels,comments
```

- 本文が空でも、タイトル・ラベル・関連 Issue / PR（`gh issue list --search` / `gh pr list --search`）から背景を押さえる
- 受け入れ条件とスコープを 2〜3 行で整理してから着手する

## 2. 作業場所を用意する

```bash
cd repo.nosync/<owner>/<repo>
git fetch origin
git worktree add ../<repo略称>-<番号> -b <prefix>/<番号>-<対応名> origin/development
cd ../<repo略称>-<番号>
```

- ベースブランチは `development`（リポジトリのルールが別を指す場合はそれに従う）
- `<prefix>` は `feature/` `fix/` `bug/` `chore/` `refactor/` `test/` のいずれか。Issue タイトルや日付をそのまま使わない
- 既存の worktree 名の慣例（例: `ac-3056`）があれば合わせる

## 3. 実装する

- 既存の実装・テスト・ヘルパーの書き方に合わせる。同じ処理をコピーせず、共通化できるものはヘルパーへ寄せる
- コメントは「何をしているか」ではなく「なぜそうしているか」を書く。関連 Issue / PR 番号を残す
- ローカルで確認できるものは確認する（lint、型チェック、`--list`、構文チェックなど）。ローカルに環境が無いものは Docker で代替できないか試し、無理なら PR に「未実行」と理由を書く
- commit は変更単位ごとにこまめに切る。メッセージは変更内容が分かる具体的な文にする

```bash
git add <files>
git commit -m "<type>(<scope>): <内容> (#<番号>)"
git push -u origin HEAD
```

## 4. PR を作る

- 本文は `tmp/pr-body.md` に書いて `--body-file` で渡す（shell 解釈事故を避ける）
- 構成: 概要 / 変更理由 / 変更内容 / 確認内容 / 補足 / `Closes #<番号>`
- 原則 Ready for review（`--draft` を付けない）。絵文字は使わない

```bash
gh pr create --base development --head <branch> --title "<type>(<scope>): <内容> (#<番号>)" --body-file tmp/pr-body.md
```

## 5. Codex にレビューを依頼する

```bash
printf '@codex review\n' > tmp/pr-comment.md
gh pr comment <PR番号> --body-file tmp/pr-comment.md
```

コメントを投稿した時刻（UTC）を控えておく。以降の判定で「それより後のレビューか」を見る。

## 6. 5 分ごとに確認し、指摘が無くなるまで繰り返す

5 分（300 秒）待ってから次を確認する。ループは **指摘が無く、かつ CI が全て pass** になるまで続ける。
Codex の応答は「review（インライン指摘つき）」「PR コメントのみ（指摘なし）」「👍 の反応」の 3 通りあるので、3 つとも見る（1 つだけ見ていると応答を取りこぼす）。

```bash
# Codex のレビュー（@codex review を投稿した時刻より後のもの）
gh api repos/<owner>/<repo>/pulls/<PR番号>/reviews --jq '.[] | select(.user.login | test("codex")) | "\(.submitted_at) \(.state) \(.commit_id[0:10])"'

# インライン指摘（本文に P1 / P2 / P3 のバッジが付く）
gh api repos/<owner>/<repo>/pulls/<PR番号>/comments --jq '.[] | select(.user.login | test("codex")) | "\(.created_at) \(.path):\(.line // .original_line)\n\(.body)\n---"'

# 指摘が無いときは review を出さず、PR コメント「Codex Review: Didn't find any major issues」だけを投稿する。
# 「Codex Review Summary」コメントは更新され、Completed の行に対象 commit が出る（最新 commit か確認する）
gh api repos/<owner>/<repo>/issues/<PR番号>/comments --jq '.[] | select(.user.login | test("codex")) | "\(.created_at) upd=\(.updated_at) \(.body | split("\n")[0][0:100])"'

# 全レビュー完了後、@codex review のコメントに 👍 が付く（付くまで時間差がある。これだけを待たない）
gh api repos/<owner>/<repo>/issues/comments/<コメントID>/reactions --jq '.[] | "\(.user.login) \(.content)"'

# CI
gh pr checks <PR番号>
```

### 指摘がある場合

1. 指摘ごとに妥当性を確認する（コードを読んで裏を取る。鵜呑みにしない）
2. 妥当なものは修正して commit / push する。妥当でないものは理由を整理する
3. 対応内容を PR コメントで返す（`tmp/pr-comment.md` → `--body-file`）。指摘ごとに「何が問題で、どう直したか」または「直さない理由」を書く
4. もう一度 `@codex review` をコメントし、投稿時刻を控えて 5 分待つ

### 指摘が無い場合（「Didn't find any major issues」のコメント、インライン指摘 0 件のレビュー、または 👍）

1. `gh pr checks <PR番号>` で CI が **全て pass** していることを確認する（`pending` があれば待つ）
2. pass していればマージする

```bash
gh pr merge <PR番号> --squash --delete-branch
```

### CI が fail の場合

- 原因を特定して修正 commit を積む。**CI を通すためにテストコードを改変しない**（テストに難があるときは PR コメントで説明する）
- 修正を push したら `@codex review` から再度やり直す

### 対応中に別の Issue を起票するとき（follow-up・関連バグ）

- 起票先は `issue-write.env`（無ければ `.env`）の `ISSUE_WRITE_*` に従う。`ISSUE_WRITE_TYPE=project` なら起票後に `gh project item-add <番号> --owner <owner> --url <Issue URL>` で各プロジェクトへ登録する
- 本文は `tmp/issue-body.md` に書いて `--body-file` で渡す。Epic 配下なら sub-issue として親に紐付ける

```bash
# リポジトリに scripts/github/create-issue.sh があればそれを使う（設定の読み込み・検証・Projects 登録まで行う）
scripts/github/create-issue.sh --title "<title>" --label <label>

# 無いリポジトリでは手で同じことをする
set -a; [ -f ./issue-write.env ] && . ./issue-write.env; [ -f ./.env ] && . ./.env; set +a
REPO="${ISSUE_WRITE_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
URL=$(GH_REPO="$REPO" gh issue create --title "<title>" --label <label> --body-file tmp/issue-body.md)
if [ "$ISSUE_WRITE_TYPE" = "project" ]; then
  for p in ${ISSUE_WRITE_PROJECTS//,/ }; do gh project item-add "${p#*/}" --owner "${p%/*}" --url "$URL"; done
fi
```

## 7. 終わったら報告する

- PR の URL、マージの有無、Codex の指摘と対応の要約、未確認の事項（CI でしか確認できなかったものなど）
- worktree は残しておく（片付けるかは利用者に任せる）
