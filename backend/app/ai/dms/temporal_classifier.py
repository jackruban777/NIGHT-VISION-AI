import time
from collections import deque
from typing import Dict, List

class TemporalSequenceClassifier:
    """
    Temporal Sequence Classifier over rolling 5-10 second window (150-300 frames).
    Classifies driver state into:
      - Normal
      - Slightly Drowsy
      - Drowsy
      - Microsleep
      - Sleeping
      - Driver Absent
    """
    def __init__(self, history_window_size: int = 150):
        self.history_window_size = history_window_size
        self.frame_history = deque(maxlen=history_window_size)

    def update_and_classify(self, frame_metrics: Dict) -> Dict:
        """
        frame_metrics contains:
          - is_driver_absent: bool
          - ear: float
          - is_closed: bool
          - is_microsleep: bool
          - closure_duration_s: float
          - mar: float
          - is_yawning: bool
          - yawn_duration_s: float
          - head_down: bool
          - looking_away: bool
          - phone_distracted: bool
        """
        self.frame_history.append(frame_metrics)
        
        # 1. Driver Absence Check
        if frame_metrics.get("is_driver_absent", False):
            return {
                "driver_state": "Driver Absent",
                "confidence": 1.0,
                "summary": "No driver detected in vehicle seat for >2.0s"
            }

        # Calculate statistics over temporal window
        window_len = max(1, len(self.frame_history))
        microsleep_count = sum(1 for m in self.frame_history if m.get("is_microsleep", False))
        closed_count = sum(1 for m in self.frame_history if m.get("is_closed", False))
        yawn_count = sum(1 for m in self.frame_history if m.get("is_yawning", False))
        head_down_count = sum(1 for m in self.frame_history if m.get("head_down", False))

        closed_ratio = closed_count / window_len
        yawn_ratio = yawn_count / window_len
        closure_duration = frame_metrics.get("closure_duration_s", 0.0)

        # 2. Sleeping (> 3.0s continuous eye closure)
        if closure_duration >= 3.0 or closed_ratio > 0.70:
            return {
                "driver_state": "Sleeping",
                "confidence": 0.98,
                "summary": f"Continuous eye closure for {closure_duration:.1f}s - Immediate Emergency!"
            }

        # 3. Microsleep (1.5s - 3.0s eye closure or multiple microsleep events)
        if closure_duration >= 1.5 or microsleep_count >= 2:
            return {
                "driver_state": "Microsleep",
                "confidence": 0.95,
                "summary": f"Microsleep event detected ({closure_duration:.1f}s eye closure)"
            }

        # 4. Drowsy (High PERCLOS / repeated yawning / head down persistent)
        if closed_ratio >= 0.25 or (yawn_ratio > 0.20 and head_down_count > 10) or closure_duration >= 0.8:
            return {
                "driver_state": "Drowsy",
                "confidence": 0.90,
                "summary": "Persistent eye closure, yawning, or head nodding detected"
            }

        # 5. Slightly Drowsy (Moderate PERCLOS / brief yawn / mild distraction)
        if closed_ratio >= 0.12 or yawn_ratio > 0.08 or frame_metrics.get("phone_distracted", False) or frame_metrics.get("looking_away", False):
            return {
                "driver_state": "Slightly Drowsy",
                "confidence": 0.82,
                "summary": "Mild fatigue indicators or brief distraction detected"
            }

        # 6. Normal
        return {
            "driver_state": "Normal",
            "confidence": 0.99,
            "summary": "Driver alert, attentive, and focused on road"
        }

temporal_classifier = TemporalSequenceClassifier()
