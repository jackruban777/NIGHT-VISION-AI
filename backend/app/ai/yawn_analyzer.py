import time
import numpy as np
from typing import Dict, List, Tuple
from collections import deque

class YawnAnalyzer:
    def __init__(self, mar_threshold: float = 0.50):
        self.mar_threshold = mar_threshold
        self.yawn_count = 0
        self.yawn_start_time = None
        self.is_currently_yawning = False
        self.last_yawn_duration_s = 0.0
        self.yawn_timestamps = deque(maxlen=30) # Timestamps of yawns in last 5 minutes

    def calculate_mar(self, mouth_landmarks: List[Tuple[int, int]]) -> float:
        """
        Calculates Mouth Aspect Ratio (MAR) from inner lip landmark coordinates:
        p1 (left corner), p2 (right corner), p3 (upper lip inner), p4 (lower lip inner).
        """
        if len(mouth_landmarks) < 4:
            return 0.15  # Default closed/normal mouth

        # Map key inner lip coordinates
        if len(mouth_landmarks) >= 8:
            left_corner = np.array(mouth_landmarks[0], dtype=np.float64)
            right_corner = np.array(mouth_landmarks[1], dtype=np.float64)
            upper_lip = np.array(mouth_landmarks[2], dtype=np.float64)
            lower_lip = np.array(mouth_landmarks[3], dtype=np.float64)
        else:
            left_corner = np.array(mouth_landmarks[0], dtype=np.float64)
            right_corner = np.array(mouth_landmarks[1], dtype=np.float64)
            upper_lip = np.array(mouth_landmarks[2], dtype=np.float64)
            lower_lip = np.array(mouth_landmarks[3], dtype=np.float64)

        vertical_dist = np.linalg.norm(upper_lip - lower_lip)
        horizontal_dist = np.linalg.norm(left_corner - right_corner)

        if horizontal_dist == 0:
            return 0.0

        mar = vertical_dist / horizontal_dist
        return float(mar)

    def analyze_yawn(self, mouth_landmarks: List[Tuple[int, int]]) -> Dict:
        """
        Analyzes Mouth Aspect Ratio and temporal yawning dynamics.
        """
        mar = round(self.calculate_mar(mouth_landmarks), 3)
        current_time = time.time()

        is_open = mar >= self.mar_threshold
        yawn_duration_s = 0.0
        yawn_type = "Normal Mouth"
        is_yawning = False

        if is_open:
            if not self.is_currently_yawning:
                self.is_currently_yawning = True
                self.yawn_start_time = current_time

            yawn_duration_s = round(current_time - self.yawn_start_time, 2)
            self.last_yawn_duration_s = yawn_duration_s

            if yawn_duration_s >= 4.5:
                yawn_type = "Long Yawn (>4.5s)"
                is_yawning = True
            elif yawn_duration_s >= 2.5:
                yawn_type = "Medium Yawn (2.5-4.5s)"
                is_yawning = True
            elif yawn_duration_s >= 1.0:
                yawn_type = "Small Yawn (1-2.5s)"
                is_yawning = True
            else:
                yawn_type = "Mouth Open / Talking"

        else:
            if self.is_currently_yawning:
                self.is_currently_yawning = False
                if self.yawn_start_time is not None:
                    duration = current_time - self.yawn_start_time
                    if duration >= 1.2:
                        self.yawn_count += 1
                        self.yawn_timestamps.append(current_time)
                self.yawn_start_time = None

            yawn_type = "Normal / Mouth Closed"

        # Check for Repeated Yawning in past 3 minutes (180s)
        cutoff = current_time - 180.0
        recent_yawns = [t for t in self.yawn_timestamps if t >= cutoff]
        repeated_yawning = len(recent_yawns) >= 2

        return {
            "mar": mar,
            "is_yawning": is_yawning,
            "yawn_duration_s": self.last_yawn_duration_s if self.is_currently_yawning else 0.0,
            "yawn_count": self.yawn_count,
            "recent_yawn_frequency_3m": len(recent_yawns),
            "repeated_yawning": repeated_yawning,
            "yawn_type": yawn_type
        }

yawn_analyzer = YawnAnalyzer()
