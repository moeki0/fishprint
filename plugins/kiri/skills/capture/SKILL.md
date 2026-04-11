---
name: capture
description: Webページの要素を翻訳してスクショを撮る。「スクショ撮って」「キャプチャして」「ページを翻訳して撮って」と言った時に使う。
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(*/kiri-capture.sh *)
  - Bash(mkdir *)
  - Bash(ls *)
---

# /kiri:capture — 翻訳スクショ

引数: `$ARGUMENTS`

Webページの指定要素に翻訳テキストを注入し、要素単位でスクショを撮影してGyazo/ローカルに保存する。

## フロー

1. `kiri-capture.sh read "<url>"` でページのテキストを読む
2. 翻訳すべきセクションとセレクタを決定
3. Writeツールで `/tmp/sections.json` を作成（catは使わない）
4. キャプチャ実行

```bash
${CLAUDE_SKILL_DIR}/kiri-capture.sh "<url>" /tmp/sections.json
${CLAUDE_SKILL_DIR}/kiri-capture.sh "<url>" /tmp/sections.json --local <dir>
```

- `translated` が空 → 翻訳注入しない
- `capture: false` → 翻訳注入だけしてスクショしない

引数にURLがあればそれを使う。なければユーザーに聞く。
