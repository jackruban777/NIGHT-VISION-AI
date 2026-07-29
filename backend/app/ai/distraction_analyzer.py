import time
from typing import Dict, List, Optional

class DistractionAnalyzer:
    def __init__(self):
        self.no_face_start_time = None
        self.looking_away_start_time = None
        self.phone_detected_start_time = None

    def analyze_distraction(self, face_detected: bool, head_pose_info: Dict, detections: List[Dict]) -> Dict:
        """
        Analyzes driver distraction, phone usage, looking away, and driver absence.
        """
        current_time = time.time()
        
        # 1. Driver Absence Detection
        if not face_detected:
            if self.no_face_start_time is None:
                self.no_face_start_time = current_time
            absence_duration_s = current_time - self.no_face_start_time
            
            is_absent = absence_duration_s >= 2.0
            return {
                "distraction_state": "DRIVER ABSENT" if is_absent else "Detecting Face...",
                "is_distracted": is_absent,
                "is_phone_usage": False,
                "is_looking_away": False,
                "is_driver_absent": is_absent,
                "absence_duration_s": round(absence_duration_s, 1),
                "distraction_score": 100 if is_absent else 20
            }
        else:
            self.no_face_start_time = None

        # 2. Phone Usage Detection from YOLO object detections
        is_phone_in_frame = False
        for det in detections:
            obj_cls = det.get("class", "").lower()
            if "phone" in obj_cls or "cell phone" in obj_cls or "mobile" in obj_cls:
                is_phone_in_frame = True
                break

        # Check if driver is looking down at phone
        looking_away = head_pose_info.get("looking_away", False)
        head_down = head_pose_info.get("head_down", False)

        is_phone_usage = is_phone_in_frame and (head_down or looking_away)

        if is_phone_usage:
            if self.phone_detected_start_time is None:
                self.phone_detected_start_time = current_time
            phone_duration_s = current_time - self.phone_detected_start_time
        else:
            self.phone_detected_start_time = None
            phone_duration_s = 0.0

        # 3. Looking Away Duration Tracking
        if looking_away:
            if self.looking_away_start_time is None:
                self.looking_away_start_time = current_time
            looking_away_duration_s = current_time - self.looking_away_start_time
        else:
            self.looking_away_start_time = None
            looking_away_duration_s = 0.0

        # Classify Distraction Level
        distraction_state = "Road Attentive"
        distraction_score = 0
        is_distracted = False

        if is_phone_usage or phone_duration_s >= 1.0:
            distraction_state = "PHONE DISTRACTION"
            distraction_score = 85
            is_distracted = True
        elif looking_away_duration_s >= 2.0:
            distraction_state = "LOOKING AWAY FROM ROAD"
            distraction_score = 70
            is_distracted = True
        elif looking_away:
            distraction_state = "Glancing Away"
            distraction_score = 35

        return {
            "distraction_state": distraction_state,
            "is_distracted": is_distracted,
            "is_phone_usage": is_phone_usage,
            "is_looking_away": looking_away_duration_s >= 1.5,
            "is_driver_absent": False,
            "looking_away_duration_s": round(looking_away_duration_s, 1),
            "phone_duration_s": round(phone_duration_s, 1),
            "distraction_score": distraction_score
        }

distraction_analyzer = DistractionAnalyzer()
