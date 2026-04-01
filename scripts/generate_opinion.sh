#!/usr/bin/env bash
# generate_opinion.sh <input_file_path>
# 記事を読み込み、担当ボットの2択MDを作成して _pending に保存する。

set -e

INPUT_FILE="$1"
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: File not found: $INPUT_FILE" >&2
    exit 1
fi

# 1. 記事情報を読み込み
CONTENT=$(cat "$INPUT_FILE")

# 2. 担当ボットの特定
BOT_ID=$(grep "^Assigned Bot: " "$INPUT_FILE" | head -n 1 | sed 's/Assigned Bot: //' | tr -d '\r ' )
if [ -z "$BOT_ID" ] || [ "$BOT_ID" = "None" ]; then
    BOT_ID="bot_01_observer"
fi

BOT_DIR="kinamon_kb/01_bots/$BOT_ID"
if [ ! -d "$BOT_DIR" ]; then
    BOT_DIR="kinamon_kb/01_bots/bot_01_observer"
    BOT_ID="bot_01_observer"
fi

# ボット用属性の読み込み
BOT_NAME=$(jq -r '.name // "Kina Fox"' "$BOT_DIR/attributes.json" 2>/dev/null || echo "Kina Fox")

# 日付の抽出 (ファイル名が 20260330_... の形式である前提)
FILE_NAME=$(basename "$INPUT_FILE")
DATE_RAW=$(echo "$FILE_NAME" | grep -oP "^\d{8}")
if [ -n "$DATE_RAW" ]; then
    F_DATE="${DATE_RAW:0:4}-${DATE_RAW:4:2}-${DATE_RAW:6:2}"
else
    F_DATE=$(date +%Y-%m-%d)
fi

# 3. AIプロバイダーの設定読み込み
SETTINGS_FILE="kinamon_kb/ai_settings.json"
PROVIDER=$(jq -r '.providers.opinion // .active_provider // "gemini"' "$SETTINGS_FILE")

# システムプロンプトを統合 (Shared + Specific + Template)
TMP_SYSTEM_MD="/tmp/combined_system_${BOT_ID}.md"
cat "kinamon_kb/01_bots/common/shared_knowledge.md" > "$TMP_SYSTEM_MD"
echo -e "\n---\n" >> "$TMP_SYSTEM_MD"
cat "kinamon_kb/01_bots/common/shared_persona.md" >> "$TMP_SYSTEM_MD"
echo -e "\n---\n" >> "$TMP_SYSTEM_MD"

# ボット個別の Persona と Tone を追加
if [ -f "$BOT_DIR/persona.md" ]; then
    cat "$BOT_DIR/persona.md" >> "$TMP_SYSTEM_MD"
    echo -e "\n---\n" >> "$TMP_SYSTEM_MD"
fi
if [ -f "$BOT_DIR/tone_and_voice.md" ]; then
    cat "$BOT_DIR/tone_and_voice.md" >> "$TMP_SYSTEM_MD"
    echo -e "\n---\n" >> "$TMP_SYSTEM_MD"
fi

# ターゲットAIプロバイダーの特定に基づき識別子を作成
if [ "$PROVIDER" = "lmstudio" ]; then
    PROVIDER_DESC="local (lmstudio)"
else
    PROVIDER_DESC="gemini"
fi

# フォーマット用テンプレートを追加し、プレースホルダーを置換
sed "s/{{BOT_ID}}/$BOT_ID/g; s/{{BOT_NAME}}/$BOT_NAME/g; s/{{PROVIDER}}/$PROVIDER_DESC/g" ".gemini/opinion-system-template.md" >> "$TMP_SYSTEM_MD"

echo "Generating opinion for: $(basename "$INPUT_FILE") for Bot: $BOT_ID ($BOT_NAME) using $PROVIDER_DESC..."

PROMPT="あなたは $BOT_NAME です。この記事について、あなたの独自の視点から2択の意見案を生成してください。

## 入力情報
- 今日の日付: $F_DATE
- 記事内容: 
$CONTENT

## 実行タスク
1. 記事の内容を理解し、あなたのキャラクター（$BOT_ID）に沿った解釈を行ってください。
2. 指定されたMarkdownフォーマットを**完全に埋めて**出力してください。
3. フォーマット内の '(Replace this with ...)' や '（...）' という指示テキストは、あなたの生成した文章に**必ず置き換えて**ください。
4. Markdown以外の余計な解説や前置きは一切書かないでください。"

