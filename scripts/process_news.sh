#!/usr/bin/env bash
# process_news.sh <input_file_path>
# 判定 -> 生成 の一連の流れを実行する。

set -e

INPUT_FILE="$1"
SCRIPT_DIR="$(dirname "$0")"

echo "=== Processing News: $(basename "$INPUT_FILE") ==="

# 1. フィルターチェック
if "$SCRIPT_DIR/filter_news.sh" "$INPUT_FILE"; then
    echo "Filter: Passed."
else
    echo "Filter: Failed. Skipping generation."
    exit 0
fi

# 2. 2択生成
echo "Sleeping 5s to avoid rate limits..."
sleep 5
"$SCRIPT_DIR/generate_opinion.sh" "$INPUT_FILE"

echo "=== Finished: $(basename "$INPUT_FILE") ==="
