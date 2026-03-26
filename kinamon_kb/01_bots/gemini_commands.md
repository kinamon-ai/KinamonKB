# Gemini CLI 使用箇所一覧

プロジェクト内で `gemini` コマンドを呼び出している箇所（全 **6ヶ所**）のコンテキストと、実際に裏側で実行されるコマンドをまとめています。

---

## 1. ニュース見出しの日本語翻訳（バッチ）

- **ファイル**: `scripts/fetch_news.py`（ `translate_titles_batch` 関数 ）
- **呼び出し場面**: RSSから取得した複数の英語ニュースタイトルを、トークン節約と速度向上のためにまとめ（バッチ）てGeminiで自然な日本語に翻訳します。`<t>`タグで区切られた形式で結果を受け取り処理します。

**サンプルコマンド（バッチ処理のイメージ）**:
```bash
echo "1. Title A\n2. Title B" | gemini -p "Translate the following news headlines... Wrap each in <t> tags..." --yolo
```

---

## 2. 記事の重要度判定（バッチフィルタリング）

- **ファイル**: `scripts/fetch_news.py`（ `evaluate_articles_batch` 関数 ）
- **呼び出し場面**: 取得した記事本文がボットの関心に合うか（A/B/C判定）を判定します。効率化のため、最大12記事を一つのプロンプトに含めて一括判定させています。システムプロンプトとして `.gemini/filter-system.md` を使用します。

**サンプルコマンド（バッチ判定）**:
```bash
echo "<article id='0'>...</article><article id='1'>...</article>" | GEMINI_SYSTEM_MD=.gemini/filter-system.md gemini -p "Evaluate the following articles... result wrapped in <result> tags..." --yolo
```

---

## 3. ボットの思考および「2択案（A/B案）」のドラフト生成

- **ファイル**: `scripts/generate_opinion.sh`
- **呼び出し場面**: フィルターを通過した記事について、ボットのペルソナ（`.gemini/bot01-system.md`）に基づき、「どう考えるか」「どんな案で投稿するか」のA案・B案を含むMarkdownファイルを自動生成させます。結果は `--output-format json` で受け取り、`jq` で `.response` フィールドを抽出します。

**サンプルコマンド**:
```bash
echo "$CONTENT" | GEMINI_SYSTEM_MD=.gemini/bot01-system.md gemini -p "この記事について2択を生成してください。Markdownフォーマット厳守。" --output-format json --yolo
```

---

## 4. ユーザーの選択結果とフィードバックの学習（知識蓄積）

- **ファイル**: `system_ui/src/lib/actions.ts` （ `generateFeedback` 関数 ）
- **呼び出し場面**: UI画面でユーザー（kinamon）が「A案/B案」のどちらを選んだか、修正後の最終ポスト内容、およびコメントを分析させ、成功・失敗の知見として `feedback_knowledge.md` に追記するための考察を生成させます。

**サンプルコマンド**:
```bash
echo -e "元の記事・案...\n---\nkinamonの選択: A案\nkinamonの修正後最終ポスト: ...\nkinamonのフィードバック: もっとフランクでOK" | GEMINI_SYSTEM_MD=.gemini/feedback-system.md gemini -p "選択を分析してフィードバックを生成" --output-format json --yolo
```

---

## 5. アイデンティティ（ペルソナ）の自律更新提案

- **ファイル**: `system_ui/src/lib/actions.ts` （ `generateIdentityProposal` 関数 ）
- **呼び出し場面**: 蓄積された過去のフィードバック記録（`feedback_knowledge.md`）、現在のペルソナファイル（`persona.md`）、および成長ログ（`growth_log.md`）を読み込ませ、ボットの性格設定に対する「改善の提案」を自律的に生成させます。提案は `_identity_proposals/` に日付付きMDファイルとして保存されます。

**サンプルコマンド**:
```bash
echo -e "## 現在の persona.md\n...\n---\n## 蓄積された feedback_knowledge.md\n...\n---\n## 分析対象: 合計 15 件の選択記録" | GEMINI_SYSTEM_MD=.gemini/identity-system.md gemini -p "persona.mdへの更新提案を生成してください" --output-format json --yolo
```

---

## 6. ローカルAI移行のための性能比較

- **ファイル**: `ai_local_tester/src/app/api/test-gemini/route.ts`
- **呼び出し場面**: ローカルAI（LMStudio）との回答品質・速度のベンチマークをとるために、既存の `gemini` CLIをサイドバイサイドで実行します。タスク（翻訳・要約・意見生成）に応じてプロンプトを動的に切り替えています。

**サンプルコマンド**:
```bash
echo "$CONTENT" | gemini -p "Summarize the following content in 3 concise lines. Keep the language same as input." --output-format json --yolo
```

---

## 🚀 ローカルAI移行とレイヤー型ナレッジ構造への進化

現在、組織としての AI 知能を最大化し、かつ各ボットの個性を守るために、以下の **「レイヤー型ナレッジ構造（日英ハイブリッド）」** への移行が完了しています。

### 1. 知識のレイヤー構造（Layered Architecture）
- **共通レイヤー (`01_bots/common/`)**: 組織全体で共有される「技術的知見（英語）」と「基本スタイル・禁止事項（日本語）」。
- **個別レイヤー (`01_bots/bot_XX/`)**: 各ボット固有の「独自の解釈ロジック（英語）」と「詳細なキャラクター性・語尾（日本語）」。

### 2. 日英ハイブリッド戦略
- **Thinking (English)**: ニュースの要約や推論、フィードバックの分析などの「論理的な核」は、AIが最も高い推論性能を発揮できる **英語** で蓄積します。
- **Voice (Japanese)**: X (Twitter) 用のポスト原稿や、人間（kinamon）向けの注釈は、ボット固有の **日本語** スタイル（語尾、ニュアンス）を維持します。

### 3. コマンド呼び出しの変更点
- `scripts/fetch_news.py` および `system_ui/src/lib/actions.ts` からの呼び出し時に、**共通知見 (`shared_knowledge.md`)** と **共通スタイル (`shared_persona.md`)** が常にコンテキストとして注入されるようになりました。

### 💡 全体的な実装の特徴
- **`GEMINI_SYSTEM_MD`**: 環境変数による指示の切り替えに加え、複数の知識ベースファイルを動的に結合して渡す高度なインプット管理を行っています。
- **`--yolo`**: 従来通り、自動承認オプションを付加して非同期・一括処理を維持しています。
- **ベンチマーク**: `ai_local_tester` を活用し、この日英ハイブリッド構成がローカルモデルで期待通り（英語の論理、日本語の声）に動作するかを常に検証しています。
