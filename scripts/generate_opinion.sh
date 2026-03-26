#!/usr/bin/env bash
# generate_opinion.sh <input_file_path>
# 記事を読み込み、Kina Foxの2択MDを作成して _pending に保存する。

set -e

INPUT_FILE="$1"
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: File not found: $INPUT_FILE" >&2
    exit 1
fi

# 1. 記事情報を読み込み
CONTENT=$(cat "$INPUT_FILE")

# 2. Gemini CLI で2択MDを生成 (レイヤー構造の統合)
echo "Generating opinion for: $(basename "$INPUT_FILE")..."

# システムプロンプトを統合 (Shared + Specific)
TMP_SYSTEM_MD="/tmp/combined_system_bot01.md"
cat "kinamon_kb/01_bots/common/shared_knowledge.md" > "$TMP_SYSTEM_MD"
echo -e "\n---\n" >> "$TMP_SYSTEM_MD"
cat "kinamon_kb/01_bots/common/shared_persona.md" >> "$TMP_SYSTEM_MD"
echo -e "\n---\n" >> "$TMP_SYSTEM_MD"
cat ".gemini/bot01-system.md" >> "$TMP_SYSTEM_MD"

RESPONSE_JSON=$(echo "$CONTENT" | GEMINI_SYSTEM_MD="$TMP_SYSTEM_MD" gemini -p "この記事について2択を生成してください。Markdownフォーマット厳守。" --output-format json --yolo)

# jq で .response を取得
RAW_MD=$(echo "$RESPONSE_JSON" | jq -r '.response')

# 3. クリーンアップ (Geminiが ```markdown ... ``` で囲った場合に除去)
FINAL_MD=$(echo "$RAW_MD" | sed '1{/^```/d}; ${/^```/d}')

# 4. 保存先の決定
DATE=$(date +%Y-%m-%d)
# ファイル名から不要な記号を除去し、slugを作成
BASE_NAME=$(basename "$INPUT_FILE" | sed 's/\.[^.]*$//' | tr -cd '[:alnum:]_')
OUT_FILE="kinamon_kb/03_opinion_gate/_pending/${DATE}_${BASE_NAME}.md"

# 5. 書き出し
echo "$FINAL_MD" > "$OUT_FILE"

echo "------------------------------------------------"
echo "✅ Successfully generated opinion."
echo "Dest: $OUT_FILE"
echo "------------------------------------------------"
