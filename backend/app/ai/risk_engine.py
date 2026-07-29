from typing import Dict

class MultiStageRiskEngine:
    def compute_risk_score(
        self,
        blink_info: Dict,
        yawn_info: Dict,
        head_pose_info: Dict,
        distraction_info: Dict,
        temporal_info: Dict
    ) -> Dict:
        """
        Calculates 0-100 Weighted Risk Score using multi-factor decision matrix:
          - Eyes Closed / PERCLOS (30%)
          - Long Blink / Microsleep (20%)
          - Yawning / MAR (15%)
          - Head Nodding / Down (15%)
          - Looking Away / Phone (10%)
          - Blink Frequency anomaly (10%)
        """
        # 1. PERCLOS / Eye Closure Sub-score (30% Max)
        perclos = temporal_info.get("temporal_perclos", blink_info.get("perclos_pct", 0.0))
        eye_score = min(30.0, (perclos / 50.0) * 30.0)

        # 2. Microsleep & Long Blink Sub-score (20% Max)
        microsleep_score = 0.0
        if blink_info.get("is_microsleep", False):
            microsleep_score = 20.0
        elif blink_info.get("last_blink_duration_ms", 0.0) > 400:
            microsleep_score = 12.0
        elif blink_info.get("is_closed", False):
            microsleep_score = 8.0

        # 3. Yawning / MAR Sub-score (15% Max)
        yawn_score = 0.0
        if yawn_info.get("repeated_yawning", False):
            yawn_score = 15.0
        elif yawn_info.get("is_yawning", False):
            dur = yawn_info.get("yawn_duration_s", 0.0)
            if dur >= 4.0:
                yawn_score = 15.0
            elif dur >= 2.0:
                yawn_score = 10.0
            else:
                yawn_score = 6.0

        # 4. Head Nodding / Down Sub-score (15% Max)
        head_score = 0.0
        pitch = head_pose_info.get("pitch", 0.0)
        if head_pose_info.get("head_down", False) or pitch < -15.0:
            head_score = 15.0
        elif abs(head_pose_info.get("roll", 0.0)) > 20.0:
            head_score = 8.0

        # 5. Phone / Looking Away Sub-score (10% Max)
        distraction_score = 0.0
        if distraction_info.get("is_phone_usage", False):
            distraction_score = 10.0
        elif distraction_info.get("is_looking_away", False):
            distraction_score = 8.0
        elif distraction_info.get("is_driver_absent", False):
            distraction_score = 10.0

        # 6. Blink Frequency Anomaly Sub-score (10% Max)
        bpm_score = 0.0
        bpm = blink_info.get("blinks_per_min", 15)
        if bpm > 35 or (bpm < 4 and bpm > 0):
            bpm_score = 10.0
        elif bpm > 25:
            bpm_score = 5.0

        # Sum Weighted Total Risk Score (0-100)
        raw_risk = eye_score + microsleep_score + yawn_score + head_score + distraction_score + bpm_score
        
        # Override for Critical Emergencies (Immediate High Severity)
        if temporal_info.get("driver_state") == "Sleeping" or distraction_info.get("is_driver_absent"):
            raw_risk = max(raw_risk, 92.0)
        elif blink_info.get("is_microsleep", False):
            raw_risk = max(raw_risk, 82.0)

        risk_score = min(100, max(0, int(round(raw_risk))))

        # Categorize Risk Level
        if risk_score <= 30:
            risk_level = "Safe"
            status_color = "emerald"
            voice_alert_level = 0
            alert_message = "Nominal Driving Condition"
        elif risk_score <= 60:
            risk_level = "Warning"
            status_color = "amber"
            voice_alert_level = 1
            alert_message = "Please stay attentive."
        elif risk_score <= 80:
            risk_level = "Drowsy"
            status_color = "orange"
            voice_alert_level = 2
            alert_message = "You appear drowsy. Please take a break."
        else:
            risk_level = "Critical"
            status_color = "red"
            voice_alert_level = 3
            alert_message = "Critical fatigue detected. Stop driving immediately."

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "status_color": status_color,
            "voice_alert_level": voice_alert_level,
            "alert_message": alert_message,
            "breakdown": {
                "eye_closure": round(eye_score, 1),
                "microsleep": round(microsleep_score, 1),
                "yawning": round(yawn_score, 1),
                "head_nodding": round(head_score, 1),
                "distraction": round(distraction_score, 1),
                "blink_anomaly": round(bpm_score, 1)
            }
        }

risk_engine = MultiStageRiskEngine()
