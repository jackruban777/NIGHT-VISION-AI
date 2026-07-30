import time
import numpy as np
from collections import deque
from typing import Dict, List

class DMSRiskEngine:
    """
    Production Multi-Stage Weighted Confidence System with Rolling Window False Positive Reduction.
    
    Weights:
      - Eye Closure (EAR < 0.20): 30%
      - Long Blink / Microsleep: 20%
      - Yawning (MAR > 0.50): 15%
      - Head Down / Nodding: 15%
      - Looking Away / Phone Usage: 10%
      - High PERCLOS / Repeated Blinks: 10%
      
    Tiers:
      - 0-30: Safe
      - 31-60: Warning
      - 61-80: Drowsy
      - 81-100: Critical
    """
    def __init__(self, buffer_size: int = 150): # ~5 seconds at 30 FPS
        self.buffer_size = buffer_size
        self.score_history = deque(maxlen=buffer_size)

    def calculate_risk_score(
        self,
        eye_metrics: Dict,
        yawn_metrics: Dict,
        head_pose: Dict,
        phone_distraction: Dict,
        driver_absent: bool
    ) -> Dict:
        """
        Calculates instantaneous weighted risk score (0-100) and filtered rolling risk score.
        """
        if driver_absent:
            self.score_history.append(100.0)
            return {
                "risk_score": 100,
                "instant_score": 100,
                "risk_tier": "Critical",
                "risk_color": "#EF4444",
                "is_false_positive_filtered": False,
                "weights_breakdown": {
                    "eye_closure": 30.0,
                    "microsleep": 20.0,
                    "yawning": 15.0,
                    "head_down": 15.0,
                    "distraction": 10.0,
                    "perclos": 10.0
                }
            }

        # 1. Eye Closure Component (0 - 30)
        ear = eye_metrics.get("ear", 0.28)
        is_closed = eye_metrics.get("is_closed", False)
        closure_dur = eye_metrics.get("closure_duration_s", 0.0)

        eye_score = 0.0
        if is_closed:
            if closure_dur >= 0.5:
                eye_score = 30.0
            else:
                eye_score = 20.0 + min(10.0, (0.20 - ear) * 100.0)
        elif ear < 0.22:
            eye_score = 10.0

        # 2. Microsleep / Long Blink Component (0 - 20)
        microsleep_score = 0.0
        if eye_metrics.get("is_microsleep", False):
            microsleep_score = 20.0
        elif closure_dur >= 0.5:
            microsleep_score = 12.0

        # 3. Yawning Component (0 - 15)
        mar = yawn_metrics.get("mar", 0.15)
        is_yawning = yawn_metrics.get("is_yawning", False)
        yawn_severity = yawn_metrics.get("yawn_severity", "Normal")

        yawn_score = 0.0
        if is_yawning:
            if yawn_severity == "Long Yawn":
                yawn_score = 15.0
            elif yawn_severity == "Medium Yawn":
                yawn_score = 12.0
            else:
                yawn_score = 8.0
        elif mar > 0.40:
            yawn_score = 5.0

        # 4. Head Down / Nodding Component (0 - 15)
        head_down_score = 0.0
        if head_pose.get("head_down", False):
            pitch = abs(head_pose.get("pitch", 0.0))
            head_down_score = min(15.0, 8.0 + (pitch - 15.0) * 0.7)

        # 5. Distraction & Phone Usage Component (0 - 10)
        distraction_score = 0.0
        if phone_distraction.get("is_phone_distracted", False):
            distraction_score = 10.0
        elif head_pose.get("looking_away", False):
            distraction_score = 7.0

        # 6. PERCLOS / Repeated Blinks Component (0 - 10)
        perclos_pct = eye_metrics.get("perclos_pct", 0.0)
        perclos_score = min(10.0, (perclos_pct / 20.0) * 10.0)

        # Instantaneous Sum (0 - 100)
        instant_score = min(100.0, round(
            eye_score + microsleep_score + yawn_score + head_down_score + distraction_score + perclos_score, 1
        ))

        # Add to rolling window history to filter out single-frame blips
        self.score_history.append(instant_score)

        # 5-10s Rolling Window Exponential Smoothing Filter
        scores_arr = list(self.score_history)
        if len(scores_arr) >= 5:
            # Weighted average giving more weight to sustained higher scores
            avg_score = float(np.mean(scores_arr))
            max_score = float(np.max(scores_arr))
            filtered_score = round(0.65 * avg_score + 0.35 * max_score, 1)
        else:
            filtered_score = instant_score

        # Determine Tier
        if filtered_score >= 81.0 or eye_metrics.get("is_microsleep", False) or closure_dur >= 2.5:
            tier = "Critical"
            color = "#EF4444" # Red
        elif filtered_score >= 61.0:
            tier = "Drowsy"
            color = "#F97316" # Orange
        elif filtered_score >= 31.0:
            tier = "Warning"
            color = "#FBBF24" # Amber/Yellow
        else:
            tier = "Safe"
            color = "#10B981" # Emerald Green

        return {
            "risk_score": int(round(filtered_score)),
            "instant_score": int(round(instant_score)),
            "risk_tier": tier,
            "risk_color": color,
            "is_false_positive_filtered": len(scores_arr) >= 5,
            "weights_breakdown": {
                "eye_closure": round(eye_score, 1),
                "microsleep": round(microsleep_score, 1),
                "yawning": round(yawn_score, 1),
                "head_down": round(head_down_score, 1),
                "distraction": round(distraction_score, 1),
                "perclos": round(perclos_score, 1)
            }
        }

risk_engine = DMSRiskEngine()
