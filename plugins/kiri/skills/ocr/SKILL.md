---
name: ocr
description: 画像内のテキストをOCRで読み取り、翻訳オーバーレイを作成する。「OCR」「画像を翻訳」と言った時に使う。
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(*/kiri-run.sh *)
  - Bash(mkdir *)
  - Bash(ls *)
---

# /kiri:ocr — OCR翻訳オーバーレイ

引数: `$ARGUMENTS`

画像内のテキストをtesseractでOCRし、翻訳テキストを灰色の背景でオーバーレイする。

## フロー

### Step 1: OCR読み取り

```bash
${CLAUDE_SKILL_DIR}/kiri-run.sh ocr "<image_path_or_url>"
```

→ 行ごとのテキストとバウンディングボックスがJSON出力される。

### Step 2: 翻訳JSONを作成

OCR結果を元に翻訳を作成：

```json
[
  { "text": "Original text", "translated": "翻訳テキスト", "bbox": { "x0": 10, "y0": 20, "x1": 200, "y1": 50 } }
]
```

### Step 3: オーバーレイ適用

```bash
${CLAUDE_SKILL_DIR}/kiri-run.sh ocr "<image_path_or_url>" /tmp/translations.json
${CLAUDE_SKILL_DIR}/kiri-run.sh ocr "<image_path_or_url>" /tmp/translations.json --local <dir>
```

→ 元テキストを薄い灰色で塗りつぶし、翻訳テキストをオーバーレイした画像を保存。

引数に画像パス/URLがあればそれを使う。なければユーザーに聞く。
tesseractが必要（`brew install tesseract`）。
