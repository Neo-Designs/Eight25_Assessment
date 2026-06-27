import sys
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from app.config import settings
from app.database import init_db
from app.auth import router as auth_router
from app.audit import router as audit_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audit_tool")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    init_db()
    yield


app = FastAPI(title="WebCrawler Audit API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    return {"message": "Preflight OK"}


def _require_valid_url(url: str) -> str:
    from fastapi import HTTPException

    url = (url or "").strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL scheme.")
    return url


app.include_router(auth_router)
app.include_router(audit_router)
