from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import os

from .database import engine, Base
from .routers import learners, words, assessments, websocket
from .config import settings

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.APP_NAME, version="1.0")


# HTTPS enforcement middleware
class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if settings.FORCE_HTTPS:
            is_secure = request.url.scheme == "https"
            x_forwarded_proto = request.headers.get("x-forwarded-proto", "")
            if not is_secure and x_forwarded_proto.lower() != "https":
                target_url = request.url.replace(scheme="https")
                return JSONResponse(
                    {"detail": "HTTPS required."},
                    status_code=308,
                    headers={"Location": str(target_url)},
                )
        return await call_next(request)


app.add_middleware(HTTPSRedirectMiddleware)

# Shared-password gate middleware
class SharedPasswordMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only enforce when a shared password is configured
        shared = getattr(settings, "SHARED_PASSWORD", None)
        if not shared:
            return await call_next(request)

        # Only protect mutating methods that could touch real student data
        if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api"):
            provided = request.headers.get("x-shared-password") or request.query_params.get("shared_password")
            if not provided or provided != str(shared):
                return JSONResponse({"detail": "Shared password required for mutating requests."}, status_code=401)

        return await call_next(request)


app.add_middleware(SharedPasswordMiddleware)

# ==========================================================
# CORS Middleware – FIXED for WebSocket handshake
# ==========================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================================
# API ROUTERS
# ==========================================================
app.include_router(learners.router)
app.include_router(words.router)
app.include_router(assessments.router)
app.include_router(websocket.router)   # WebSocket router

# ==========================================================
# HEALTH CHECK
# ==========================================================
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Backend + Database + WebSockets are ready!"}

# ==========================================================
# SERVE PAGES
# ==========================================================
@app.get("/pages/{filename}")
async def serve_pages(filename: str):
    file_path = f"static/pages/{filename}"
    if os.path.exists(file_path) and filename.endswith(".html"):
        return FileResponse(file_path)
    return FileResponse("static/index.html")

# ==========================================================
# SERVE STATIC FILES
# ==========================================================
app.mount("/static", StaticFiles(directory="static"), name="static")

# ==========================================================
# SERVE ROOT INDEX
# ==========================================================
@app.get("/")
async def serve_index():
    return FileResponse("static/index.html")