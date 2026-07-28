from fastapi import APIRouter
from pydantic import BaseModel
import datetime

router = APIRouter(prefix="/trips", tags=["Trip Logs"])

class TripCreateSchema(BaseModel):
    distance_km: float
    duration_min: int
    avg_speed_kmh: float
    max_speed_kmh: float
    hazards_count: int
    route_name: str

@router.get("/")
def list_trips():
    return [
        {
            "id": "trp_101",
            "date": "2026-07-28",
            "startTime": "21:30",
            "endTime": "23:42",
            "distance": "184.2 km",
            "duration": "2h 12m",
            "avgSpeed": "83.7 km/h",
            "maxSpeed": "118.0 km/h",
            "hazards": 42,
            "score": 94,
            "route": "Highway 101 North → Bay Area Expressway",
            "weather": "Clear / Dry Road",
        },
        {
            "id": "trp_102",
            "date": "2026-07-27",
            "startTime": "22:15",
            "endTime": "23:30",
            "distance": "92.4 km",
            "duration": "1h 15m",
            "avgSpeed": "73.9 km/h",
            "maxSpeed": "102.5 km/h",
            "hazards": 28,
            "score": 90,
            "route": "Suburban Highway Corridor 4",
            "weather": "Light Mist / Damp",
        },
    ]

@router.post("/")
def create_trip(payload: TripCreateSchema):
    return {
        "status": "success",
        "trip_id": f"trp_{int(datetime.datetime.utcnow().timestamp())}",
        "message": "Trip recorded and logged to database.",
    }
