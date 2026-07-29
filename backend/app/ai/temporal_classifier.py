import time
from collections import deque
from typing import Dict, List

class TemporalSequenceClassifier:
    def __init__(self, window_seconds: float = 8.0):
        self.window_seconds = window_seconds
        self.observation_buffer = deque(maxlen=240) # Buffer of 240 frames (~8 seconds at 30 FPS)

    def update(self, frame_telemetry: Dict) -> Dict:
        """
        Pushes latest frame telemetry into temporal sequence buffer and computes
        smoothed temporal state to eliminate single-frame false positives.
        """
        current_time = time.time()
        
        # Add frame observation with timestamp
        obs = {
            "timestamp": current_time,
            "ear": frame_telemetry.get("ear", 0.28),
            "mar": frame_telemetry.get("mar", 0.15),
            "perclos": frame_telemetry.get("perclos_pct", 0.0),
            "is_closed": frame_telemetry.get("is_closed", False),
            "is_microsleep": frame_telemetry.get("is_microsleep", False),
            "is_yawning": frame_telemetry.get("is_yawning", False),
            "head_down": frame_telemetry.get("head_down", False),
            "looking_away": frame_telemetry.get("looking_away", False),
            "is_phone": frame_telemetry.get("is_phone_usage", False),
        }
        self.observation_buffer.append(obs)

        # Filter observations within rolling window (e.g. last 8 seconds)
        cutoff = current_time - self.window_seconds
        valid_obs = [o for o in self.observation_buffer if o["timestamp"] >= cutoff]

        if not valid_obs:
            return {
                "driver_state": "Normal",
                "confidence": 0.95,
                "temporal_perclos": 0.0,
                "closed_eye_ratio": 0.0,
                "yawn_ratio": 0.0
            }

        total_frames = len(valid_obs)
        closed_frames = sum(1 for o in valid_obs if o["is_closed"])
        microsleep_frames = sum(1 for o in valid_obs if o["is_microsleep"])
        yawn_frames = sum(1 for o in valid_obs if o["is_yawning"])
        head_down_frames = sum(1 for o in valid_obs if o["head_down"])

        closed_eye_ratio = closed_frames / float(total_frames)
        yawn_ratio = yawn_frames / float(total_frames)
        head_down_ratio = head_down_frames / float(total_frames)

        latest = valid_obs[-1]

        # Temporal State Classification
        if microsleep_frames >= 30 or (closed_eye_ratio > 0.65 and head_down_ratio > 0.3):
            driver_state = "Sleeping"
            confidence = 0.98
        elif microsleep_frames >= 10 or closed_eye_ratio > 0.40:
            driver_state = "Microsleep"
            confidence = 0.95
        elif closed_eye_ratio > 0.20 or (yawn_ratio > 0.25 and head_down_ratio > 0.20):
            driver_state = "Drowsy"
            confidence = 0.90
        elif closed_eye_ratio > 0.08 or yawn_ratio > 0.10 or head_down_ratio > 0.15:
            driver_state = "Slightly Drowsy"
            confidence = 0.85
        else:
            driver_state = "Normal"
            confidence = 0.96

        return {
            "driver_state": driver_state,
            "confidence": round(confidence, 2),
            "temporal_perclos": round(closed_eye_ratio * 100.0, 1),
            "closed_eye_ratio": round(closed_eye_ratio, 3),
            "yawn_ratio": round(yawn_ratio, 3),
            "head_down_ratio": round(head_down_ratio, 3),
            "window_observations_count": total_frames
        }

temporal_classifier = TemporalSequenceClassifier()
