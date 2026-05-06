from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before routes import llm_service (reads OPENAI_API_KEY).
_backend_root = Path(__file__).resolve().parent.parent
# override=True: use backend/.env even if a wrong OPENAI_API_KEY exists in the OS env (e.g. old Google key).
load_dotenv(_backend_root / ".env", override=True)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routes import innovation

app = FastAPI(
    title="Bhashini-Integrated Real-Time Judicial Assistant for Multilingual Legal Access",
    description=(
        "Bhashini-integrated real-time judicial assistant for multilingual translation, simplification, and legal summarization "
        "(prototype)."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(innovation.router, prefix="/api/innovation", tags=["India Innovation Demo"])

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.middleware("http")
async def disable_static_cache(request: Request, call_next):
    """
    Development-friendly cache policy:
    avoid 304 for static assets so latest JS/CSS/HTML always reloads.
    """
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        if "ETag" in response.headers:
            del response.headers["ETag"]
        if "Last-Modified" in response.headers:
            del response.headers["Last-Modified"]
    return response


@app.get("/")
def root():
    return FileResponse(static_dir / "signup.html")


@app.get("/login")
def login():
    return FileResponse(static_dir / "login.html")


@app.get("/signup")
def signup():
    return FileResponse(static_dir / "signup.html")


@app.get("/india-innovation")
def india_innovation():
    return FileResponse(static_dir / "india_innovation.html")
