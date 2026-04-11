---
name: go
description: Webから情報を収集し、翻訳スクショ・OCR翻訳付きのMarkdownページを生成する。「ニュース」「リサーチ」「まとめ」と言った時に使う。
user-invocable: true
allowed-tools:
  - WebSearch
  - Read
  - Write
  - Bash(${CLAUDE_SKILL_DIR}/run.sh *)
  - mcp__claude-in-chrome__*
---

# Kiri — Webコンテンツを切り取り、翻訳し、まとめる

引数: `$ARGUMENTS`

## テーマの決定

優先順位：
1. **引数が渡された場合** → それをthemeとして使う（例: `/kiri AI最新ニュース`）
2. **`./kiri.json`がある場合** → そこからtheme・output・imagesを読む
3. **どちらもない場合** → ユーザーに何をまとめたいか聞く

引数のみの場合のデフォルト：
- `output`: `kiri_{{date}}.md`（カレントディレクトリ）
- `images`: `local`（`./kiri_images/`に保存）

## kiri.json（オプション）

繰り返し同じテーマで使う場合に設定ファイルを置ける。

```json
{
  "name": "週刊AIニュース",
  "theme": "AI・LLM・機械学習の最新動向",
  "output": "wiki/ai_news_{{date}}.md",
  "images": "gyazo",
  "instructions": "解説は技術者向けに書く。Obsidianのwiki link形式を使う。"
}
```

- `images: "gyazo"` → Gyazoにアップロード（キーチェーンにトークンが必要）
- `images: "local"` → outputと同じディレクトリに画像を保存
- `instructions` → すべてのフェーズに適用されるカスタム指示

**`./kiri.json`がある場合、`instructions`の内容に必ず従うこと。**

## フロー

### Phase 1: ニュース発見

**Chrome で X タイムラインを巡回:**
1. `tabs_context_mcp` で現在のタブを確認
2. `tabs_create_mcp` で `https://x.com/home` を開く
3. `javascript_tool` でツイートのURL・テキストを抽出
4. theme に関連するツイート・リンクを拾う
5. 必要に応じてスクロールして追加取得

**WebSearch で補完:**
- themeに基づいた検索クエリを生成して検索
- Chrome で見つけられなかった話題を補完

### Phase 2: 厳選

収集したURLから重要な **3〜5件** を厳選。themeに沿って判断。

### Phase 3: 背景調査（各ニュースに対して）

厳選した各ニュースについて、解説を書くための背景を調べる。

- **WebSearch** で関連情報を検索（企業の過去の動向、技術的文脈、業界への影響など）
- **run.sh read** で関連記事の全文を読む
- ツイートの場合はスレッド全体、引用元、リプライの文脈も確認

調査の観点：
- **なぜ今なのか？** — このタイミングで発表された理由や背景
- **何が新しいのか？** — 既存技術との違い、ブレイクスルーの本質
- **誰に影響するのか？** — 開発者・企業・ユーザーへの実用的インパクト
- **文脈は？** — 競合の動き、規制、業界トレンドとの関係

### Phase 4: キャプチャ（各URLに対して繰り返し）

Claude Codeがページ内容を元にセレクタと翻訳を決定する。

**Step 1: ページのテキストを読み取る**
```bash
${CLAUDE_SKILL_DIR}/run.sh read "<url>"
```

**Step 2: 翻訳JSONを書き出し**
```bash
cat > /tmp/sections.json << 'EOF'
[
  { "selector": "h1", "translated": "翻訳タイトル" },
  { "selector": ".intro > p", "translated": "翻訳本文" },
  { "selector": "div.x", "translated": "翻訳テキスト", "capture": false }
]
EOF
```
- `translated` が空文字なら翻訳注入しない
- `capture: false` なら翻訳注入だけしてスクショしない

**Step 3: キャプチャ**

Gyazoモード:
```bash
${CLAUDE_SKILL_DIR}/run.sh "<url>" /tmp/sections.json
```

ローカルモード:
```bash
${CLAUDE_SKILL_DIR}/run.sh "<url>" /tmp/sections.json --local <output_dir>
```

→ 各要素を `element.screenshot()` で撮影。画像URL or ローカルパスが返る。

### Phase 5: Markdownページ生成

出力先パスにMarkdownファイルを作成。

```markdown
# タイトル YYYY年MM月DD日

## 1. 記事タイトル
![](画像URL or パス)
解説テキスト（Phase 3の調査を踏まえて）
→ [原文](元URL)
```

## 注意

- 重複排除: 同じニュースを別ソースから拾わない
- 鮮度重視: 24時間以内のニュースを優先
- 翻訳は原文をそのまま翻訳する。要約しない
- エラー時はスキップして次へ
- Chrome が使えない場合は WebSearch のみで Phase 1 を代替
