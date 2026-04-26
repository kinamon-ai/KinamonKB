#!/usr/bin/env bash
# scripts/auto_patrol.sh
# RSSからニュースを取得し、判定→生成のパイプラインに流し込むマスタースクリプト

set -e

SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$SCRIPT_DIR/.."
PYTHON="$PROJECT_ROOT/venv/bin/python"
GENERATE_OPINION="$SCRIPT_DIR/generate_opinion.sh"

LOG_FILE="$PROJECT_ROOT/kinamon_kb/system.log"

run_auto_patrol() {
    echo "=== Starting KinamonKB Auto Patrol: $(date) ==="
    
    # 1. RSSから新しい記事を収集 & 2. 抽出されたチャネルを逐次処理
    echo "Fetching news from RSS feeds..."
    $PYTHON -u "$SCRIPT_DIR/fetch_news.py" | while IFS= read -r line; do
        # 進捗表示
        echo "$line"
        
        if [[ "$line" == FILE_PATH:* ]]; then
            FILE_PATH="${line#FILE_PATH:}"
            echo "------------------------------------------------"
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
            echo "------------------------------------------------"
        fi
    done

    echo "=== Auto Patrol Finished: $(date) ==="
}

# 実行内容を標準出力とsystem.logの両方に流し、ログにはタイムスタンプを付与
# (サブシェル内で処理することで全体をまとめ、sedで全行に時刻を付与)
run_auto_patrol 2>&1 | while IFS= read -r line; do
    echo "$line"
    echo "[$(date '+%Y/%-m/%-d %H:%M:%S')] $line" >> "$LOG_FILE"
done
