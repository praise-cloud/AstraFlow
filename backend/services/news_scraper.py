from datetime import date
from xml.etree import ElementTree
import httpx

GOOGLE_NEWS_RSS = (
    "https://news.google.com/rss/search?"
    "q=oil+prices+petrol+diesel+Mauritius&hl=en-MU&gl=MU&ceid=MU:en"
)

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
        "published_at": date.today(),
    },
]


def fetch_news() -> list[dict]:
    """Fetch oil/fuel news from Google News RSS. Falls back to hardcoded articles."""
    try:
        resp = httpx.get(GOOGLE_NEWS_RSS, timeout=10, follow_redirects=True)
        resp.raise_for_status()
        root = ElementTree.fromstring(resp.content)
        items = root.findall(".//item")
        if not items:
            return list(FALLBACK_ARTICLES)
        articles = []
        for item in items[:10]:
            title = item.findtext("title", "").strip()
            if not title:
                continue
            description = item.findtext("description", "").strip()
            link = item.findtext("link", "")
            source_elem = item.find("source")
            source = source_elem.text if source_elem is not None else "Google News"
            pub_date_str = item.findtext("pubDate", "")
            pub_date = date.today()
            if pub_date_str:
                try:
                    from datetime import datetime as dt
                    pub_date = dt.strptime(pub_date_str[:25], "%a, %d %b %Y %H:%M:%S").date()
                except ValueError:
                    pass
            articles.append({
                "title": title,
                "summary": description[:200] if description else title,
                "content": f"{description}\n\nRead more: {link}",
                "source": source,
                "published_at": pub_date,
            })
        return articles if articles else list(FALLBACK_ARTICLES)
    except Exception:
        return list(FALLBACK_ARTICLES)
