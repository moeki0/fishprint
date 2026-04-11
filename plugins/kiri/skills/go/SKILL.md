---
name: go
description: Webから情報を収集し、翻訳スクショ・OCR翻訳付きのMarkdownページを生成する。「ニュース」「リサーチ」「まとめ」と言った時に使う。
user-invocable: true
allowed-tools:
  - WebSearch
  - Read
  - Write
  - Bash(kiri-read *)
  - Bash(kiri-capture *)
  - Bash(kiri-ocr *)
  - Bash(mkdir *)
  - Bash(ls *)
  - Bash(head *)
  - Write(/tmp/*)
  - mcp__claude-in-chrome__*
---

# Kiri — Webコンテンツを切り取り、翻訳し、まとめる

引数: `$ARGUMENTS`

## 思想

**画像が主役。テキストは添え物。**

Kiriの出力はスクラップブックのようなもの。Webページから重要な部分を画像として大量に切り抜き、翻訳を注入して並べることで、情報の臨場感をそのまま伝える。

- 切り抜きは多ければ多いほどいい。ケチらない
- タイトル、本文、図表、チャート、画像、ツイート——すべてスクショで切り取る
- 翻訳はスクショ内に注入済みなので、読者は画像を見るだけで内容がわかる
- テキストの解説は、画像だけでは伝わらない文脈や補足が本当に必要な時だけ1〜2行

## テーマの決定

優先順位：
1. **引数が渡された場合** → それをthemeとして使う（例: `/kiri:go AI最新ニュース`）
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
  "sources": ["web", "x"],
  "instructions": "解説は技術者向けに書く。Obsidianのwiki link形式を使う。"
}
```

- `images`: `"gyazo"` or `"local"`。Gyazoはキーチェーンにトークンが必要
- `sources`: 情報収集に使うソースの配列。デフォルト`["web"]`
  - `"web"` → WebSearchで検索
  - `"x"` → Chrome（claude-in-chrome MCP）でXタイムラインを巡回。Chrome拡張が必要
- `instructions` → すべてのフェーズに適用されるカスタム指示

**`./kiri.json`がある場合、`instructions`の内容に必ず従うこと。**

## フロー

### Phase 1: 情報収集

`sources`の設定に応じて情報を集める。

**`"web"`が含まれる場合（デフォルト）:**
- WebSearchでthemeに基づいた検索クエリを生成して検索

**`"x"`が含まれる場合（claude-in-chrome MCPが必要）:**
1. `tabs_context_mcp` で現在のタブを確認
2. `tabs_create_mcp` で `https://x.com/home` を開く
3. `javascript_tool` でツイートのURL・テキストを抽出
4. theme に関連するツイート・リンクを拾う
5. 必要に応じてスクロールして追加取得

### Phase 2: 厳選

収集したURLから重要な **3〜5件** を厳選。themeに沿って判断。

### Phase 3: 背景調査（各トピックに対して）

厳選した各トピックについて、背景を調べる。ただし解説を長く書くためではなく、切り抜くべき箇所を判断するため。

- **WebSearch** で関連情報を検索
- **kiri-read** で関連記事の全文を読む
- ツイートの場合はスレッド全体、引用元の文脈も確認

### Phase 4: キャプチャ（各URLに対して繰り返し）

**ここが一番重要。切り抜きを大量に撮る。**

Claude Codeがページ内容を元にセレクタと翻訳を決定する。1つの記事から5〜10個の切り抜きを撮るくらいの気持ちで。

**Step 1: ページのテキストを読み取る**
```bash
kiri-read "<url>"
```

**Step 2: 翻訳JSONを書き出し（Writeツールを使う。catは使わない）**

Writeツールで `/tmp/sections.json` を作成する。**切り抜きは多めに。**

```json
[
  { "selector": "h1", "translated": "翻訳タイトル" },
  { "selector": "article p:nth-of-type(1)", "translated": "翻訳リード文" },
  { "selector": "article p:nth-of-type(2)", "translated": "翻訳2段落目" },
  { "selector": "article p:nth-of-type(3)", "translated": "翻訳3段落目" },
  { "selector": "figure img", "translated": "" },
  { "selector": "article img:nth-of-type(1)", "translated": "" },
  { "selector": "blockquote", "translated": "翻訳引用" },
  { "selector": ".chart-container", "translated": "" }
]
```
- `translated` が空文字なら翻訳注入しない（画像はそのまま撮る）
- `capture: false` なら翻訳注入だけしてスクショしない

**Step 3: キャプチャ**

Gyazoモード:
```bash
kiri-capture "<url>" /tmp/sections.json
```

ローカルモード:
```bash
kiri-capture "<url>" /tmp/sections.json --local <output_dir>
```

→ 各要素を `element.screenshot()` で撮影。画像URL or ローカルパスが返る。

**Step 4: 画像のOCR翻訳（必要な場合）**

英語テキストを含むチャートや図表はOCRで翻訳オーバーレイ：
```bash
kiri-ocr <image_path>
```
→ OCR結果を元に翻訳JSONを作成し、オーバーレイを適用：
```bash
kiri-ocr <image_path> /tmp/translations.json
```

### Phase 5: Markdownページ生成

出力先パスにMarkdownファイルを作成。**画像中心。テキストは最小限。**

```markdown
![](タイトルの切り抜き画像)
![](リード文の切り抜き)
![](図表)
![](本文の切り抜き)
![](画像)
補足が本当に必要な時だけ1行
→ [原文](元URL)

---

![](次の記事のタイトル切り抜き)
![](本文の切り抜き)
→ [原文](元URL)
```

- **タイトルもテキストで書かない。タイトル要素を切り抜いて画像で見せる**
- 画像をどんどん並べる。画像が語る
- `---`で記事を区切る
- テキストの解説は画像だけでは伝わらない文脈がある時だけ
- 原文リンクは必ず付ける

## 注意

- **Bashコマンドは`&&`や`|`で繋がず、1つずつ個別に呼ぶこと。** 許可パターンにマッチしなくなる
- 重複排除: 同じトピックを別ソースから拾わない
- themeに応じて鮮度を判断する（ニュースなら直近、リサーチなら期間不問）
- 翻訳は原文をそのまま翻訳する。要約しない
- エラー時はスキップして次へ
- Chrome が使えない場合は WebSearch のみで Phase 1 を代替
