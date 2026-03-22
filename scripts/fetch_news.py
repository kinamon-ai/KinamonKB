import feedparser
import trafilatura
import os
import hashlib
import json
import subprocess
from datetime import datetime

# --- Configuration ---
RSS_FEEDS_FILE = os.path.join(os.path.dirname(__file__), "rss_feeds.json")
SEEN_URLS_FILE = os.path.join(os.path.dirname(__file__), "seen_urls.txt")
KB_CANDIDATES_DIR = os.path.join(os.path.dirname(__file__), "../kinamon_kb/01_bots/bot_01_observer/_news_candidates")
TMP_DIR = KB_CANDIDATES_DIR

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
    """Translate multiple titles to Japanese using a single Gemini CLI call"""
    if not titles:
        return []
    
    # Pass as a numbered list
    numbered_titles = "\n".join(f"{i+1}. {t}" for i, t in enumerate(titles))
    # Using XML tags (<t>...</t>) avoids the risk of the LLM translating a raw English delimiter string
    prompt = "Translate the following news headlines into natural Japanese. Wrap each translated headline in <t> and </t> tags in the exact same order. Do not output any other explanations or formatting."
    
    try:
        result = subprocess.run(
            ['gemini', '-p', prompt, '--yolo'],
            input=numbered_titles,
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=60  # 60 second timeout for the batch translation
        )
        if result.returncode == 0:
            import re
            output = result.stdout
            
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
            print(f"⚠️ Batch translation failed with return code {result.returncode}")
            return titles
            
    except subprocess.TimeoutExpired:
        print("⚠️ Batch translation timed out. Falling back to original titles.")
        return titles
    except Exception as e:
        print(f"⚠️ Batch translation failed: {e}")
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
        
        env = os.environ.copy()
        # Set the system prompt path
        system_md_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".gemini", "filter-system.md")
        env['GEMINI_SYSTEM_MD'] = system_md_path
        
        prompt = "Evaluate the following articles according to the system instructions. For each article, output the result wrapped in <result id='N'> tags containing EXACTLY a JSON object with 'evaluation' (A, B, or C) and 'reason' (Japanese string). Example: <result id='0'>{\"evaluation\": \"A\", \"reason\": \"...\"}</result>"
        
        try:
            print(f"Batch evaluating {len(batch)} articles (Batch {i // batch_size + 1})...")
            result = subprocess.run(
                ['gemini', '-p', prompt, '--yolo'],
                input=combined_input,
                capture_output=True,
                text=True,
                encoding='utf-8',
                env=env,
                timeout=180 # 3 minutes for batch evaluation
            )
            
            if result.returncode == 0:
                output = result.stdout
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
                            all_evals.append((evaluation, reason))
                        except Exception as e:
                            print(f"⚠️ Failed to parse evaluation JSON for article {idx}: {e}")
                            all_evals.append(('B', "Evaluation parse error"))
                    else:
                        print(f"⚠️ Result tag not found for article {idx}")
                        all_evals.append(('B', "Evaluation tag not found"))
            else:
                print(f"⚠️ Batch evaluation failed with return code {result.returncode}")
                while len(all_evals) < i + len(batch):
                    all_evals.append(('B', "Gemini Error"))
                
        except subprocess.TimeoutExpired:
            print(f"⚠️ Batch evaluation timed out for batch {i // batch_size + 1}")
            while len(all_evals) < i + len(batch):
                all_evals.append(('B', "Evaluation Timeout"))
        except Exception as e:
            print(f"⚠️ Batch evaluation failed: {e}")
            while len(all_evals) < i + len(batch):
                all_evals.append(('B', f"Error: {e}"))
            
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
    for (article_data, (evaluation, reason)) in zip(articles_to_eval, eval_results):
        article = article_data['article_ref']
        jp_title = article_data['jp_title']
        
        print(f"Title: {article['title']}")
        print(f"  → {jp_title}")
        print(f"  → AI: {evaluation} ({reason[:50]}...)")

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
