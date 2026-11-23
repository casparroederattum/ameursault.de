"""Read my Substack RSS feed and write the latest posts to posts.json.

Why a script: browsers may not read Substack's feed directly (CORS), so a GitHub
Action runs this once a day and the page just reads the small posts.json file.
Only the Python standard library is used, so there is nothing to install.
"""

import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

# The one thing to change: set this to your publication's feed once you start one,
# e.g. "https://yourname.substack.com/feed". (Nov 2026: this URL still redirects to
# the profile page, which is not a feed, so the script writes an empty list.)
FEED_URL = "https://casparrder1.substack.com/feed"

MAX_POSTS = 5
OUT = Path(__file__).resolve().parent.parent / "posts.json"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ameursault.de feed reader"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def parse(xml_bytes):
    """Turn RSS bytes into [{title, link, date}], newest first. Raises if it isn't RSS."""
    root = ET.fromstring(xml_bytes)
    posts = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title or not link.startswith("http"):
            continue
        try:
            date = parsedate_to_datetime(item.findtext("pubDate")).date().isoformat()
        except (TypeError, ValueError):
            date = ""
        posts.append({"title": title, "link": link, "date": date})
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts[:MAX_POSTS]


def main():
    try:
        posts = parse(fetch(FEED_URL))
    except Exception as err:  # no feed yet, network hiccup, HTML instead of RSS...
        print(f"No usable feed at {FEED_URL} ({err.__class__.__name__}).")
        # Keep the old list on a hiccup; only create an empty one if there is none yet.
        if not OUT.exists():
            OUT.write_text("[]\n")
        return 0  # never fail the Action: the page simply shows "Learning it right now."

    OUT.write_text(json.dumps(posts, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(posts)} posts to {OUT.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
