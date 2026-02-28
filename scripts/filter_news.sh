#!/usr/bin/env bash
# filter_news.sh <input_file_path>
# 3点チェック判定を行い、結果(true/false)を返す。

set -e

INPUT_FILE="$1"
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: File not found: $INPUT_FILE" >&2
    exit 1
fi

# 1. 判定実行
RESPONSE_JSON=$(cat "$INPUT_FILE" | GEMINI_SYSTEM_MD=.gemini/filter-system.md gemini -p "3点チェックで判定してください" --output-format json --yolo)

# 2. 階層を潜って AI の回答(response)を取り出し、マークダウンの囲みを除去
RAW_RES=$(echo "$RESPONSE_JSON" | jq -r '.response')
CLEAN_JSON=$(echo "$RAW_RES" | sed '1{/^```/d}; ${/^```/d}')

# 3. 再度 jq で pass と reason の値を取得
PASS=$(echo "$CLEAN_JSON" | jq -r '.pass')
REASON=$(echo "$CLEAN_JSON" | jq -r '.reason')

# 3. 結果を標準出力に（呼び出し元が使いやすい形式で）
if [ "$PASS" = "true" ]; then
    echo "PASS: $REASON"
    exit 0
else
    echo "FAIL: $REASON"
    exit 1
fi
