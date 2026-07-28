import numpy as np

class DriverMonitor:
    def calculate_ear(self, eye_landmarks: list) -> float:
        """
        Calculates Eye Aspect Ratio (EAR) from eye landmark coordinates.
        EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
        Threshold < 0.20 signals eye closure / fatigue.
        """
        if len(eye_landmarks) < 6:
            return 0.28  # Default open eye

        p1, p2, p3, p4, p5, p6 = [np.array(pt) for pt in eye_landmarks[:6]]

        vert_dist_1 = np.linalg.norm(p2 - p6)
        vert_dist_2 = np.linalg.norm(p3 - p5)
        horiz_dist = np.linalg.norm(p1 - p4)

        if horiz_dist == 0:
            return 0.0

        ear = (vert_dist_1 + vert_dist_2) / (2.0 * horiz_dist)
        return round(float(ear), 2)

    def analyze_driver_state(self, ear: float, yawn_duration_s: float = 0.0) -> dict:
        is_drowsy = ear < 0.20 or yawn_duration_s > 3.0
        status = "Severe Drowsiness Alert" if is_drowsy else "Driver Alert"
        return {
            "ear": ear,
            "is_drowsy": is_drowsy,
            "status": status,
            "recommended_action": "Pull Over at Nearest Rest Stop Immediately" if is_drowsy else "Nominal",
        }

driver_monitor = DriverMonitor()
