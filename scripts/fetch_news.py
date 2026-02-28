import feedparser
import trafilatura
import os
import hashlib
from datetime import datetime

# --- Configuration ---
RSS_FEEDS = [
    "https://cloud.google.com/blog/rss",             # Google Cloud
    "https://openai.com/news/rss.xml",               # OpenAI
    "https://techcrunch.com/category/artificial-intelligence/feed/", # TechCrunch AI
    "https://blog.sui.io/rss/",                      # SUI Blog
    "https://www.coindesk.com/arc/outboundfeeds/rss/" # CoinDesk
]

SEEN_URLS_FILE = "scripts/seen_urls.txt"
TMP_DIR = "scripts/tmp_news"

def load_seen_urls():
    if not os.path.exists(SEEN_URLS_FILE):
        return set()
    with open(SEEN_URLS_FILE, 'r') as f:
        return set(line.strip() for line in f if line.strip())

def save_seen_url(url):
    with open(SEEN_URLS_FILE, 'a') as f:
        f.write(url + '\n')

def fetch_and_extract():
    seen_urls = load_seen_urls()
    os.makedirs(TMP_DIR, exist_ok=True)
    
    new_articles = []

    for feed_url in RSS_FEEDS:
        print(f"Checking feed: {feed_url}")
        feed = feedparser.parse(feed_url)
        
        # Take latest 3 entries per feed to avoid bombardment
        for entry in feed.entries[:3]:
            url = entry.link
            if url in seen_urls:
                continue
            
            print(f"New article found: {entry.title}")
            
            # Extract content
            downloaded = trafilatura.fetch_url(url)
            if not downloaded:
                print(f"Failed to download: {url}")
                continue
                
            content = trafilatura.extract(downloaded)
            if not content:
                print(f"Failed to extract content from: {url}")
                continue

            # Create a filename based on title or URL
            title_slug = "".join(x for x in entry.title if x.isalnum() or x in " -_").strip().replace(" ", "_")
            if not title_slug:
                title_slug = hashlib.md5(url.encode()).hexdigest()
            
            filename = f"{datetime.now().strftime('%Y%m%d')}_{title_slug[:50]}.txt"
            filepath = os.path.join(TMP_DIR, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"Title: {entry.title}\n")
                f.write(f"Source: {url}\n\n")
                f.write(content)
            
            new_articles.append(filepath)
            save_seen_url(url)

    return new_articles

if __name__ == "__main__":
    articles = fetch_and_extract()
    print(f"Finished. Collected {len(articles)} new articles.")
    # Output the list of files for the shell script to process
    for path in articles:
        print(f"FILE_PATH:{path}")
