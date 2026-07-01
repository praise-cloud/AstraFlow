"""Scrape official retail fuel prices from the State Trading Corporation (STC) of Mauritius."""

from datetime import datetime
from html.parser import HTMLParser
from typing import Optional
import httpx

STC_RETAIL_URL = "https://www.stcmu.com/ppm/retail-prices"
MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def _parse_stc_date(raw: str) -> Optional[datetime]:
    """Parse dates like '16-April-2026', '6-Jul-12', '27-Dec-11'."""
    raw = raw.strip().replace("\u2011", "-").replace("\u2010", "-")
    parts = raw.split("-")
    if len(parts) != 3:
        return None
    day_str, month_str, year_str = parts
    try:
        day = int(day_str)
    except ValueError:
        return None
    month = MONTH_MAP.get(month_str.strip().lower())
    if not month:
        return None
    year_str = year_str.strip()
    if len(year_str) == 2:
        year = 2000 + int(year_str)
    else:
        year = int(year_str)
    if year < 2000 or year > 2030:
        return None
    return datetime(year, month, day)


class _StcTableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.is_price_table = False
        self.tables_seen = 0
        self.current_row: list[str] = []
        self.current_text: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "table" and "table-striped" in attrs_dict.get("class", ""):
            self.in_table = True
            self.tables_seen += 1
            self.rows = []
        if self.in_table and tag in ("td", "th"):
            self.in_cell = True
            self.current_text = []

    def handle_endtag(self, tag):
        if self.in_cell and tag in ("td", "th"):
            self.in_cell = False
            self.current_row.append("".join(self.current_text).strip())
        if self.in_table and tag == "tr":
            if self.current_row:
                self.rows.append(self.current_row)
            self.current_row = []
        if tag == "table" and self.in_table:
            self.in_table = False

    def handle_data(self, data):
        if self.in_cell:
            self.current_text.append(data)


def fetch_retail_prices() -> list[dict]:
    """Fetch and parse retail prices from STC website.

    Returns list of dicts with keys: date, petrol, diesel.
    Prices are in MUR (Mauritian Rupees) per litre.
    """
    try:
        resp = httpx.get(STC_RETAIL_URL, timeout=10, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError:
        return []

    parser = _StcTableParser()
    parser.feed(resp.text)

    results: list[dict] = []
    for row in parser.rows:
        if len(row) < 3:
            continue
        raw_date = row[0]
        mogas_raw = row[1]
        gasoil_raw = row[2]

        dt = _parse_stc_date(raw_date)
        if not dt:
            continue

        try:
            mogas = float(mogas_raw.replace(",", ""))
            gasoil = float(gasoil_raw.replace(",", ""))
        except (ValueError, TypeError):
            continue

        results.append({
            "date": dt,
            "petrol": mogas,
            "diesel": gasoil,
        })

    results.sort(key=lambda r: r["date"], reverse=True)
    return results
