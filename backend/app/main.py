from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database.connection import init_db
from app.routes import ai_routes, trips, mobile_routes

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="NightVision AI - ADAS Night-Driving Safety Platform Backend API",
    version="4.3.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers (Supported under both /api/v1 and direct paths)
app.include_router(ai_routes.router, prefix=settings.API_V1_STR)
app.include_router(ai_routes.router)
app.include_router(trips.router, prefix=settings.API_V1_STR)
app.include_router(trips.router)
app.include_router(mobile_routes.router, prefix=settings.API_V1_STR)
app.include_router(mobile_routes.router)

from app.ai.detector import hazard_detector

@app.on_event("startup")
def startup_event():
    init_db()
    hazard_detector.auto_test_pipeline()

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "4.3.0",
        "docs": "/docs",
    }

import psutil, os, gc

@app.get("/health")
def health_check():
    process = psutil.Process(os.getpid())
    ram_mb = round(process.memory_info().rss / 1024 / 1024, 1)
    if ram_mb > 450.0:
        gc.collect()
    return {
        "status": "healthy",
        "neural_engine": "active",
        "surveillance_hud": "active",
        "memory_rss_mb": ram_mb,
        "db": "connected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
