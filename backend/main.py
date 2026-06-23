from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import logging
logging.basicConfig(level=logging.INFO)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db.database import init_db
from backend.routes import auth, dashboard, predict, prices, surveys, notifications, routing
from backend.services.fuel_data import start_scheduler, stop_scheduler, get_last_fetch_info


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="AstraFlow API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(predict.router)
app.include_router(prices.router)
app.include_router(surveys.router)
app.include_router(notifications.router)
app.include_router(routing.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0", "data_source": get_last_fetch_info()}
