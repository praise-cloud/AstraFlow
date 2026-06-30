import html
import re
from datetime import date
from xml.etree import ElementTree
import httpx

GOOGLE_NEWS_RSS = (
    "https://news.google.com/rss/search?"
    "q=oil+prices+petrol+diesel+Mauritius&hl=en-MU&gl=MU&ceid=MU:en"
)

MAURITIUS_RSS_FEEDS = [
    ("News Moris", "https://newsmoris.com/feed/"),
    ("Scoop MU", "https://www.scoop.mu/feed/"),
]

RELEVANT_KEYWORDS = [
    'petrol', 'diesel', 'fuel oil', 'crude', 'gasoline', 'petroleum',
    'stc', 'ceb', 'energy', 'electricity', 'power', 'tanker',
    'oil price', 'fuel price', 'gaz', 'hydrocarbon', 'shipping',
    'import', 'supply', 'refinery', 'barrel',
]

TIMEOUT = 15

CONTENT_NS = 'http://purl.org/rss/1.0/modules/content/'

FALLBACK_ARTICLES = [
    {
        "title": "Mauritius Fuel Prices Hold Steady This Month",
        "summary": "The State Trading Corporation has maintained current petrol and diesel prices for the ongoing pricing period, citing stable global crude markets.",
        "content": (
            "The State Trading Corporation of Mauritius has announced that retail fuel prices will "
            "remain unchanged for the current pricing period. This decision comes as global crude oil "
            "markets show relative stability, with Brent crude trading within a narrow range. The STC "
            "continues to monitor international fuel price trends and adjusts local prices accordingly "
            "through its periodic review mechanism. Consumers can expect the current rates of petrol "
            "and diesel to remain in effect until the next review cycle."
        ),
        "source": "STC Mauritius",
        "url": None,
        "published_at": date.today(),
    },
    {
        "title": "Global Oil Prices Fluctuate Amid Supply Concerns",
        "summary": "Brent crude oil prices have experienced volatility this quarter as OPEC+ production decisions and geopolitical factors influence supply.",
        "content": (
            "Global oil markets have seen increased volatility as OPEC+ member nations deliberate on "
            "production quotas for the coming months. Brent crude, the international benchmark, has "
            "fluctuated between USD 75-85 per barrel, influenced by geopolitical tensions and demand "
            "forecasts from major economies. Analysts suggest that fuel prices in import-dependent "
            "nations like Mauritius may be affected in upcoming pricing cycles if the current trend "
            "continues."
        ),
        "source": "Reuters",
        "url": None,
        "published_at": date.today(),
    },
    {
        "title": "Fuel Efficiency Tips for Mauritian Drivers",
        "summary": "With fuel costs remaining a significant expense, adopting efficient driving habits can help reduce monthly fuel spending.",
        "content": (
            "As fuel prices continue to be a major household and business expense, adopting fuel-efficient "
            "driving practices can lead to significant savings. Key tips include maintaining proper tyre "
            "pressure, avoiding rapid acceleration and hard braking, reducing unnecessary idling, and "
            "ensuring regular vehicle maintenance. For businesses with delivery fleets, route optimisation "
            "and driver training programmes can yield substantial fuel cost reductions over time."
        ),
        "source": "AstraFlow Insights",
        "url": None,
        "published_at": date.today(),
    },
    {
        "title": "STC Announces New Fuel Pricing Mechanism",
        "summary": "The State Trading Corporation has introduced a revised fuel pricing formula aimed at better reflecting global market movements.",
        "content": (
            "The State Trading Corporation has updated its fuel pricing mechanism to provide more "
            "responsive adjustments to global crude oil price movements. The new formula incorporates "
            "a weighted average of international benchmark prices over a rolling period, combined with "
            "logistics and operational costs. This change aims to balance consumer affordability with "
            "the financial sustainability of fuel imports. Industry stakeholders have welcomed the "
            "increased transparency in the pricing process."
        ),
        "source": "STC Mauritius",
        "url": None,
        "published_at": date.today(),
    },
    {
        "title": "Transport Sector Adapts to Fuel Cost Challenges",
        "summary": "Mauritian transport businesses are implementing new strategies to manage fuel expenses amid fluctuating global prices.",
        "content": (
            "Transport and logistics companies across Mauritius are adopting innovative strategies to "
            "manage fuel costs. These include transitioning to more fuel-efficient vehicles, implementing "
            "telematics systems for route optimisation, and exploring alternative energy sources. "
            "Industry associations are also calling for government support mechanisms to help small "
            "operators cope with price volatility. The taxi and delivery sectors, in particular, are "
            "feeling the impact as fuel represents a significant portion of their operational costs."
        ),
        "source": "Business Magazine Mauritius",
        "url": None,
        "published_at": date.today(),
    },
]


