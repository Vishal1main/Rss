import requests
from bs4 import BeautifulSoup
from telebot import TeleBot
from flask import Flask
import time
import threading

bot = TeleBot("7861502352:AAHeFwHSBzcfknYR4-5SvXdoRSai2K-EFbg")  # Replace with your bot's token
CHANNEL_ID = "-1001991464977"  # Replace with your channel's ID

# Create Flask app
app = Flask(__name__)

visited_links = set()  # To keep track of already processed posts

# Function to scrape download links from a single post
def scrape_download_links(post_url):
    try:
        res = requests.get(post_url, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(res.text, "html.parser")

        # Find all download links in the page (may be in <a> tags, etc.)
        links = {
            "gofile": None,
            "streamtape": None,
            "hubcloud": [],
            "all_cloud": []
        }

        # Scraping GoFile and StreamTape links
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "gofile.io" in href:
                links["gofile"] = href
            elif "streamtape.to" in href:
                links["streamtape"] = href
            elif "hubcloud" in href or "hubdrive" in href or "pixeldrain" in href or "fastserver" in href:
                links["hubcloud"].append(href)
            elif "media.cm" in href or "gdtot" in href or "filepress" in href:
                links["all_cloud"].append(href)

        if any(links.values()):
            return links
        else:
            print(f"No download links found on {post_url}")
            return None
    except Exception as e:
        print(f"Error scraping {post_url}: {e}")
        return None

# Function to fetch the home page and get all movie posts
def fetch_home_page():
    url = "https://hdhub4u.graphics/"
    response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    soup = BeautifulSoup(response.text, "html.parser")

    posts = soup.find_all("h2", class_="post-title")  # Assuming posts are in <h2> with class 'post-title'
    
    for post in posts:
        a_tag = post.find("a")
        if not a_tag:
            continue
        post_url = a_tag["href"]
        
        # Scrape the download links from the individual post page
        if post_url not in visited_links:
            visited_links.add(post_url)
            download_links = scrape_download_links(post_url)
            if download_links:
                title = a_tag.text.strip()

                # Build the message based on the scraped links
                msg = f"🎬 New Post Just Dropped! ✅\n\n" \
                      f"📌 Title: {title}\n"

                if download_links["gofile"]:
                    msg += f"🔰GoFile Link🔰\n• {download_links['gofile']}\n"
                if download_links["streamtape"]:
                    msg += f"🐬Stream Tape Link🐬\n• {download_links['streamtape']}\n"
                
                if download_links["hubcloud"]:
                    msg += f"🚀HubCloud Scraped Links🚀\n"
                    msg += "\n".join([f"• {link}" for link in download_links["hubcloud"]]) + "\n"
                
                if download_links["all_cloud"]:
                    msg += f"♻️All Cloud Links♻️\n"
                    msg += "\n".join([f"• {link}" for link in download_links["all_cloud"]]) + "\n"

                msg += f"\n🌐 Scraped from Sky\n"

                # Send message to Telegram channel
                bot.send_message(CHANNEL_ID, msg, parse_mode="Markdown")

# Function to periodically check for new posts and send download links to Telegram
def check_new_posts():
    while True:
        fetch_home_page()  # Fetch new posts and scrape download links
        time.sleep(600)  # Wait for 10 minutes before checking again

# Run the periodic function in a separate thread to not block the Flask app
def run_check_new_posts():
    threading.Thread(target=check_new_posts).start()

# Flask route to start the bot and handle web server requests
@app.route("/")
def home():
    return "Telegram Bot is running!"

# Start Flask app and the periodic checking
if __name__ == "__main__":
    run_check_new_posts()  # Start the post checking function in the background
    app.run(host="0.0.0.0", port=5000)  # Run Flask on port 5000
