import feedparser
import trafilatura
import os
import hashlib
import json
import subprocess
import re
from datetime import datetime
import requests

# --- Configuration ---
RSS_FEEDS_FILE = os.path.join(os.path.dirname(__file__), "rss_feeds.json")
SEEN_URLS_FILE = os.path.join(os.path.dirname(__file__), "seen_urls.txt")
KB_CANDIDATES_DIR = os.path.join(os.path.dirname(__file__), "../kinamon_kb/02_news_candidates")
TMP_DIR = KB_CANDIDATES_DIR
AI_SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "../kinamon_kb/ai_settings.json")

def load_ai_settings():
    if os.path.exists(AI_SETTINGS_FILE):
        with open(AI_SETTINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"active_provider": "gemini"}

def call_llm(prompt, system_content=None, timeout=120, action_key=None):
    """Call LLM and return a tuple of (response_text, provider_used)."""
    settings = load_ai_settings()
    
    # 決定方法: 
    # 1. action_key が指定されており、providers[action_key] が存在すればそれを使う
    # 2. それ以外は active_provider を使う
    provider = settings.get("active_provider", "gemini")
    if action_key and "providers" in settings:
        provider = settings["providers"].get(action_key, provider)
    
    if provider == "gemini":
        cmd = ['gemini', '-p', prompt, '--yolo']
        env = os.environ.copy()
        if system_content:
            # For Gemini CLI, we use a temporary file for system MD
            temp_sys_path = "/tmp/gemini_sys_temp.md"
            with open(temp_sys_path, "w", encoding="utf-8") as f:
                f.write(system_content)
            env['GEMINI_SYSTEM_MD'] = temp_sys_path
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            env=env,
            timeout=timeout
        )
        if result.returncode == 0:
            return (result.stdout, "gemini")
        else:
            print(f"❌ Gemini CLI failed: {result.stderr}")
            return (None, "gemini")
            
    elif provider == "lmstudio":
        url = settings.get("lmstudio_url", "http://localhost:1234/v1/chat/completions")
        model = settings.get("lmstudio_model", "gemma-2-2b-it")
        
        messages = []
        if system_content:
            messages.append({"role": "system", "content": system_content})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.3
        }
        
        try:
            response = requests.post(url, json=payload, timeout=timeout)
            response.raise_for_status()
            data = response.json()
            return (data['choices'][0]['message']['content'], "lmstudio")
        except Exception as e:
            print(f"❌ LMStudio API failed: {e}")
            return (None, "lmstudio")
    
    return (None, provider)

def load_rss_feeds():
    if not os.path.exists(RSS_FEEDS_FILE):
        return []
    with open(RSS_FEEDS_FILE, 'r') as f:
        return json.load(f)

def load_seen_urls():
    if not os.path.exists(SEEN_URLS_FILE):
        return set()
    with open(SEEN_URLS_FILE, 'r') as f:
        return set(line.strip() for line in f if line.strip())

def save_seen_url(url):
    with open(SEEN_URLS_FILE, 'a') as f:
        f.write(url + '\n')

def translate_titles_batch(titles):
    """Translate multiple titles to Japanese using LLM.
    Returns a tuple of (translated_titles, provider_used)."""
    if not titles:
        return ([], "unknown")
    
    # Pass as a numbered list
    numbered_titles = "\n".join(f"{i+1}. {t}" for i, t in enumerate(titles))
    prompt = f"Translate the following news headlines into natural Japanese. Wrap each translated headline in <t> and </t> tags in the exact same order. Do not output any other explanations or formatting.\n\n{numbered_titles}"
    
    output, provider_used = call_llm(prompt, timeout=60, action_key="translation")
    if output:
        import re
        # Extract everything between <t> and </t> using regex
        matches = re.findall(r'<t>(.*?)</t>', output, re.DOTALL)
        
        if matches:
            # Basic cleanup per item
            translated = [t.strip().replace('"', '').replace('「', '').replace('」', '') for t in matches]
            
            if len(translated) == len(titles):
                return (translated, provider_used)
            else:
                print(f"⚠️ Batch translation returned {len(translated)} items instead of {len(titles)}. Falling back to original titles for missing items.")
                while len(translated) < len(titles):
                    translated.append(titles[len(translated)])
                return (translated[:len(titles)], provider_used)
        else:
            print("⚠️ No <t> tags found in batch translation output. Falling back to original titles.")
            return (titles, provider_used)
    else:
        return (titles, provider_used)

# ──────────────────────────────────────────────
# Step 3a: Topic Classification [🤖 AI・軽量]
# ──────────────────────────────────────────────

