import feedparser
import trafilatura
import os
import hashlib
import json
import subprocess
from datetime import datetime
import requests

# --- Configuration ---
RSS_FEEDS_FILE = os.path.join(os.path.dirname(__file__), "rss_feeds.json")
SEEN_URLS_FILE = os.path.join(os.path.dirname(__file__), "seen_urls.txt")
KB_CANDIDATES_DIR = os.path.join(os.path.dirname(__file__), "../kinamon_kb/01_bots/bot_01_observer/_news_candidates")
TMP_DIR = KB_CANDIDATES_DIR
AI_SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "../kinamon_kb/ai_settings.json")

def load_ai_settings():
    if os.path.exists(AI_SETTINGS_FILE):
        with open(AI_SETTINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"active_provider": "gemini"}

def call_llm(prompt, system_content=None, timeout=120, action_key=None):
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
            return result.stdout
        else:
            print(f"❌ Gemini CLI failed: {result.stderr}")
            return None
            
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
            return data['choices'][0]['message']['content']
        except Exception as e:
            print(f"❌ LMStudio API failed: {e}")
            return None
    
    return None

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
    """Translate multiple titles to Japanese using LLM"""
    if not titles:
        return []
    
    # Pass as a numbered list
    numbered_titles = "\n".join(f"{i+1}. {t}" for i, t in enumerate(titles))
    prompt = f"Translate the following news headlines into natural Japanese. Wrap each translated headline in <t> and </t> tags in the exact same order. Do not output any other explanations or formatting.\n\n{numbered_titles}"
    
    output = call_llm(prompt, timeout=60, action_key="translation")
    if output:
        import re
        # Extract everything between <t> and </t> using regex
        matches = re.findall(r'<t>(.*?)</t>', output, re.DOTALL)
        
        if matches:
            # Basic cleanup per item
            translated = [t.strip().replace('"', '').replace('「', '').replace('」', '') for t in matches]
            
            if len(translated) == len(titles):
                return translated
            else:
                print(f"⚠️ Batch translation returned {len(translated)} items instead of {len(titles)}. Falling back to original titles for missing items.")
                while len(translated) < len(titles):
                    translated.append(titles[len(translated)])
                return translated[:len(titles)]
        else:
            print("⚠️ No <t> tags found in batch translation output. Falling back to original titles.")
            return titles
    else:
        return titles

