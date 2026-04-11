# Kiri

Webコンテンツを切り取り、翻訳し、まとめるClaude Codeスキル。

記事やツイートのスクショに翻訳を注入したり、画像内のテキストをOCRで翻訳オーバーレイしたり、それらをまとめてMarkdownページを生成する。

## セットアップ

```bash
# スキルディレクトリにクローン
git clone https://github.com/moeki/kiri.git ~/.claude/skills/kiri

# 依存インストール
cd ~/.claude/skills/kiri
bun install
bunx playwright install chromium

# OCR機能を使う場合（オプション）
brew install tesseract  # macOS
# sudo apt install tesseract-ocr  # Linux

# Gyazoを使う場合（オプション）
# macOS
security add-generic-password -a gyazo -s kiri -w YOUR_GYAZO_TOKEN -U
# Linux
secret-tool store --label=kiri service kiri key gyazo
```

## 設定

プロジェクトルートに `kiri.json` を作成：

```json
{
  "name": "週刊AIニュース",
  "theme": "AI・LLM・機械学習の最新動向",
  "output": "wiki/ai_news_{{date}}.md",
  "images": "gyazo"
}
```

| フィールド | 説明 |
|-----------|------|
| `name` | 出力ページのタイトル |
| `theme` | 検索・選別・解説の判断軸 |
| `output` | 出力先パス。`{{date}}`は`YYYY_MM_DD`に置換 |
| `images` | `"gyazo"` or `"local"` |

## コマンド

```bash
# ページのテキストを読み取る
./run.sh read <url>

# 翻訳注入 + 要素スクショ → Gyazoアップロード
./run.sh <url> <sections.json>

# 翻訳注入 + 要素スクショ → ローカル保存
./run.sh <url> <sections.json> --local <dir>

# ページ内の重要画像を抽出
./run.sh images <url>

# OCR（テキスト + バウンディングボックス取得）
./run.sh ocr <image_path_or_url>

# OCR翻訳オーバーレイ（灰色塗りつぶし + 翻訳テキスト）
./run.sh ocr <image_path_or_url> <translations.json>
```

### sections.json

```json
[
  { "selector": "h1", "translated": "翻訳タイトル" },
  { "selector": "article p", "translated": "翻訳本文" },
  { "selector": "div.tweet-text", "translated": "翻訳", "capture": false }
]
```

- `translated` が空 → 翻訳注入しない（元テキストのまま）
- `capture: false` → 翻訳注入だけしてスクショしない

### translations.json（OCR用）

```json
[
  { "text": "Original", "translated": "翻訳", "bbox": { "x0": 10, "y0": 20, "x1": 200, "y1": 50 } }
]
```

`bbox`は`ocr`コマンドの出力から取得。

## ライセンス

MIT