TOPIC_CLASSIFY_SYSTEM = """あなたは記事のトピック分類器です。タイトルと冒頭を読み、該当するトピックタグを1〜3個選んでください。

## トピック候補
- ai_llm: LLM・生成AI・プロンプト技術・基盤モデル
- ai_tools: AI搭載ツール・開発支援・コーディングAI
- crypto_defi: DeFi・DEX・プロトコル・ブロックチェーン技術
- crypto_regulation: 暗号資産の規制・法律・コンプライアンス
- security: サイバーセキュリティ・ハッキング・脆弱性
- dev_tools: 開発環境・エディタ・OS・CLI
- investment: 投資・マーケット分析・経済指標
- creator_tools: 音楽生成・動画生成・クリエイティブAI
- hardware: ハードウェア・量子コンピュータ・データセンター・半導体
- web_culture: web文化・SNS・メディア論・コンテンツ戦略

## 出力（厳守）
JSON形式のみ。余計な説明不要。
{"topics": ["ai_llm", "security"], "summary_jp": "記事の一行要約（日本語）"}"""

def classify_topic(title_jp, content_snippet):
    """Step 3a: Classify article into topic tags. Lightweight AI call."""
    settings = load_ai_settings()
    ctx_len = settings.get("context_lengths", {}).get("classify", 1000)
    
    snippet = content_snippet[:ctx_len]
    prompt = f"Title: {title_jp}\n\nContent (first {ctx_len} chars):\n{snippet}"
    
    output, provider = call_llm(prompt, system_content=TOPIC_CLASSIFY_SYSTEM, timeout=30, action_key="evaluation")
    
    topics = []
    summary_jp = title_jp  # fallback
    if output:
        try:
            json_str = output.strip()
            if json_str.startswith('```json'): json_str = json_str[7:]
            elif json_str.startswith('```'): json_str = json_str[3:]
            if json_str.endswith('```'): json_str = json_str[:-3]
            match = re.search(r'\{.*\}', json_str, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                topics = data.get('topics', [])
                summary_jp = data.get('summary_jp', title_jp)
        except Exception as e:
            print(f"  ⚠️ Topic classification parse error: {e}")
    return topics, summary_jp, provider


# ──────────────────────────────────────────────
# Step 3b: Bot Matching [⚙️ コード処理・AI不要]
# ──────────────────────────────────────────────

def load_topic_bot_map():
    """Load topic-to-bot mapping from config file."""
    map_path = os.path.join(os.path.dirname(__file__), "../kinamon_kb/01_bots/common/topic_bot_map.json")
    try:
        with open(map_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {"bot_01_observer": ["dev_tools", "ai_tools"]}

def match_bot(topics):
    """Step 3b: Match topics to bot. Pure code logic, no AI needed."""
    topic_map = load_topic_bot_map()
    scores = {}
    for bot_id, bot_topics in topic_map.items():
        scores[bot_id] = len(set(topics) & set(bot_topics))
    if not scores:
        return "bot_01_observer"
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "bot_01_observer"


# ──────────────────────────────────────────────
# Step 3c: Relevance Evaluation [🤖 AI・焦点絞り]
# ──────────────────────────────────────────────

RELEVANCE_EVAL_SYSTEM = """あなたは kinamon の情報フィルターです。3点チェック基準で記事を判定してください。

## 3点チェック
1. 面白いか？: 知的好奇心を刺激するか
2. 役に立つか？: 効率化・問題解決に寄与するか
3. 未来に続くか？: 持続可能な進化か

## 判定ルール
- A (採用): 専門的な深掘り・独自の視点がある
- B (保留): 真に判断不可能な場合のみ（原則禁止）
- C (削除): 初心者向け・一般論・焼き増し

## 出力（厳守）
JSON形式のみ。余計な説明不要。
{"evaluation": "A", "reason": "判定理由（日本語・1行）"}"""

def evaluate_relevance(title_jp, content_snippet):
    """Step 3c: Evaluate article relevance (A/B/C)."""
    settings = load_ai_settings()
    ctx_len = settings.get("context_lengths", {}).get("evaluate", 1500)
    
    snippet = content_snippet[:ctx_len]
    prompt = f"Title: {title_jp}\n\nContent:\n{snippet}"
    
    output, provider = call_llm(prompt, system_content=RELEVANCE_EVAL_SYSTEM, timeout=60, action_key="evaluation")
    
    evaluation = 'B'
    reason = 'Evaluation failed'
    if output:
        try:
            json_str = output.strip()
            if json_str.startswith('```json'): json_str = json_str[7:]
            elif json_str.startswith('```'): json_str = json_str[3:]
            if json_str.endswith('```'): json_str = json_str[:-3]
            match = re.search(r'\{.*\}', json_str, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                evaluation = data.get('evaluation', 'B')
                reason = data.get('reason', 'Parse error')
        except Exception as e:
            print(f"  ⚠️ Relevance evaluation parse error: {e}")
            reason = f"Parse error: {e}"
    return evaluation, reason, provider
def fetch_and_extract():
    seen_urls = load_seen_urls()
    os.makedirs(TMP_DIR, exist_ok=True)
    rss_feeds = load_rss_feeds()
    
    # Phase 1: Collect all articles first (fast)
    collected = []

    for feed_url in rss_feeds:
        print(f"Checking feed: {feed_url}")
        try:
            feed = feedparser.parse(feed_url)

            # Skip invalid feeds that produced no entries or had parse errors
            if feed.bozo and len(feed.entries) == 0:
                print(f"  ⚠️ Skipping invalid feed: {feed_url} ({feed.bozo_exception})")
                continue

            # Take latest 3 entries per feed
            for entry in feed.entries[:3]:
                url = entry.link
                if url in seen_urls:
                    continue
                
                print(f"  New article found: {entry.title}")
                
                # Extract content
                try:
                    downloaded = trafilatura.fetch_url(url)
                except Exception as e:
                    print(f"  ⚠️ Failed to download {url}: {e}")
                    continue

                if not downloaded:
                    print(f"  ⚠️ No content downloaded for: {url}")
                    continue
                    
                content = trafilatura.extract(downloaded)
                if not content:
                    print(f"  ⚠️ No content extracted for: {url}")
                    continue

                collected.append({
                    'title': entry.title,
                    'url': url,
                    'content': content,
                })
                save_seen_url(url)
        except Exception as e:
            print(f"  ⚠️ Skipping feed due to error: {feed_url} ({e})")
            continue

    if not collected:
        print("No new articles collected.")
        return []

    # Phase 2: Translate titles in batch (fast)
    translation_provider = "unknown"
    if collected:
        print(f"Batch translating {len(collected)} titles...")
        jp_titles, translation_provider = translate_titles_batch([article['title'] for article in collected])
        
        # Phase 3: 3-Step Pipeline (Topic → Bot → Relevance)
        print(f"\n--- Phase 3: Processing {len(collected)} articles through pipeline ---")
        pipeline_results = []
        
        for article, jp_title in zip(collected, jp_titles):
            print(f"\n  📰 {jp_title}")
            
            # Step 3a: Topic Classification [🤖 AI・軽量]
            topics, summary_jp, classify_provider = classify_topic(jp_title, article['content'])
            print(f"    3a Topics: {topics} [{classify_provider}]")
            
            # Step 3b: Bot Matching [⚙️ コード処理]
            assigned_bot = match_bot(topics)
            print(f"    3b Bot: {assigned_bot}")
            
            # Step 3c: Relevance Evaluation [🤖 AI・焦点絞り]
            evaluation, reason, eval_provider = evaluate_relevance(jp_title, article['content'])
            print(f"    3c Eval: {evaluation} - {reason[:50]}... [{eval_provider}]")
            
            pipeline_results.append({
                'article': article,
                'jp_title': jp_title,
                'topics': topics,
                'summary_jp': summary_jp,
                'assigned_bot': assigned_bot,
                'evaluation': evaluation,
                'reason': reason,
                'classify_provider': classify_provider,
                'eval_provider': eval_provider,
                'translation_provider': translation_provider,
            })
    else:
        jp_titles = []
        pipeline_results = []

    # Phase 4: Save articles
    new_articles = []
    for result in pipeline_results:
        article = result['article']
        jp_title = result['jp_title']
        
        print(f"\nSaving: {article['title']}")
        print(f"  → {jp_title} [{result['evaluation']}] [Bot: {result['assigned_bot']}]")

        title_slug = "".join(x for x in article['title'] if x.isalnum() or x in " -_").strip().replace(" ", "_")
        if not title_slug:
            title_slug = hashlib.md5(article['url'].encode()).hexdigest()
        
        filename = f"{datetime.now().strftime('%Y%m%d')}_{title_slug[:50]}.txt"
        filepath = os.path.join(TMP_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"Title: {jp_title}\n")
            f.write(f"Evaluation: {result['evaluation']}\n")
            f.write(f"Reason: {result['reason']}\n")
            f.write(f"Assigned Bot: {result['assigned_bot']}\n")
            f.write(f"Topics: {', '.join(result['topics'])}\n")
            f.write(f"Summary: {result['summary_jp']}\n")
            f.write(f"AI Provider (Translation): {result['translation_provider']}\n")
            f.write(f"AI Provider (Classification): {result['classify_provider']}\n")
            f.write(f"AI Provider (Evaluation): {result['eval_provider']}\n")
            f.write(f"Original Title: {article['title']}\n")
            f.write(f"Source: {article['url']}\n\n")
            f.write(article['content'])
        
        new_articles.append(filepath)

    return new_articles

if __name__ == "__main__":
    articles = fetch_and_extract()
    print(f"Finished. Collected {len(articles)} new articles.")
    for path in articles:
        print(f"FILE_PATH:{path}")
