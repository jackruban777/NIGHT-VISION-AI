import numpy as np
from typing import Dict, List, Optional, Tuple

class PhoneDistractionDetector:
    """
    Detects phone usage and driver distraction.
    Checks:
      1. YOLO detections for phone / cell phone objects.
      2. Spatial proximity of phone bounding box relative to face box.
      3. Gaze / Head Pose correlation (driver looking down or left/right at phone).
    """
    def __init__(self):
        pass

    def detect_phone_distraction(
        self,
        yolo_detections: List[Dict],
        face_bbox: List[int],
        head_pose: Dict
    ) -> Dict:
        """
        Args:
          yolo_detections: List of objects detected by YOLO in frame.
          face_bbox: [x, y, w, h] of driver face.
          head_pose: Dict with pitch, yaw, roll, looking_away, head_down.
        """
        phone_detected = False
        phone_near_face = False
        phone_in_hand = False
        looking_at_phone = False
        phone_bbox = [0, 0, 0, 0]
        confidence = 0.0

        for det in yolo_detections:
            cls_name = str(det.get("class", "")).lower()
            if "phone" in cls_name or "cell" in cls_name or cls_name == "mobile":
                phone_detected = True
                phone_bbox = det.get("bbox", [0, 0, 0, 0])
                confidence = float(det.get("confidence", 0.85))
                break

        if phone_detected and face_bbox and face_bbox[2] > 0:
            fx, fy, fw, fh = face_bbox
            px, py, pw, ph = phone_bbox

            # Center distance
            fc_x, fc_y = fx + fw / 2.0, fy + fh / 2.0
            pc_x, pc_y = px + pw / 2.0, py + ph / 2.0

            dist = np.sqrt((fc_x - pc_x) ** 2 + (fc_y - pc_y) ** 2)
            diag = np.sqrt(fw ** 2 + fh ** 2)

            if dist < diag * 1.5:
                phone_near_face = True

            if pc_y > fy + fh * 0.5:
                phone_in_hand = True

            # If driver head is turned towards phone or looking down while phone is active
            if head_pose.get("head_down", False) or head_pose.get("looking_away", False):
                looking_at_phone = True

        is_phone_distracted = phone_detected and (phone_near_face or looking_at_phone)

        distraction_type = "None"
        if is_phone_distracted:
            if phone_near_face:
                distraction_type = "Phone Near Face / Calling"
            elif looking_at_phone:
                distraction_type = "Driver Looking at Phone"
            else:
                distraction_type = "Phone in Hand"

        return {
            "phone_detected": phone_detected,
            "phone_near_face": phone_near_face,
            "phone_in_hand": phone_in_hand,
            "looking_at_phone": looking_at_phone,
            "is_phone_distracted": is_phone_distracted,
            "distraction_type": distraction_type,
            "phone_bbox": phone_bbox,
            "confidence": round(confidence, 2)
        }

phone_distraction_detector = PhoneDistractionDetector()
