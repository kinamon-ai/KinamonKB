#!/usr/bin/env bash
# scripts/auto_patrol.sh
# RSSからニュースを取得し、判定→生成のパイプラインに流し込むマスタースクリプト

set -e

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$SCRIPT_DIR/.."
PYTHON="$PROJECT_ROOT/venv/bin/python"
GENERATE_OPINION="$SCRIPT_DIR/generate_opinion.sh"

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
        
        # 判定結果 (A/B/C) をテキストファイルから読み取る
        if [ -f "$FILE_PATH" ]; then
            EVAL=$(grep "^Evaluation: " "$FILE_PATH" | sed 's/Evaluation: //')
            
            if [ "$EVAL" = "A" ]; then
                echo "AI Evaluation: A (Accept). Generating opinions..."
                "$GENERATE_OPINION" "$FILE_PATH"
                rm "$FILE_PATH"
                echo "Sleeping 10s before next article..."
                sleep 10
            elif [ "$EVAL" = "C" ]; then
                echo "AI Evaluation: C (Delete). Removing article."
                rm "$FILE_PATH"
            else
                echo "AI Evaluation: ${EVAL:-B} (Hold). Keeping file in inbox."
            fi
        fi
    fi
done <<< "$FETCH_OUTPUT"

echo "=== Auto Patrol Finished: $(date) ==="
