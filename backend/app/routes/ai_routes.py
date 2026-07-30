from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File
import cv2
import numpy as np
import json
import asyncio

from app.ai.detector import hazard_detector
from app.ai.driver_monitor import driver_monitor
from app.ai.dms.dms_pipeline import dms_pipeline

router = APIRouter(prefix="/ai", tags=["AI Perception"])

@router.post("/detect")
def analyze_frame(file: UploadFile = File(...), night_enhance: bool = True, night_vision_mode: str = "Auto"):
    contents = file.file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        return {"error": "Invalid image payload"}

    result = hazard_detector.process_frame(frame, apply_night_enhance=night_enhance, night_vision_mode=night_vision_mode)
    return result

@router.post("/dms/analyze")
def analyze_dms_frame(file: UploadFile = File(...), night_enhance: bool = True):
    """
    Production Driver Monitoring System (DMS) Single-Frame Analysis Endpoint.
    Returns complete biometric telemetry (EAR, MAR, Head Pose, PERCLOS, Phone Distraction, Temporal Risk Score).
    """
    contents = file.file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        return {"error": "Invalid image payload"}

    # Extract YOLO hazard detections to correlate phone objects
    hazard_result = hazard_detector.process_frame(frame, apply_night_enhance=False)
    yolo_dets = hazard_result.get("detections", [])

    dms_result = dms_pipeline.process_frame(frame, apply_night_enhance=night_enhance, yolo_detections=yolo_dets)
    return dms_result

from pydantic import BaseModel, Field

class DriverFatiguePayload(BaseModel):
    ear: float = Field(..., example=0.18)
    yawn_duration_s: float = Field(0.0, example=1.5)
    eye_landmarks: list = Field(default_factory=list)

@router.post("/driver-fatigue")
def analyze_driver_fatigue(payload: DriverFatiguePayload):
    calculated_ear = payload.ear
    if len(payload.eye_landmarks) >= 6:
        calculated_ear = driver_monitor.calculate_ear(payload.eye_landmarks)

    result = driver_monitor.analyze_driver_state(calculated_ear, payload.yawn_duration_s)
    return result

@router.websocket("/ws/stream")
async def stream_ai_detection(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            sample_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
            result = hazard_detector.process_frame(sample_frame)
            await websocket.send_text(json.dumps(result))
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        print("[WebSocket] AI Stream client disconnected")

@router.websocket("/dms/ws")
async def stream_dms_telemetry(websocket: WebSocket):
    """
    Real-Time DMS Telemetry Stream WebSocket (20-30 FPS).
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # Generate tick stream telemetry sample
            sample_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            result = dms_pipeline.process_frame(sample_frame)
            await websocket.send_text(json.dumps(result))
            await asyncio.sleep(0.04) # 25 FPS
    except WebSocketDisconnect:
        print("[WebSocket] DMS Stream client disconnected")