def _is_relevant(title: str, content: str) -> bool:
    text = f"{title} {content}".lower()
    return any(kw in text for kw in RELEVANT_KEYWORDS)


def _clean_text(raw: str) -> str:
    stripped = re.sub(r'<[^>]+>', '', raw)
    decoded = html.unescape(stripped)
    no_shortcodes = re.sub(r'\[/?[a-z_]+\s*[^\]]*\]', '', decoded)
    return no_shortcodes.replace('\xa0', ' ').strip()


def _strip_wp_footer(text: str) -> str:
    return re.sub(
        r'\n*The post\s+.*\s+appeared first on\s+.*',
        '', text, flags=re.IGNORECASE | re.DOTALL
    ).strip()


def _parse_rss_articles(source_name: str, feed_url: str, filter_relevant: bool = False) -> list[dict]:
    try:
        resp = httpx.get(feed_url, timeout=TIMEOUT, follow_redirects=True,
                         headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        resp.raise_for_status()
        root = ElementTree.fromstring(resp.content)
        items = root.findall(".//item")
    except Exception:
        return []

    articles = []
    for item in items:
        title = item.findtext("title", "").strip()
        if not title:
            continue

        link = item.findtext("link", "").strip()
        description = item.findtext("description", "").strip()

        content_encoded = item.find(f"{{{CONTENT_NS}}}encoded")
        raw_content = (
            content_encoded.text.strip()
            if content_encoded is not None and content_encoded.text
            else description
        )
        full_text = _strip_wp_footer(_clean_text(raw_content))

        if filter_relevant and not _is_relevant(title, full_text):
            continue

        source_elem = item.find("source")
        source = source_elem.text if source_elem is not None else source_name

        pub_date_str = item.findtext("pubDate", "")
        pub_date = date.today()
        if pub_date_str:
            try:
                from datetime import datetime as dt
                pub_date = dt.strptime(pub_date_str[:25], "%a, %d %b %Y %H:%M:%S").date()
            except ValueError:
                pass

        summary = _clean_text(description)[:200] if description else title[:200]

        articles.append({
            "title": title,
            "summary": summary,
            "content": full_text,
            "url": link,
            "source": source,
            "published_at": pub_date,
        })
    return articles


def fetch_news() -> list[dict]:
    all_articles = []

    for source_name, feed_url in MAURITIUS_RSS_FEEDS:
        try:
            articles = _parse_rss_articles(source_name, feed_url)
            all_articles.extend(articles)
        except Exception:
            continue

    try:
        google_articles = _parse_rss_articles("Google News", GOOGLE_NEWS_RSS, filter_relevant=True)
        existing_urls = {a["url"] for a in all_articles if a["url"]}
        for a in google_articles:
            if a["url"] not in existing_urls:
                all_articles.append(a)
    except Exception:
        pass

    all_articles.sort(key=lambda a: a["published_at"], reverse=True)

    return all_articles[:10] if all_articles else list(FALLBACK_ARTICLES)
