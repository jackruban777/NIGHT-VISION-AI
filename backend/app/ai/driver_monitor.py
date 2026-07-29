import numpy as np
from typing import Dict, List, Optional
from app.ai.dms.dms_pipeline import dms_pipeline
from app.ai.dms.blink_analyzer import blink_analyzer

class DriverMonitor:
    """
    Production Driver Monitoring System Delegate.
    Delegates perception tasks to the high-performance DMS Pipeline.
    """
    def calculate_ear(self, eye_landmarks: list) -> float:
        return blink_analyzer.calculate_ear(eye_landmarks)

    def analyze_driver_state(self, ear: float, yawn_duration_s: float = 0.0) -> dict:
        is_drowsy = ear < 0.20 or yawn_duration_s > 3.0
        status = "Severe Drowsiness Alert" if is_drowsy else "Driver Alert"
        return {
            "ear": ear,
            "is_drowsy": is_drowsy,
            "status": status,
            "recommended_action": "Pull Over at Nearest Rest Stop Immediately" if is_drowsy else "Nominal",
        }

    def process_dms_frame(self, frame: np.ndarray, apply_night_enhance: bool = True) -> dict:
        return dms_pipeline.process_frame(frame, apply_night_enhance=apply_night_enhance)

driver_monitor = DriverMonitor()
