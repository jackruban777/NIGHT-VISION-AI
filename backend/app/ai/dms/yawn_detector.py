import time
import numpy as np
from typing import Dict, List, Tuple
from collections import deque

class YawnDetector:
    """
    Calculates Mouth Aspect Ratio (MAR) and classifies yawn duration and severity.
    MAR Formula: ||top_lip - bottom_lip|| / ||left_lip_corner - right_lip_corner||
    Thresholds:
      - Normal: MAR < 0.50
      - Small Yawn: MAR >= 0.50 (Duration > 1.5s)
      - Medium Yawn: MAR >= 0.65 (Duration > 2.5s)
      - Long Yawn: MAR >= 0.75 (Duration > 4.0s)
    """
    def __init__(self, mar_threshold: float = 0.50):
        self.mar_threshold = mar_threshold
        self.yawn_start_time = None
        self.is_yawning = False
        self.yawn_count = 0
        self.last_yawn_duration_s = 0.0
        self.yawn_timestamps = deque(maxlen=50)

    def calculate_mar(self, mouth_inner_landmarks: List[Tuple[int, int]]) -> float:
        """
        Expects inner lip landmark points or general mouth points.
        Point 0: Left corner, Point 1: Right corner, Point 2: Top lip inner, Point 3: Bottom lip inner.
        """
        if not mouth_inner_landmarks or len(mouth_inner_landmarks) < 4:
            return 0.15

        # Handle inner lip points (78: Left, 308: Right, 13: Top, 14: Bottom)
        pts = [np.array(p, dtype=np.float64) for p in mouth_inner_landmarks]

        if len(pts) >= 8:
            left_corner = pts[0]
            right_corner = pts[1]
            top_lip = pts[2]
            bottom_lip = pts[3]
        else:
            left_corner = pts[0]
            right_corner = pts[1]
            top_lip = pts[2]
            bottom_lip = pts[3]

        vert_dist = np.linalg.norm(top_lip - bottom_lip)
        horiz_dist = np.linalg.norm(left_corner - right_corner)

        if horiz_dist == 0:
            return 0.0

        mar = vert_dist / horiz_dist
        return float(mar)

    def analyze_mouth(self, mouth_landmarks: List[Tuple[int, int]]) -> Dict:
        mar = round(self.calculate_mar(mouth_landmarks), 3)
        current_time = time.time()

        is_open = mar >= self.mar_threshold
        yawn_duration_s = 0.0
        yawn_severity = "Normal"
        is_active_yawn = False

        if is_open:
            if not self.is_yawning:
                self.is_yawning = True
                self.yawn_start_time = current_time

            yawn_duration_s = round(current_time - self.yawn_start_time, 2)
            self.last_yawn_duration_s = yawn_duration_s

            if yawn_duration_s >= 1.5:
                is_active_yawn = True
                if mar >= 0.75 or yawn_duration_s >= 4.0:
                    yawn_severity = "Long Yawn"
                elif mar >= 0.65 or yawn_duration_s >= 2.5:
                    yawn_severity = "Medium Yawn"
                else:
                    yawn_severity = "Small Yawn"
        else:
            if self.is_yawning:
                self.is_yawning = False
                if self.yawn_start_time is not None:
                    duration_s = current_time - self.yawn_start_time
                    if duration_s >= 1.5:
                        self.yawn_count += 1
                        self.yawn_timestamps.append(current_time)
                self.yawn_start_time = None
            yawn_severity = "Normal"

        cutoff = current_time - 300.0 # past 5 minutes
        recent_yawns = [t for t in self.yawn_timestamps if t >= cutoff]
        repeated_yawning = len(recent_yawns) >= 2

        return {
            "mar": mar,
            "is_yawning": is_active_yawn,
            "yawn_duration_s": yawn_duration_s,
            "yawn_severity": yawn_severity,
            "yawn_count": self.yawn_count,
            "recent_yawn_count_5m": len(recent_yawns),
            "repeated_yawning": repeated_yawning
        }

yawn_detector = YawnDetector()
