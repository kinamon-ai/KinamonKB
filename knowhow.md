記事要約用の「固定プロンプト＋最小トークン消費」のワークフローは、(1) systemプロンプトをファイル化、(2) 非対話モードで要約、(3) シェルスクリプトで入出力とファイル名を自動化、という流れで組むのが効率的です。 [github](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md)

***

## 1. 固定指示を system プロンプトとして外出し

1. 一度デフォルト system プロンプトを書き出す  
   ```bash
   GEMINI_WRITE_SYSTEM_MD=1 gemini
   ```  
   これでカレントディレクトリの `.gemini/system.md` に現在の組み込みプロンプトが出力されます。 [github](https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/configuration.md)

2. `.gemini/system.md` を編集して、要約専用の固定指示を追記／書き換え  
   例（イメージ）  
   - 記事要約専用の役割  
   - 出力フォーマット（見出し＋箇条書きなど）  
   - 文字数・トーン・日本語指定 など  
   systemプロンプトは毎回送信される「最初のメッセージ」なので、ここに役割付け等を集約しておけば、プロンプト側に余計な指示を書かずに済みます。 [github](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md)

3. プロジェクト単位で使いたい場合  
   - 各プロジェクトのルートに `.gemini/system.md` を置いておき、そのディレクトリで gemini CLI を叩く運用にします。 [github](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md)
   - 別パスを使いたいなら  
     ```bash
     export GEMINI_SYSTEM_MD=/path/to/summary-system.md
     ```  
     のように環境変数で指定できます。 [geminicli](https://geminicli.com/docs/cli/system-prompt/)

***

## 2. 非対話モードで「要約だけ」させる基本形

記事要約用の最小形は、例えば以下のどれかです。 [codelabs.developers.google](https://codelabs.developers.google.com/gemini-cli-hands-on)

- 標準入力からテキストを流し込む  
  ```bash
  cat input.txt | gemini "この記事を要約してください。重要なポイントを3〜5個の箇条書きにしてください。"
  ```  
  ただし、固定の要約スタイルを system.md に全部書いておけば、ここは単に  
  ```bash
  cat input.txt | gemini "要約"
  ```  
  くらいまで削れるのでトークン消費を抑えられます。

- 引数にテキストを直接渡す（短文向け）  
  ```bash
  gemini -p "以下を要約: ${TEXT}"
  ```  
  文字数が長い記事なら、引数より標準入力＋`cat`の方が安全です。

***

## 3. 出力をフォルダ階層＋命名規則でファイル保存

シェル側で「パス＋ファイル名生成→ gemini 実行→リダイレクト保存」を行うのがシンプルです。

例:  
- 入力: `/path/to/articles/2026/02/22/news01.txt`  
- 出力: `/path/to/summaries/2026/02/22/news01.summary.txt`

```bash
#!/usr/bin/env bash
set -e

INPUT="$1"   # 記事テキストファイル
BASE_OUT_DIR="/path/to/summaries"

if [ ! -f "$INPUT" ]; then
  echo "Input file not found: $INPUT" >&2
  exit 1
fi

# 日付階層を入力側と揃える例（パス構造に依存して調整）
REL_PATH="${INPUT#/path/to/articles/}"   # articles以下の相対パス
DIR_PART="$(dirname "$REL_PATH")"        # 例: 2026/02/22
FILE_BASE="$(basename "$REL_PATH" .txt)" # 例: news01

OUT_DIR="$BASE_OUT_DIR/$DIR_PART"
mkdir -p "$OUT_DIR"

OUT_FILE="$OUT_DIR/${FILE_BASE}.summary.txt"

# 最小プロンプトで要約（詳細ルールは system.md に書く）
cat "$INPUT" | gemini "要約" > "$OUT_FILE"
echo "Saved summary to: $OUT_FILE"
```

このスクリプトを `summarize-article` などの名前で保存し、実行権限を付与:

```bash
chmod +x summarize-article
./summarize-article /path/to/articles/2026/02/22/news01.txt
```

命名規則案:
- `{元ファイル名}.summary.txt`
- `{日付}-{slug}-summary.txt`
- プレフィックス付き `summary_{元ファイル名}.txt` など  
は好みで変えればOKです。

***

## 4. 固定指示を完全に「静的化」してトークン削減する考え方

トークン削減・安定性の観点では:

- **system.md にできるだけ多くのルールを書く**  
  役割、文体、出力形式（見出し階層、箇条書き数、禁止事項など）はすべて system 側に寄せる。 [github](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md)

- ユーザープロンプトはパラメータだけに絞る  
  - 例: `"要約"` だけ  
  - 場合によっては `"要約（短め）"` `"要約（技術的な詳細を重視）"` のような「モード切り替え」程度に留める  

- プロジェクトが複数ある場合  
  - プロジェクトごとに `.gemini/system.md` を分ける  
  - もしくは `GEMINI_SYSTEM_MD` をスクリプト内で切り替え  
    ```bash
    GEMINI_SYSTEM_MD=~/.gemini/article-summary.md \
      cat "$INPUT" | gemini "要約" > "$OUT_FILE"
    ```

***

## 5. もう一歩踏み込んだ自動化のアイデア

- 入力がURLの場合:  
  `curl` や `lynx -dump` などで本文をテキスト化してから同じパイプに流し込む。
- バッチ処理:  
  ディレクトリ内の全記事を一括要約するループを書く:
  ```bash
  find /path/to/articles -name '*.txt' | while read -r f; do
    ./summarize-article "$f"
  done
  ```
- 既に要約ファイルがある場合はスキップ:  
  スクリプト先頭で `[ -f "$OUT_FILE" ] && continue` のようなチェックを追加。

***

## 6. バッチ処理によるAPI呼び出しの最適化（軽量テキストの一括処理）

Gemini CLI は呼び出し（サブプロセス起動やネットワーク接続）ごとにオーバーヘッドとトークン消費が生じるため、**短いテキストをループ内で何度も gemini コマンドで呼び出すのは最大のアンチパターン**です。深刻な遅延や API 限度（Rate Limit）エラーの原因になります。

**解決策（XMLタグを用いた一括処理）**:
ニュースの見出しなど軽量なテキストが複数（例えば10件）ある場合、それらをリスト形式でプロンプトに結合し、**1回の gemini 呼び出しで全てを処理**させます。このとき、単なる区切り文字（例: `===SPLIT===`）だとLLMが翻訳処理中に「===分割===」等と言語変換してしまうリスクがあるため、**XMLタグ（例: `<t>` と `</t>`）で各結果を囲ませる手法**が非常に堅牢（Robust）です。

**プロンプトの工夫例**:
```bash
cat << 'EOF' | gemini "以下の複数のニュース見出しを自然な日本語に翻訳してください。出力は元の順番通りに、各見出しを <t> と </t> のタグで囲んで出力してください。説明は不要です。"
1. Heading 1
2. Heading 2
3. Heading 3
EOF
```
このように指示することで、10回のAPIコールを1回に減らし、劇的な高速化とコストの最小化を実現できます。出力された結果は、プログラム側で正規表現（例: `re.findall(r'<t>(.*?)</t>', output, re.DOTALL)`）を使って正確に抽出し、元の配列データとマッピングして利用します。

***

もし「system.md に具体的にどこまで書くか（テンプレ）」を一緒に設計したい場合、想定している記事ジャンル（ニュース・技術記事・法律文書など）を教えてもらえれば、そこも詰めた案を出します。