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

# Mobile Camera Connect Database Tables
class VerificationSessionModel(Base):
    __tablename__ = "verification_sessions"

    id = Column(String, primary_key=True)
    email = Column(String, nullable=False)
    code_hash = Column(String, nullable=False)
    attempts = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    verified = Column(Boolean, default=False)

class ConnectedDeviceModel(Base):
    __tablename__ = "connected_devices"

    id = Column(String, primary_key=True)
    email = Column(String, nullable=False)
    device_id = Column(String, nullable=False)
    device_name = Column(String, default="Mobile Camera Device")
    session_token = Column(String, nullable=False)
    ip_address = Column(String, default="127.0.0.1")
    status = Column(String, default="CONNECTED")
    last_connected = Column(DateTime, default=datetime.datetime.utcnow)

class CameraSessionModel(Base):
    __tablename__ = "camera_sessions"

    id = Column(String, primary_key=True)
    session_token = Column(String, nullable=False)
    device_id = Column(String, nullable=False)
    resolution = Column(String, default="1920x1080")
    fps = Column(Integer, default=30)
    signal_strength = Column(String, default="EXCELLENT")
    battery_pct = Column(Integer, default=95)
    camera_facing = Column(String, default="environment")
    is_recording = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

class ConnectionLogModel(Base):
    __tablename__ = "connection_logs"

    id = Column(String, primary_key=True)
    device_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    message = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class DeviceHistoryModel(Base):
    __tablename__ = "device_history"

    id = Column(String, primary_key=True)
    email = Column(String, nullable=False)
    device_id = Column(String, nullable=False)
    device_name = Column(String, default="Mobile Camera Device")
    last_ip = Column(String, default="127.0.0.1")
    first_connected = Column(DateTime, default=datetime.datetime.utcnow)
    last_connected = Column(DateTime, default=datetime.datetime.utcnow)
