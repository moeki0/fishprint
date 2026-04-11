---
name: read
description: WebページのテキストをPlaywrightで読み取る。「ページ読んで」「記事の内容を取得」と言った時に使う。
user-invocable: true
allowed-tools:
  - Bash(*/kiri-run.sh *)
  - Bash(mkdir *)
  - Bash(ls *)
  - Bash(head *)
  - Write(/tmp/*)
---

# /kiri:read — Webページのテキスト読み取り

引数: `$ARGUMENTS`

Playwrightでページを開き、本文テキストを抽出して返す。

## 使い方

```bash
${CLAUDE_SKILL_DIR}/kiri-run.sh read "<url>"
```

URLは引数から取得する。引数がなければユーザーに聞く。
