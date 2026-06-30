import html as html_lib
import re
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from backend.db.database import get_db, Base, engine
from backend.models.news import OilNews
from backend.routes.dashboard import get_current_user
from backend.models.user import User
from backend.services.news_scraper import fetch_news

router = APIRouter(prefix="/api/news", tags=["news"])


class NewsCreate(BaseModel):
    title: str
    summary: str
    content: str
    source: str
    image_url: str | None = None


READ_MORE_RE = re.compile(r'\n*Read more: https?://\S+\s*$', re.IGNORECASE)


def _clean_article(raw: dict) -> dict:
    strip_tags = lambda t: re.sub(r'<[^>]+>', '', t).strip() if t else ''
    title = strip_tags(raw.get('title', ''))
    summary = strip_tags(raw.get('summary', ''))
    content = html_lib.unescape(strip_tags(raw.get('content', ''))).replace('\xa0', ' ')
    url = raw.get('url') or None
    if not url:
        m = re.search(r'\n*Read more: (https?://\S+)\s*$', content, re.IGNORECASE)
        if m:
            url = m.group(1)
            content = READ_MORE_RE.sub('', content).strip()
    return {
        "id": raw.get("id"),
        "title": title,
        "summary": summary,
        "content": content,
        "url": url,
        "source": raw.get("source", ""),
        "image_url": raw.get("image_url"),
        "published_at": raw["published_at"].isoformat() if hasattr(raw["published_at"], 'isoformat') else raw["published_at"],
    }


def _ensure_table():
    if not inspect(engine).has_table("oil_news"):
        Base.metadata.create_all(bind=engine)


@router.get("")
def list_news(db: Session = Depends(get_db)):
    _ensure_table()

    newest = db.query(OilNews).order_by(OilNews.published_at.desc()).first()
    should_refresh = newest is None or newest.published_at < date.today()

    if should_refresh:
        fresh = fetch_news()
        if fresh:
            db.query(OilNews).delete()
            for a in fresh:
                db.add(OilNews(
                    title=a["title"],
                    summary=a["summary"],
                    content=a["content"],
                    source=a["source"],
                    published_at=a["published_at"],
                ))
            db.commit()

    articles = db.query(OilNews).order_by(OilNews.published_at.desc()).all()
    return [_clean_article({
        "id": a.id,
        "title": a.title,
        "summary": a.summary,
        "content": a.content,
        "source": a.source,
        "image_url": a.image_url,
        "published_at": a.published_at,
    }) for a in articles]


@router.post("", status_code=201)
def create_news(
    body: NewsCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_table()
    article = OilNews(
        title=body.title,
        summary=body.summary,
        content=body.content,
        source=body.source,
        image_url=body.image_url,
        published_at=date.today(),
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return _clean_article({
        "id": article.id,
        "title": article.title,
        "summary": article.summary,
        "content": article.content,
        "source": article.source,
        "image_url": article.image_url,
        "published_at": article.published_at,
    })
