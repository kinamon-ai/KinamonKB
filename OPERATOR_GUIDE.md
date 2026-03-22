# KinamonKB Operator's Guide

このガイドでは、KinamonKBの環境構築、自律巡回（ニュース収集）、および承認UIの起動手順を詳しく解説します。

---

## 1. 初回セットアップ (Setup)

プロジェクトを初めて動かす際、または依存ライブラリを更新した際に実行します。

### Python 環境の構築 (自動収集用)
ターミナルでプロジェクトのルートディレクトリに移動し、以下のコマンドを実行してください。
```bash
chmod +x scripts/setup_env.sh
./scripts/setup_env.sh
```
これにより、仮想環境 (`venv`) が作成され、RSS収集に必要なライブラリがインストールされます。

### UI の依存関係インストール (初回のみ)
```bash
cd system_ui
npm install
cd ..
```

---

## 2. 自律巡回：ニュースの自動収集 (Patrol)

RSSフィードから最新ニュースを拾い、AIボット「Kina Fox」が判定・2択案の生成を自動で行います。

### 実行コマンド
```bash
./scripts/auto_patrol.sh
```

- **処理の流れ**: `RSSから取得` → `3点チェック判定` → `通過した記事のみ2択MDを生成`。
- **保存先**: 生成されたファイルは `kinamon_kb/03_opinion_gate/_pending/` に保存されます。
- **重複排除**: 一度読み込んだURLは自動的にスキップされます。

---

## 3. 承認UIの起動 (Approval UI)

生成された2択案を確認し、実際に投稿内容を決定（Decide）するための管理画面です。

### 起動コマンド
```bash
cd system_ui
npm run dev
```

### ブラウザでのアクセス
ブラウザを開き、以下のURLにアクセスしてください。
**`http://localhost:3000`**

### UIの使い方
1. **左ペイン (Sidebar)**: 「Pending Tasks」に現在の承認待ち件数が表示されます。
2. **中ペイン (Task List)**: 自動収集されたタスクが並びます。
3. **右ペイン (Task Detail)**:
   - AIが生成したA案/B案と、その根拠を読みます。
   - 画面最下部のテキストエリアで、**実際の投稿内容を直接編集**できます。
   - 「Decide & Post」を押すと、投稿が確定し、タスクが `_decided/` へ移動します。
   - 判断を保留したい場合は「Hold Task」を押すと `Held Tasks` 一覧へ移動します。

---

## 5. 本番運用とリモート操作 (Production & Remote Access)

### Git による管理
プロジェクト全体が Git で管理されています。
1. **GitHub リポジトリ作成**: GitHub で新規リポジトリを作成します。
2. **プッシュ**:
   ```bash
   git remote add origin <あなたのURL>
   git push -u origin main
   ```
※ `node_modules` や `venv` などの巨大なライブラリや一時ファイルは `.gitignore` で自動的に除外されます。

### スマホから操作する (Cloudflare Tunnel)
PCで起動している UI を、家の外（スマホなど）からセキュアに操作する手順です。コードを書き換える必要はありません。

1. **cloudflared をインストール**: 以下のコマンドで CLI 版を直接インストールするのが最も簡単です（Linux x64 の場合）。
   ```bash
   # 実行ファイルをダウンロード
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
   # 実行権限を付与
   chmod +x cloudflared
   # パスの通った場所へ移動
   sudo mv cloudflared /usr/local/bin/
   ```
2. **トンネル起動**:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. **アクセス**: ターミナルに表示される `https://xxxx.trycloudflare.com` のようなURLにスマホからアクセスしてください。
   - これにより、世界中どこからでも承認作業（Decide）が可能になります。
   - 入力した内容はリアルタイムでお手元の PC の `kinamon_kb` に保存されます。

---

## 4. トラブルシューティング

### 429 Error (Too Many Requests / No Capacity)
Gemini API の負荷が高い場合に出るエラーです。
- **対策**: スクリプトには既に `sleep`（待機時間）が組み込まれていますが、それでも頻発する場合は 10分〜15分ほど時間を置いてから再度 `auto_patrol.sh` を実行してください。

### 判定が厳しすぎる / 甘すぎる
- **調整場所**: [.gemini/filter-system.md](file:///home/kinamon/product/KinamonKB/.gemini/filter-system.md) を編集して、判定基準を言語化してください。

### ボットの口調を変えたい
- **調整場所**: [.gemini/bot01-system.md](file:///home/kinamon/product/KinamonKB/.gemini/bot01-system.md) を編集してください。
