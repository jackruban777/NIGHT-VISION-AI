import time
import numpy as np
from typing import Dict, List, Tuple
from collections import deque

class BlinkAnalyzer:
    def __init__(self, ear_threshold: float = 0.20, perclos_window_size: int = 150):
        self.ear_threshold = ear_threshold
        self.perclos_window_size = perclos_window_size
        self.ear_history = deque(maxlen=perclos_window_size)
        self.closure_history = deque(maxlen=perclos_window_size) # 1 if closed, 0 if open
        
        # Blink & Microsleep State Tracking
        self.blink_count = 0
        self.eyes_closed_start_time = None
        self.last_blink_duration_ms = 0.0
        self.is_currently_closed = False
        self.blink_timestamps = deque(maxlen=60) # Timestamps of blinks in last 60 seconds

    def calculate_ear(self, eye_landmarks: List[Tuple[int, int]]) -> float:
        """
        Calculates Eye Aspect Ratio (EAR) from 6 2D eye landmark coordinates:
        p1 (outer corner), p2 (top left), p3 (top right), p4 (inner corner), p5 (bottom right), p6 (bottom left).
        """
        if len(eye_landmarks) < 6:
            return 0.28  # Default open eye

        p1, p2, p3, p4, p5, p6 = [np.array(pt, dtype=np.float64) for pt in eye_landmarks[:6]]

        v1 = np.linalg.norm(p2 - p6)
        v2 = np.linalg.norm(p3 - p5)
        h = np.linalg.norm(p1 - p4)

        if h == 0:
            return 0.0

        ear = (v1 + v2) / (2.0 * h)
        return float(ear)

    def analyze_eyes(self, left_eye: List[Tuple[int, int]], right_eye: List[Tuple[int, int]]) -> Dict:
        """
        Calculates EAR, PERCLOS, Blink Frequency, Blink Duration, and Microsleep detection.
        """
        left_ear = self.calculate_ear(left_eye)
        right_ear = self.calculate_ear(right_eye)
        avg_ear = round((left_ear + right_ear) / 2.0, 3)

        current_time = time.time()
        is_closed = avg_ear < self.ear_threshold

        # Update PERCLOS Rolling History
        self.ear_history.append(avg_ear)
        self.closure_history.append(1 if is_closed else 0)

        perclos_pct = round((sum(self.closure_history) / max(1, len(self.closure_history))) * 100.0, 1)

        # Track Eye Closure Duration & Microsleep
        closure_duration_s = 0.0
        is_microsleep = False
        eye_state = "Eyes Open"

        if is_closed:
            if not self.is_currently_closed:
                self.is_currently_closed = True
                self.eyes_closed_start_time = current_time

            closure_duration_s = current_time - self.eyes_closed_start_time
            self.last_blink_duration_ms = round(closure_duration_s * 1000.0, 1)

            if closure_duration_s >= 1.5:
                is_microsleep = True
                eye_state = "MICROSLEEP DETECTED (>1.5s)"
            elif closure_duration_s >= 0.5:
                eye_state = "Long Blink / Eye Drooping"
            else:
                eye_state = "Blinking"

        else:
            if self.is_currently_closed:
                # Eye just reopened: Register completed blink
                self.is_currently_closed = False
                if self.eyes_closed_start_time is not None:
                    duration_s = current_time - self.eyes_closed_start_time
                    self.last_blink_duration_ms = round(duration_s * 1000.0, 1)
                    if 0.08 <= duration_s <= 1.2:
                        self.blink_count += 1
                        self.blink_timestamps.append(current_time)
                self.eyes_closed_start_time = None

            eye_state = "Eyes Open"

        # Calculate Blinks Per Minute (BPM) over last 60s
        cutoff = current_time - 60.0
        recent_blinks = [t for t in self.blink_timestamps if t >= cutoff]
        blinks_per_min = len(recent_blinks)

        return {
            "ear": avg_ear,
            "left_ear": round(left_ear, 3),
            "right_ear": round(right_ear, 3),
            "perclos_pct": perclos_pct,
            "is_closed": is_closed,
            "is_microsleep": is_microsleep,
            "closure_duration_s": round(closure_duration_s, 2),
            "last_blink_duration_ms": self.last_blink_duration_ms,
            "blink_count": self.blink_count,
            "blinks_per_min": blinks_per_min,
            "eye_state": eye_state
        }

blink_analyzer = BlinkAnalyzer()
