class CollisionPredictor:
    def __init__(self):
        self.alerted_tracks = {}

    def predict_risk(self, distance_m: float, relative_speed_kmh: float = 40.0) -> dict:
        """
        Calculates Time-To-Collision (TTC) in seconds:
        TTC = (distance_m) / (relative_speed_ms)
        Returns TTC and risk classification: Low, Medium, High, Critical.
        """
        speed_ms = max(0.1, relative_speed_kmh / 3.6)
        ttc_seconds = round(distance_m / speed_ms, 2)

        if distance_m < 12.0 or ttc_seconds < 1.5:
            risk_level = "Critical"
            collision_prob = 0.95
        elif distance_m < 25.0 or ttc_seconds < 3.0:
            risk_level = "High"
            collision_prob = 0.72
        elif distance_m < 45.0 or ttc_seconds < 5.0:
            risk_level = "Medium"
            collision_prob = 0.35
        else:
            risk_level = "Low"
            collision_prob = 0.08

        return {
            "distance_m": distance_m,
            "ttc_seconds": ttc_seconds,
            "risk_level": risk_level,
            "collision_probability": collision_prob,
        }

    def should_trigger_alert(self, track_id: str, risk_level: str) -> bool:
        """
        Suppresses duplicate alerts for the same tracked object within 4-second windows.
        """
        if risk_level not in ["High", "Critical"]:
            return False

        import time
        now = time.time()
        if track_id in self.alerted_tracks:
            last_time = self.alerted_tracks[track_id]
            if now - last_time < 4.0:
                return False

        self.alerted_tracks[track_id] = now
        return True

collision_predictor = CollisionPredictor()
