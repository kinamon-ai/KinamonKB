#!/usr/bin/env bash
# scripts/auto_patrol.sh
# RSSからニュースを取得し、判定→生成のパイプラインに流し込むマスタースクリプト

set -e

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$SCRIPT_DIR/.."
PYTHON="$PROJECT_ROOT/venv/bin/python"
PROCESS_NEWS="$SCRIPT_DIR/process_news.sh"

echo "=== Starting KinamonKB Auto Patrol: $(date) ==="

# 1. RSSから新しい記事を収集
echo "Fetching news from RSS feeds..."
FETCH_OUTPUT=$($PYTHON "$SCRIPT_DIR/fetch_news.py")

# 2. 抽出されたファイルパスを一つずつ処理
# "FILE_PATH:" で始まる行を探す
while IFS= read -r line; do
    if [[ "$line" == FILE_PATH:* ]]; then
        FILE_PATH="${line#FILE_PATH:}"
        echo "Processing collected file: $FILE_PATH"
        
        # Step 7 のパイプラインを実行
        if [ -f "$FILE_PATH" ]; then
            "$PROCESS_NEWS" "$FILE_PATH"
            # 処理が終わったら一時ファイルを削除
            rm "$FILE_PATH"
            echo "Sleeping 10s before next article..."
            sleep 10
        fi
    fi
done <<< "$FETCH_OUTPUT"

echo "=== Auto Patrol Finished: $(date) ==="
