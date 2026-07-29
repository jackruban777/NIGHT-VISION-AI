import time
from typing import Dict, Optional

class VoiceAlertManager:
    """
    Backend Voice Alert Manager with 3-Level Hierarchy and Cooldown Debouncing.
    
    Level 1 (Score 31-60 or Looking Away): "Please stay attentive."
    Level 2 (Score 61-80): "You appear drowsy. Please take a break."
    Level 3 (Score 81-100 or Microsleep): "Critical fatigue detected. Stop driving immediately."
    """
    def __init__(self, cooldown_seconds: float = 6.0):
        self.cooldown_seconds = cooldown_seconds
        self.last_alert_time: Dict[str, float] = {}
        self.last_played_alert_level: int = 0

    def evaluate_alert(self, risk_tier: str, driver_state: str, is_driver_absent: bool) -> Optional[Dict]:
        current_time = time.time()

        alert_text = None
        alert_level = 0
        alert_key = None

        if is_driver_absent:
            alert_text = "Driver not detected. Please take control."
            alert_level = 3
            alert_key = "driver_absent"

        elif risk_tier == "Critical" or driver_state in ["Microsleep", "Sleeping"]:
            alert_text = "Critical fatigue detected. Stop driving immediately."
            alert_level = 3
            alert_key = "critical_fatigue"

        elif risk_tier == "Drowsy" or driver_state == "Drowsy":
            alert_text = "You appear drowsy. Please take a break."
            alert_level = 2
            alert_key = "drowsy_warning"

        elif risk_tier == "Warning" or driver_state == "Slightly Drowsy":
            alert_text = "Please stay attentive."
            alert_level = 1
            alert_key = "stay_attentive"

        if alert_text is None or alert_key is None:
            return None

        # Check debouncing cooldown
        last_time = self.last_alert_time.get(alert_key, 0.0)
        time_since_last = current_time - last_time

        # High priority level 3 can override level 1/2 cooldown if escalated
        is_escalation = alert_level > self.last_played_alert_level and time_since_last > 2.0

        if time_since_last >= self.cooldown_seconds or is_escalation:
            self.last_alert_time[alert_key] = current_time
            self.last_played_alert_level = alert_level
            return {
                "alert_level": alert_level,
                "text": alert_text,
                "key": alert_key,
                "timestamp": current_time
            }

        return None

voice_alert_manager = VoiceAlertManager()
