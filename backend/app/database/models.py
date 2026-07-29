from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship as db_relationship
import datetime

Base = declarative_base()

class TripModel(Base):
    __tablename__ = "trips"

    id = Column(String, primary_key=True)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    distance_km = Column(Float, default=0.0)
    duration_min = Column(Integer, default=0)
    avg_speed_kmh = Column(Float, default=0.0)
    max_speed_kmh = Column(Float, default=0.0)
    total_hazards = Column(Integer, default=0)
    safety_score = Column(Integer, default=100)
    route_description = Column(String, default="Highway Corridor")
    weather = Column(String, default="Clear")

    detections = db_relationship("DetectionModel", back_populates="trip")

class DetectionModel(Base):
    __tablename__ = "detections"

    id = Column(String, primary_key=True)
    trip_id = Column(String, ForeignKey("trips.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    hazard_class = Column(String, nullable=False)
    confidence = Column(Float, default=0.90)
    distance_m = Column(Float, nullable=False)
    risk_level = Column(String, default="Low")

    trip = db_relationship("TripModel", back_populates="detections")

class EmergencyContactModel(Base):
    __tablename__ = "emergency_contacts"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    relationship = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    notify_on_sos = Column(Boolean, default=True)

