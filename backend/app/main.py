from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database.connection import init_db
from app.routes import ai_routes, trips, mobile_routes

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="NightVision AI - ADAS Night-Driving Safety Platform Backend API",
    version="4.2.0",
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

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "4.2.0",
        "docs": "/docs",
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "neural_engine": "active", "db": "connected"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