if [ "$PROVIDER" = "lmstudio" ]; then
    URL=$(jq -r '.lmstudio_url // "http://localhost:1234/v1/chat/completions"' "$SETTINGS_FILE")
    MODEL=$(jq -r '.lmstudio_model // "gemma-2-2b-it"' "$SETTINGS_FILE")
    SYSTEM_CONTENT=$(cat "$TMP_SYSTEM_MD")
    
    PAYLOAD=$(jq -n \
        --arg model "$MODEL" \
        --arg system "$SYSTEM_CONTENT" \
        --arg user "$CONTENT" \
        --arg prompt "$PROMPT" \
        '{model: $model, messages: [{role: "system", content: $system}, {role: "user", content: ($prompt + "\n\n" + $user)}], temperature: 0.3}')
    
    RESPONSE_JSON_RAW=$(curl -s -X POST "$URL" -H "Content-Type: application/json" -d "$PAYLOAD")
    # Check if curl succeeded
    if [ $? -ne 0 ] || [ -z "$RESPONSE_JSON_RAW" ]; then
        echo "Error: Failed to connect to LMStudio at $URL" >&2
        exit 1
    fi
    
    CONTENT_RESPONSE=$(echo "$RESPONSE_JSON_RAW" | jq -r '.choices[0].message.content' 2>/dev/null)
    if [ -z "$CONTENT_RESPONSE" ] || [ "$CONTENT_RESPONSE" = "null" ]; then
        echo "Error: Invalid response from LMStudio. Raw response: $RESPONSE_JSON_RAW" >&2
        exit 1
    fi
    RESPONSE_JSON=$(jq -n --arg resp "$CONTENT_RESPONSE" '{response: $resp}')
else
    # Gemini CLI path or command
    RESPONSE_JSON=$(echo "$CONTENT" | GEMINI_SYSTEM_MD="$TMP_SYSTEM_MD" gemini -p "$PROMPT" --output-format json --yolo)
    if [ $? -ne 0 ] || [ -z "$RESPONSE_JSON" ] || [ "$(echo "$RESPONSE_JSON" | jq -r '.response')" = "null" ]; then
        echo "Error: Gemini generation failed or returned invalid JSON. Check your API quota or connection." >&2
        exit 1
    fi
fi

RAW_MD=$(echo "$RESPONSE_JSON" | jq -r '.response')

# 4. 保存先の決定
# ファイル名から不要な記号を除去し、slugを作成
BASE_NAME=$(basename "$INPUT_FILE" | sed 's/\.[^.]*$//' | tr -cd '[:alnum:]_')
OUT_FILE="kinamon_kb/03_opinion_gate/_pending/${F_DATE}_${BOT_ID}_${BASE_NAME}.md"

# 5. 書き出し
# LLMの出力をクリーンアップ（Markdown以外を極力排除）
# ```markdown または ``` で囲まれた部分を抽出
if echo "$RAW_MD" | grep -q "```"; then
    # 最初に出現するコードブロックを抽出
    FINAL_MD=$(echo "$RAW_MD" | sed -n '/^```/,/^```/p' | sed '1d;$d')
    # 行頭マッチでない場合も再試行
    if [ -z "$FINAL_MD" ]; then
        FINAL_MD=$(echo "$RAW_MD" | sed -n '/```/,/```/p' | sed '1d;$d')
    fi
else
    FINAL_MD="$RAW_MD"
fi

# バッククォート単体で残っている場合の最終クリーンアップ
FINAL_MD=$(echo "$FINAL_MD" | grep -v "^```" | sed '/^$/d' | sed -e '1{/^```/d}' -e '${/^```/d}')

# 空ファイル生成の防止
if [ -z "$FINAL_MD" ] || [ "$FINAL_MD" = "null" ]; then
    echo "Error: Generated content is empty. Skipping file creation." >&2
    exit 1
fi

echo "$FINAL_MD" > "$OUT_FILE"

echo "------------------------------------------------"
echo "✅ Successfully generated opinion for $BOT_NAME."
echo "Dest: $OUT_FILE"
echo "------------------------------------------------"

