import os
from contextlib import asynccontextmanager
from pathlib import Path
import threading
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.db.database import init_db
from backend.routes import auth, dashboard, predict, prices, surveys, notifications, news, routes
from backend.seed import seed


def _warmup_ml():
    from backend.ml.forecast import get_forecaster
    get_forecaster()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed()
    threading.Thread(target=_warmup_ml, daemon=True).start()
    yield


app = FastAPI(title="AstraFlow API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(predict.router)
app.include_router(prices.router)
app.include_router(surveys.router)
app.include_router(notifications.router)
app.include_router(news.router)
app.include_router(routes.router)


@app.get("/")
def root():
    return {
        "message": "Welcome to AstraFlow API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
