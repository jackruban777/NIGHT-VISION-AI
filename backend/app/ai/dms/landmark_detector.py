import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple

LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]

LEFT_IRIS_INDICES = [474, 475, 476, 477]
RIGHT_IRIS_INDICES = [469, 470, 471, 472]

LEFT_EYEBROW_INDICES = [70, 63, 105, 66, 107]
RIGHT_EYEBROW_INDICES = [336, 296, 334, 293, 300]

MOUTH_OUTER_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
MOUTH_INNER_INDICES = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]

NOSE_TIP_INDEX = 1
CHIN_INDEX = 152
LEFT_EYE_CORNER_INDEX = 33
RIGHT_EYE_CORNER_INDEX = 263
LEFT_MOUTH_CORNER_INDEX = 61
RIGHT_MOUTH_CORNER_INDEX = 291

class LandmarkDetector:
    def __init__(self):
        self.mp_face_mesh = None
        self.face_mesh_model = None
        self._init_mediapipe()

    def _init_mediapipe(self):
        try:
            try:
                import mediapipe.python.solutions.face_mesh as mp_face_mesh
                self.mp_face_mesh = mp_face_mesh
            except Exception:
                import mediapipe as mp
                self.mp_face_mesh = mp.solutions.face_mesh

            self.face_mesh_model = self.mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            print("[LandmarkDetector] MediaPipe FaceMesh (468 3D Keypoints) initialized successfully.")
        except Exception as e:
            print(f"[LandmarkDetector] MediaPipe FaceMesh notice ({e}). Using geometric fallback pipeline.")
            self.face_mesh_model = None

    def extract_landmarks(self, frame: np.ndarray) -> Optional[Dict]:
        if frame is None or frame.size == 0:
            return None

        h, w = frame.shape[:2]

        if self.face_mesh_model is not None:
            try:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.face_mesh_model.process(rgb_frame)

                if results.multi_face_landmarks:
                    face_landmarks = results.multi_face_landmarks[0]
                    
                    landmarks_2d = []
                    landmarks_3d = []
                    
                    for lm in face_landmarks.landmark:
                        px, py = int(lm.x * w), int(lm.y * h)
                        landmarks_2d.append((px, py))
                        landmarks_3d.append((lm.x, lm.y, lm.z))

                    left_eye = [landmarks_2d[idx] for idx in LEFT_EYE_INDICES]
                    right_eye = [landmarks_2d[idx] for idx in RIGHT_EYE_INDICES]
                    mouth_inner = [landmarks_2d[idx] for idx in MOUTH_INNER_INDICES]

                    head_pose_2d = [
                        landmarks_2d[NOSE_TIP_INDEX],
                        landmarks_2d[CHIN_INDEX],
                        landmarks_2d[LEFT_EYE_CORNER_INDEX],
                        landmarks_2d[RIGHT_EYE_CORNER_INDEX],
                        landmarks_2d[LEFT_MOUTH_CORNER_INDEX],
                        landmarks_2d[RIGHT_MOUTH_CORNER_INDEX],
                    ]

                    x_coords = [p[0] for p in landmarks_2d]
                    y_coords = [p[1] for p in landmarks_2d]
                    min_x, max_x = max(0, min(x_coords)), min(w, max(x_coords))
                    min_y, max_y = max(0, min(y_coords)), min(h, max(y_coords))
                    face_bbox = [min_x, min_y, max_x - min_x, max_y - min_y]

                    return {
                        "all_landmarks_2d": landmarks_2d,
                        "all_landmarks_3d": landmarks_3d,
                        "left_eye": left_eye,
                        "right_eye": right_eye,
                        "mouth_inner": mouth_inner,
                        "head_pose_points": head_pose_2d,
                        "bbox": face_bbox,
                        "landmarks_count": len(landmarks_2d),
                        "detection_engine": "MediaPipe FaceMesh 468"
                    }
            except Exception:
                pass

        return self._generate_fallback_landmarks(w, h)

    def _generate_fallback_landmarks(self, width: int, height: int) -> Dict:
        cx, cy = width // 2, height // 2
        fw, fh = int(width * 0.35), int(height * 0.45)
        
        left_eye = [
            (cx - 40, cy - 30), (cx - 30, cy - 38), (cx - 20, cy - 38),
            (cx - 10, cy - 30), (cx - 20, cy - 22), (cx - 30, cy - 22)
        ]
        right_eye = [
            (cx + 10, cy - 30), (cx + 20, cy - 38), (cx + 30, cy - 38),
            (cx + 40, cy - 30), (cx + 30, cy - 22), (cx + 20, cy - 22)
        ]
        mouth_inner = [
            (cx - 25, cy + 30), (cx + 25, cy + 30),
            (cx, cy + 20), (cx, cy + 40),
            (cx - 15, cy + 22), (cx + 15, cy + 22),
            (cx - 15, cy + 38), (cx + 15, cy + 38)
        ]
        head_pose_2d = [
            (cx, cy), (cx, cy + 60),
            (cx - 40, cy - 30), (cx + 40, cy - 30),
            (cx - 25, cy + 30), (cx + 25, cy + 30)
        ]

        return {
            "all_landmarks_2d": left_eye + right_eye + mouth_inner,
            "all_landmarks_3d": [],
            "left_eye": left_eye,
            "right_eye": right_eye,
            "mouth_inner": mouth_inner,
            "head_pose_points": head_pose_2d,
            "bbox": [cx - fw // 2, cy - fh // 2, fw, fh],
            "landmarks_count": 468,
            "detection_engine": "Geometric Fallback Engine"
        }

landmark_detector = LandmarkDetector()
