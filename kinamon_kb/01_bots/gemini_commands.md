# Gemini CLI 使用箇所一覧

プロジェクト内のファイル構成とソースコードにおける `gemini` コマンドの使用箇所（全 **5ヶ所**）のコンテキストと、実際に裏側で実行されているサンプルコマンドをまとめています。

（※既存の4件に加え、Pythonスクリプト側での「見出し翻訳」の呼び出しも1件存在します）

---

## 1. ニュース見出しの日本語翻訳

- **ファイル**: `scripts/fetch_news.py`（ `translate_title` 関数 ）
- **呼び出し場面**: RSSから取得した英語のニュース記事タイトルを、Geminiを使って自然な日本語に1行で翻訳する用途で使われています。標準入力にテキストを渡し、Pythonの `subprocess` 経由で実行されています。

**サンプルコマンド（シェル表現）**:
```bash
echo "OpenAI Announces New Model" | gemini -p "Translate this news headline into natural Japanese. Give ONLY the translation in ONE LINE. No explanation: OpenAI Announces New Model" --yolo
```

---

## 2. 記事の重要度判定（ノイズフィルタリング）

- **ファイル**: `scripts/filter_news.sh`
- **呼び出し場面**: ダウンロードしたニュース記事の本文が、ボットの興味関心に合致しているかを判定する処理（3点チェック）です。結果をプログラム側で処理しやすいように `--output-format json` で返させています。

**サンプルコマンド**:
```bash
cat article.txt | GEMINI_SYSTEM_MD=.gemini/filter-system.md gemini -p "3点チェックで判定してください" --output-format json --yolo
```

---

## 3. ボットの思考および「2択案（A/B案）」のドラフト生成

- **ファイル**: `scripts/generate_opinion.sh`
- **呼び出し場面**: フィルターを通過した記事について、ボットのペルソナ（`.gemini/bot01-system.md`）に基づき、「どう考えるか」「どんな案で投稿するか」のA案・B案を含むMarkdownファイルを自動生成させます。

**サンプルコマンド**:
```bash
echo "$CONTENT" | GEMINI_SYSTEM_MD=.gemini/bot01-system.md gemini -p "この記事について2択を生成してください。Markdownフォーマット厳守。" --output-format json --yolo
```

---

## 4. ユーザーの選択結果とフィードバックの学習（知識蓄積）

- **ファイル**: `system_ui/src/lib/actions.ts` （ `generateFeedback` 関数 ）
- **呼び出し場面**: UI画面でユーザー（kinamon）が「A案/B案」のどちらを選んだか、またどんなコメントを付与したかを分析させ、成功・失敗の知見として `feedback_knowledge.md` に書き込むための考察を生成させます。

**サンプルコマンド**:
```bash
# Node.js側で組み立てられた文章をechoでパイプに流し込みます
echo -e "元の記事・案...\n---\nkinamonの選択: A案\nkinamonのフィードバック: もっとフランクでOK" | GEMINI_SYSTEM_MD=.gemini/feedback-system.md gemini -p "選択を分析してフィードバックを生成" --output-format json --yolo
```

---

## 5. アイデンティティ（ペルソナ）の自律更新提案

- **ファイル**: `system_ui/src/lib/actions.ts` （ `generateIdentityProposal` 関数 ）
- **呼び出し場面**: 蓄積された過去のフィードバック記録（`feedback_knowledge.md`）と現在のペルソナファイル（`persona.md`）を読み込ませ、現在のボットの性格設定（プロンプト）に対する「改善の提案」を自律的に生成させます。

**サンプルコマンド**:
```bash
echo -e "## 現在の persona.md\n...\n---\n## 蓄積された feedback_knowledge.md\n...\n---\n## 分析対象: 合計 15 件の選択記録" | GEMINI_SYSTEM_MD=.gemini/identity-system.md gemini -p "persona.mdへの更新提案を生成してください" --output-format json --yolo
```

---

**💡 全体的な実装の特徴**:
どこの呼び出しでも、対話待ちで処理が止まるのを防ぐために `--yolo`（自動承認）オプションが使われています。また、システムプロンプト（指示の根幹）を切り替えるために、各コマンド実行時に環境変数 `GEMINI_SYSTEM_MD=...` を渡して専用の指示を読み込ませる綺麗な実装パターンとなっています。