def evaluate_articles_batch(articles_data):
    """Evaluate multiple articles in a single Gemini call to save time and tokens"""
    if not articles_data:
        return []
    
    # 10-12 articles at a time is a safe batch size
    batch_size = 12
    all_evals = []
    
    for i in range(0, len(articles_data), batch_size):
        batch = articles_data[i: i + batch_size]
        
        # Prepare the combined input
        input_texts = []
        for idx, item in enumerate(batch):
            jp_title = item['jp_title']
            content = item['content'][:3000] # Slightly shorter to fit more in batch
            input_texts.append(f"<article id='{idx}'>\nTitle: {jp_title}\n\nContent:\n{content}\n</article>")
        
        combined_input = "\n\n".join(input_texts)
        
        # Combine system prompts (Shared + Specific)
        base_dir = os.path.dirname(os.path.dirname(__file__))
        shared_kb = os.path.join(base_dir, "kinamon_kb", "01_bots", "common", "shared_knowledge.md")
        shared_persona = os.path.join(base_dir, "kinamon_kb", "01_bots", "common", "shared_persona.md")
        filter_system = os.path.join(base_dir, ".gemini", "filter-system.md")
        
        system_content = ""
        
        # Build dynamic bot hobbies prompt
        bots_dir = os.path.join(base_dir, "kinamon_kb", "01_bots")
        bot_hobbies_prompt = "### Bot Interests (Hobby)\nIf an article correlates with any of the hobbies below, evaluate it as 'A' and assign the corresponding bot id to 'assigned_bot'.\n"
        try:
            for bot_id in sorted(os.listdir(bots_dir)):
                if bot_id.startswith("bot_"):
                    attr_path = os.path.join(bots_dir, bot_id, "attributes.json")
                    if os.path.exists(attr_path):
                        with open(attr_path, "r", encoding="utf-8") as bf:
                            hobby_str = json.load(bf).get("hobby", "")
                            if hobby_str:
                                bot_hobbies_prompt += f"- {bot_id}: {hobby_str}\n"
        except Exception as e:
            print(f"Warning: Failed to load bot hobbies: {e}")
            
        system_content += bot_hobbies_prompt + "\n\n---\n\n"

        for p in [shared_kb, shared_persona, filter_system]:
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f_in:
                    system_content += f_in.read() + "\n\n---\n\n"
        
        prompt = "Evaluate the following articles according to the system instructions. For each article, output the result wrapped in <result id='N'> tags containing EXACTLY a JSON object with 'evaluation' (A, B, or C), 'reason' (Japanese string), and 'assigned_bot' (matching bot_id or null). Example: <result id='0'>{\"evaluation\": \"A\", \"reason\": \"...\", \"assigned_bot\": \"bot_01_observer\"}</result>\n\n" + combined_input
        
        try:
            output = call_llm(prompt, system_content=system_content, timeout=180, action_key="evaluation")
                
            if output:
                import re
                for idx in range(len(batch)):
                        # Extract JSON from <result id='idx'>...</result>
                        pattern = rf"<result id=['\"]?{idx}['\"]?>(.*?)</result>"
                        match = re.search(pattern, output, re.DOTALL)
                        
                        if match:
                            json_str = match.group(1).strip()
                            try:
                                # Clean up potential markdown formatting within tags
                                if json_str.startswith('```json'): json_str = json_str[7:]
                                elif json_str.startswith('```'): json_str = json_str[3:]
                                if json_str.endswith('```'): json_str = json_str[:-3]
                                
                                eval_data = json.loads(json_str.strip())
                                evaluation = eval_data.get('evaluation', 'B')
                                reason = eval_data.get('reason', 'Automatic fallback (Parse error)')
                                assigned_bot = eval_data.get('assigned_bot')
                                all_evals.append((evaluation, reason, assigned_bot))
                            except Exception as e:
                                print(f"⚠️ Failed to parse evaluation JSON for article {idx}: {e}")
                                all_evals.append(('B', "Evaluation parse error", None))
                        else:
                            print(f"⚠️ Result tag not found for article {idx}")
                            all_evals.append(('B', "Evaluation tag not found", None))
            else:
                print(f"⚠️ Batch evaluation failed (no output)")
                while len(all_evals) < i + len(batch):
                    all_evals.append(('B', "Gemini Error", None))
                    
        except subprocess.TimeoutExpired:
            print(f"⚠️ Batch evaluation timed out for batch {i // batch_size + 1}")
            while len(all_evals) < i + len(batch):
                all_evals.append(('B', "Evaluation Timeout", None))
        except Exception as e:
            print(f"⚠️ Batch evaluation failed: {e}")
            while len(all_evals) < i + len(batch):
                all_evals.append(('B', f"Error: {e}", None))
            
    return all_evals
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
    if collected:
        print(f"Batch translating {len(collected)} titles...")
        jp_titles = translate_titles_batch([article['title'] for article in collected])
        
        # Phase 3: Evaluate articles in batch (fast)
        articles_to_eval = []
        for article, jp_title in zip(collected, jp_titles):
            articles_to_eval.append({
                'jp_title': jp_title,
                'content': article['content'],
                'article_ref': article # Keep reference for Phase 4
            })
        
        eval_results = evaluate_articles_batch(articles_to_eval)
    else:
        jp_titles = []
        eval_results = []

    # Phase 4: Save articles
    new_articles = []
    for (article_data, (evaluation, reason, assigned_bot)) in zip(articles_to_eval, eval_results):
        article = article_data['article_ref']
        jp_title = article_data['jp_title']
        
        print(f"Title: {article['title']}")
        print(f"  → {jp_title}")
        print(f"  → AI: {evaluation} ({reason[:50]}...) [Bot: {assigned_bot}]")

        # Create a filename
        title_slug = "".join(x for x in article['title'] if x.isalnum() or x in " -_").strip().replace(" ", "_")
        if not title_slug:
            title_slug = hashlib.md5(article['url'].encode()).hexdigest()
        
        filename = f"{datetime.now().strftime('%Y%m%d')}_{title_slug[:50]}.txt"
        filepath = os.path.join(TMP_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"Title: {jp_title}\n")
            f.write(f"Evaluation: {evaluation}\n")
            f.write(f"Reason: {reason}\n")
            f.write(f"Assigned Bot: {assigned_bot or 'None'}\n")
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
