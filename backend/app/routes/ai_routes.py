from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File
import cv2
import numpy as np
import json
import asyncio
from app.ai.detector import hazard_detector

router = APIRouter(prefix="/ai", tags=["AI Perception"])

@router.post("/detect")
async def analyze_frame(file: UploadFile = File(...), night_enhance: bool = True):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        return {"error": "Invalid image payload"}

    result = hazard_detector.process_frame(frame, apply_night_enhance=night_enhance)
    return result

@router.websocket("/ws/stream")
async def stream_ai_detection(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Receive frame payload or request tick
            data = await websocket.receive_text()
            # Send real-time hazard matrix telemetry back to client
            sample_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
            result = hazard_detector.process_frame(sample_frame)
            await websocket.send_text(json.dumps(result))
            await asyncio.sleep(0.05) # 20 FPS stream
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
