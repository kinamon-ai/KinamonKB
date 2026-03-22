# KinamonKB System UI — 全体ワークフロー仕様

## 📌 概要
KinamonKBは、RSSニュースを起点に、AI（Gemini）が2択の意見記事を生成し、ユーザー（kinamon）が承認・編集した上でX（Twitter）に投稿するまでの一連のフローを管理するダッシュボードです。

---

## 🔄 ワークフロー（5ステージ）

### Stage 1: News Feed（ニュース候補の選別）
- **場所**: サイドバー「News Feed」
- **処理**:
  1. 「**Fetch RSS**」ボタンでRSSフィード（Google Cloud, OpenAI, TechCrunch, SUI, CoinDesk）から最新ニュースを取得
  2. 取得した記事は `_news_candidates/` に `.txt` として保存される
  3. ユーザーが手動でURL・タイトル・内容を追加することも可能（**Manual Add**）
  4. 一覧からチェックボックスで記事を選別（デフォルトは全選択）
  5. 「**Generate Tasks for Selected**」で選択された記事のみを次のステージへ送る
- **内部処理**: `filter_news.sh`（関連性チェック）→ `generate_opinion.sh`（Gemini CLIで2択MD生成）→ `_pending/` に保存

### Stage 2: Pending Tasks（承認待ち）
- **場所**: サイドバー「Pending Tasks」
- **処理**:
  1. AIが生成した**A案・B案**の2択が表示される
  2. ユーザーがどちらかを選択
  3. 投稿文の編集（本文・リンク・ハッシュタグの構成）
  4. 「**Decide & Queue**」で承認し、投稿待ちキューへ移動
- **オプション**: 迷ったら「**Hold**」で保留に回せる

### Stage 3: Held Tasks（保留中）
- **場所**: サイドバー「Held Tasks」
- **処理**:
  1. 保留にしたタスクを後から見直せる
  2. 「**Decide**」で改めて承認フローに進める
  3. 「**Restore to Pending**」でPendingに戻すことも可能

### Stage 4: Post Queue（投稿待ち）
- **場所**: サイドバー「Post Queue」
- **処理**:
  1. 承認済みの最終投稿文を確認
  2. **Post Customization**で微調整:
     - **Include Source Link**: ソースURLを含めるかの切替
     - **Force Unique (Time)**: 重複回避のためタイムスタンプ付加
     - **Hashtags**: カスタムハッシュタグ
  3. 文字数カウンターは**X仕様（URLは一律23文字）**で計算
  4. 「**Post to X**」でX API v2経由で投稿
  5. 投稿成功 → `_decided/` に移動

### Stage 5: Bot Identity（ペルソナ進化）
- **場所**: サイドバー「Bot Identity」
- **処理**:
  1. Decideが一定数（10件）溜まると「Analyze Identity」ボタンが活性化
  2. ユーザーの選択傾向をGeminiが分析し、ボット（Kina Fox）のペルソナ更新案を提案
  3. ユーザーが提案を承認すると `persona.md` に反映

---

## 📁 主要ディレクトリ構成

| パス | 役割 |
|---|---|
| `kinamon_kb/01_bots/bot_01_observer/_news_candidates/` | Stage 1: RSS/手動で追加された未処理ニュース |
| `kinamon_kb/03_opinion_gate/_pending/` | Stage 2: AI生成済みの承認待ちタスク |
| `kinamon_kb/03_opinion_gate/_held/` | Stage 3: 保留中タスク |
| `kinamon_kb/03_opinion_gate/_post_pool/` | Stage 4: 承認済み・投稿待ちタスク |
| `kinamon_kb/03_opinion_gate/_decided/` | 投稿完了アーカイブ |

---

## 🛠️ 主要ファイル

| ファイル | 役割 |
|---|---|
| `scripts/fetch_news.py` | RSSフィードから記事を取得して `_news_candidates/` に保存 |
| `scripts/process_news.sh` | ニュースファイルを受け取り、フィルターと2択生成をキックする |
| `scripts/filter_news.sh` | 関連性フィルター |
| `scripts/generate_opinion.sh` | Gemini CLIで2択記事を生成して `_pending/` に保存 |
| `system_ui/src/lib/actions.ts` | サーバーサイドのファイル操作・プロセス実行・API連携などの各種アクション |
| `system_ui/src/app/page.tsx` | メインのダッシュボードUI（ナビゲーション、ステージ管理） |
| `system_ui/src/components/NewsFeed.tsx` | Stage 1 のUI（リスト表示、手動追加、タスク生成ボタン） |
| `system_ui/src/components/TaskDetail.tsx` | Stage 2/3/4 のタスク詳細表示、編集、投稿用UI |
| `system_ui/src/lib/twitter.ts` | X API v2経由での投稿処理（403エラー対応、文字数制約など） |
