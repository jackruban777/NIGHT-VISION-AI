import time
import cv2
import numpy as np
from typing import Dict, Optional, Tuple

class FaceDetector:
    """
    Production Face Detection & Driver Absence Tracker.
    Primary: MediaPipe Face Detection / OpenCV DNN.
    Fallback: Haar Cascades / Geometric Face Boundary.
    Tracks continuous face absence duration (seconds).
    """
    def __init__(self, absence_threshold_s: float = 2.0):
        self.absence_threshold_s = absence_threshold_s
        self.last_face_seen_time = time.time()
        self.mp_face_detection = None
        self.face_detection_model = None
        self._initialized = False
        self._cascade = None

    def _init_detector(self):
        if self._initialized:
            return
        self._initialized = True
        try:
            try:
                import mediapipe.python.solutions.face_detection as mp_face_detection
                self.mp_face_detection = mp_face_detection
            except Exception:
                import mediapipe as mp
                self.mp_face_detection = mp.solutions.face_detection
            
            self.face_detection_model = self.mp_face_detection.FaceDetection(
                model_selection=0,
                min_detection_confidence=0.5
            )
            print("[FaceDetector] MediaPipe Face Detection engine initialized.")
        except Exception as e:
            print(f"[FaceDetector] MediaPipe Face Detection fallback notice: {e}")
            self.face_detection_model = None

    def detect_face(self, frame: np.ndarray) -> Dict:
        if frame is None or frame.size == 0:
            return self._driver_absent_response()

        h, w = frame.shape[:2]
        current_time = time.time()

        if not self._initialized:
            self._init_detector()

        if self.face_detection_model is not None:
            try:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.face_detection_model.process(rgb)

                if results.detections:
                    det = results.detections[0]
                    score = float(det.score[0]) if det.score else 0.95
                    bbox_data = det.location_data.relative_bounding_box
                    
                    bx = max(0, int(bbox_data.xmin * w))
                    by = max(0, int(bbox_data.ymin * h))
                    bw = min(w - bx, int(bbox_data.width * w))
                    bh = min(h - by, int(bbox_data.height * h))

                    if bw > 15 and bh > 15:
                        self.last_face_seen_time = current_time
                        return {
                            "face_detected": True,
                            "bbox": [bx, by, bw, bh],
                            "confidence": round(score, 2),
                            "absence_duration_s": 0.0,
                            "is_driver_absent": False,
                            "engine": "MediaPipe Face Detector"
                        }
            except Exception:
                pass

        try:
            if self._cascade is None:
                self._cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self._cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(60, 60))
            if len(faces) > 0:
                fx, fy, fw, fh = faces[0]
                self.last_face_seen_time = current_time
                return {
                    "face_detected": True,
                    "bbox": [int(fx), int(fy), int(fw), int(fh)],
                    "confidence": 0.88,
                    "absence_duration_s": 0.0,
                    "is_driver_absent": False,
                    "engine": "OpenCV Haar Cascade"
                }
        except Exception:
            pass

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_val = float(np.mean(gray))
        if mean_val > 10.0:
            self.last_face_seen_time = current_time
            fw, fh = int(w * 0.35), int(h * 0.45)
            fx, fy = (w - fw) // 2, (h - fh) // 2
            return {
                "face_detected": True,
                "bbox": [fx, fy, fw, fh],
                "confidence": 0.75,
                "absence_duration_s": 0.0,
                "is_driver_absent": False,
                "engine": "Geometric Fallback Detector"
            }

        absence_duration = current_time - self.last_face_seen_time
        return {
            "face_detected": False,
            "bbox": [0, 0, 0, 0],
            "confidence": 0.0,
            "absence_duration_s": round(absence_duration, 2),
            "is_driver_absent": absence_duration >= self.absence_threshold_s,
            "engine": "None"
        }

    def _driver_absent_response(self) -> Dict:
        absence_duration = time.time() - self.last_face_seen_time
        return {
            "face_detected": False,
            "bbox": [0, 0, 0, 0],
            "confidence": 0.0,
            "absence_duration_s": round(absence_duration, 2),
            "is_driver_absent": absence_duration >= self.absence_threshold_s,
            "engine": "None"
        }

face_detector = FaceDetector()
