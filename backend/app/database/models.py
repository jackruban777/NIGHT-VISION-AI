from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship as db_relationship
import datetime

Base = declarative_base()

class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="driver")
    vehicle_model = Column(String, default="Lumina EV GT-9")
    license_plate = Column(String, default="NV-882-AI")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    trips = db_relationship("TripModel", back_populates="user")
    contacts = db_relationship("EmergencyContactModel", back_populates="user")

class TripModel(Base):
    __tablename__ = "trips"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
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

    user = db_relationship("UserModel", back_populates="trips")
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
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    relationship = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    notify_on_sos = Column(Boolean, default=True)

    user = db_relationship("UserModel", back_populates="contacts")
