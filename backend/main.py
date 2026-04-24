from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.routers import ec2, schedule, ssl, disk, cost, audit

app = FastAPI(
    title="EC2 Scheduler Dashboard",
    description="Manage EC2 start/stop schedules, SSL monitoring, disk usage, and cost tracking.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://gitmonit.intelligence.app",
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["X-API-Key", "Content-Type", "Authorization"],
)

app.include_router(ec2.router)
app.include_router(schedule.router)
app.include_router(ssl.router)
app.include_router(disk.router)
app.include_router(cost.router)
app.include_router(audit.router)

@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}

# Mount frontend last so /api/* and /health routes take priority.
# html=True makes StaticFiles serve index.html for unknown paths (SPA fallback).
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
