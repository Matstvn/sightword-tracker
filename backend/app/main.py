from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .database import engine, Base
from .routers import learners, words, assessments, websocket

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sight Word Tracker API", version="1.0")

# ==========================================================
# CORS Middleware – FIXED for WebSocket handshake
# ==========================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        # Add any other origins you use (e.g., if you later have a separate frontend port)
    ],
    allow_credentials=True,   # Keep True for cookies/auth later
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