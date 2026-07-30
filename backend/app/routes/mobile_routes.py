from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Optional, List
import json
import asyncio
import datetime

from app.services.mobile_service import mobile_service
from app.database.connection import SessionLocal
from app.database.models import (
    ConnectedDeviceModel,
    CameraSessionModel,
    ConnectionLogModel,
    DeviceHistoryModel,
)

router = APIRouter(prefix="/mobile", tags=["Mobile Camera Connect"])

# Pydantic Schemas
class GenerateCodePayload(BaseModel):
    email: str

class VerifyCodePayload(BaseModel):
    email: str
    code: str = Field(..., min_length=6, max_length=6)

class CreateSessionPayload(BaseModel):
    session_token: str
    device_name: Optional[str] = "Mobile Camera Device"

class DisconnectPayload(BaseModel):
    session_token: str

class SwitchCameraPayload(BaseModel):
    session_token: str
    camera_facing: str = Field("environment", example="environment")

# Active WebSockets connection manager for WebRTC Signaling & Frame Streaming
class SignalManager:
    def __init__(self):
        self.active_sessions: Dict[str, Dict[str, WebSocket]] = {} # token -> {"desktop": ws, "mobile": ws}
        self.latest_frames: Dict[str, bytes] = {} # token -> raw image JPEG bytes for AI feed

    async def connect(self, session_token: str, role: str, websocket: WebSocket):
        await websocket.accept()
        if session_token not in self.active_sessions:
            self.active_sessions[session_token] = {}
        self.active_sessions[session_token][role] = websocket
        print(f"[SignalManager] {role.upper()} connected for session {session_token[:12]}...")

    def disconnect(self, session_token: str, role: str):
        if session_token in self.active_sessions:
            self.active_sessions[session_token].pop(role, None)
            if not self.active_sessions[session_token]:
                self.active_sessions.pop(session_token, None)
                self.latest_frames.pop(session_token, None)

    async def send_signal(self, session_token: str, target_role: str, message: dict):
        if session_token in self.active_sessions and target_role in self.active_sessions[session_token]:
            ws = self.active_sessions[session_token][target_role]
            await ws.send_text(json.dumps(message))

    async def send_bytes(self, session_token: str, target_role: str, data: bytes):
        if session_token in self.active_sessions and target_role in self.active_sessions[session_token]:
            ws = self.active_sessions[session_token][target_role]
            try:
                await ws.send_bytes(data)
            except Exception:
                pass

signal_manager = SignalManager()

@router.post("/generate-code")
def generate_verification_code(payload: GenerateCodePayload):
    success, message, cooldown = mobile_service.generate_verification_code(payload.email)
    if not success:
        raise HTTPException(status_code=429, detail=message)
    return {"status": "success", "message": message, "resend_cooldown_s": cooldown}

@router.post("/verify-code")
def verify_code(payload: VerifyCodePayload):
    success, message, token = mobile_service.verify_code(payload.email, payload.code)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {
        "status": "success",
        "message": message,
        "session_token": token,
        "mobile_connect_url": f"/mobile-stream?token={token}"
    }

@router.post("/create-session")
def create_camera_session(payload: CreateSessionPayload):
    db = SessionLocal()
    try:
        session = db.query(CameraSessionModel).filter(CameraSessionModel.session_token == payload.session_token).first()
        if not session:
            raise HTTPException(status_code=404, detail="Invalid or expired session token.")
        
        session.started_at = datetime.datetime.utcnow()
        session.expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        db.commit()
        return {"status": "active", "session_token": payload.session_token, "expires_in_s": 600}
    finally:
        db.close()

@router.post("/disconnect")
def disconnect_camera(payload: DisconnectPayload):
    mobile_service.disconnect_session(payload.session_token)
    try:
        db = SessionLocal()
        device = db.query(ConnectedDeviceModel).filter(ConnectedDeviceModel.session_token == payload.session_token).first()
        if device:
            device.status = "DISCONNECTED"
            db.commit()
        db.close()
    except Exception:
        pass
    return {"status": "disconnected", "message": "Mobile camera disconnected successfully."}

@router.get("/status")
def get_camera_status(session_token: str):
    # Primary: check in-memory session store
    session = mobile_service.get_session(session_token)
    if session:
        return {
            "connected": True,
            "status": session.get("status", "ACTIVE"),
            "device_name": session.get("device_name", "Mobile Camera Device"),
            "resolution": session.get("resolution", "1920x1080"),
            "fps": session.get("fps", 30),
            "signal_strength": session.get("signal_strength", "EXCELLENT"),
            "battery_pct": session.get("battery_pct", 95),
            "camera_facing": session.get("camera_facing", "environment"),
            "is_recording": False,
        }
    return {"connected": False, "status": "OFFLINE"}

@router.get("/devices")
def get_connected_devices(email: str):
    db = SessionLocal()
    try:
        devices = db.query(DeviceHistoryModel).filter(DeviceHistoryModel.email == email).all()
        return [
            {
                "id": d.id,
                "device_id": d.device_id,
                "device_name": d.device_name,
                "last_ip": d.last_ip,
                "last_connected": d.last_connected.isoformat() if d.last_connected else None
            }
            for d in devices
        ]
    finally:
        db.close()

@router.post("/switch-camera")
def switch_camera(payload: SwitchCameraPayload):
    db = SessionLocal()
    try:
        session = db.query(CameraSessionModel).filter(CameraSessionModel.session_token == payload.session_token).first()
        if session:
            session.camera_facing = payload.camera_facing
            db.commit()
        
        # Update in-memory session facing
        mobile_service.update_session(payload.session_token, {"camera_facing": payload.camera_facing})
        return {"status": "success", "camera_facing": payload.camera_facing}
    finally:
        db.close()

@router.websocket("/ws/signal/{session_token}")
async def rtc_signaling_stream(websocket: WebSocket, session_token: str, role: str = "mobile"):
    """
    WebRTC PeerConnection Signaling & Dual Fallback Frame Receiver/Relay.
    Role can be 'mobile' (sender) or 'desktop' (receiver).
    """
    await signal_manager.connect(session_token, role, websocket)
    target_role = "desktop" if role == "mobile" else "mobile"

    try:
        while True:
            # Handle both JSON text signaling and raw binary JPEG frames
            message = await websocket.receive()
            if "text" in message and message["text"]:
                try:
                    msg = json.loads(message["text"])
                    await signal_manager.send_signal(session_token, target_role, msg)
                except json.JSONDecodeError:
                    pass
            elif "bytes" in message and message["bytes"]:
                raw_data = message["bytes"]
                signal_manager.latest_frames[session_token] = raw_data
                await signal_manager.send_bytes(session_token, target_role, raw_data)
    except WebSocketDisconnect:
        signal_manager.disconnect(session_token, role)
        print(f"[SignalManager] {role.upper()} disconnected for session {session_token[:12]}")
