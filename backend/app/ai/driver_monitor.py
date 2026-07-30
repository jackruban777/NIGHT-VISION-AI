import numpy as np
from typing import Dict, List, Optional
from app.ai.dms.dms_pipeline import dms_pipeline
from app.ai.dms.blink_analyzer import blink_analyzer

class DriverMonitoringSystem:
    """
    Production-Grade Driver Monitoring System Delegate.
    Delegates all AI perception to the high-performance DMS Pipeline.
    """

    def calculate_ear(self, eye_landmarks: list) -> float:
        """Legacy EAR helper for compatibility."""
        return blink_analyzer.calculate_ear(eye_landmarks)

    def analyze_driver_state(self, ear: float, yawn_duration_s: float = 0.0) -> dict:
        """Legacy compatibility shim - delegates to multi-factor risk scoring."""
        is_drowsy = ear < 0.20 or yawn_duration_s > 3.0
        return {
            "ear": ear,
            "is_drowsy": is_drowsy,
            "status": "Severe Drowsiness Alert" if is_drowsy else "Driver Alert",
            "recommended_action": "Pull Over at Nearest Rest Stop Immediately" if is_drowsy else "Nominal",
        }

    def process_frame(
        self,
        frame: np.ndarray,
        apply_night_enhance: bool = True,
        detections: Optional[List[Dict]] = None
    ) -> Dict:
        """
        Runs the full production DMS pipeline on a single video frame.
        Returns complete biometric telemetry dict with risk score, driver state,
        head pose, eye/blink/PERCLOS metrics, yawn metrics, and voice alert payload.
        """
        return dms_pipeline.process_frame(
            frame,
            apply_night_enhance=apply_night_enhance,
            yolo_detections=detections or []
        )

driver_monitor = DriverMonitoringSystem()
