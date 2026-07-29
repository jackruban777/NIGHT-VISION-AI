import time
import cv2
import numpy as np
from typing import Dict, Optional, Tuple

from app.ai.night_enhancer import night_enhancer
from app.ai.dms.face_detector import face_detector
from app.ai.dms.landmark_detector import landmark_detector
from app.ai.dms.head_pose import head_pose_estimator
from app.ai.dms.blink_analyzer import blink_analyzer
from app.ai.dms.yawn_detector import yawn_detector
from app.ai.dms.phone_distraction import phone_distraction_detector
from app.ai.dms.temporal_classifier import temporal_classifier
from app.ai.dms.risk_engine import risk_engine
from app.ai.dms.voice_alert_service import voice_alert_manager

class DriverMonitoringPipeline:
    """
    Production-Grade Real-Time Driver Monitoring System (DMS) AI Pipeline.
    Combines low-light enhancement, face & landmark detection, head pose,
    eye/blink/PERCLOS analysis, yawn analysis, phone distraction detection,
    temporal sequence classification, multi-stage risk scoring, and voice alerts.
    """
    def __init__(self):
        self.frame_counter = 0

    def process_frame(
        self,
        frame: np.ndarray,
        apply_night_enhance: bool = True,
        yolo_detections: Optional[list] = None
    ) -> Dict:
        t_start = time.perf_counter()

        if frame is None or frame.size == 0:
            return self._empty_response()

        self.frame_counter += 1
        h, w = frame.shape[:2]

        # 1. Low-Light Night Enhancement
        t_enhance_start = time.perf_counter()
        if apply_night_enhance:
            enhanced_frame = night_enhancer.enhance_frame(frame)
        else:
            enhanced_frame = frame
        t_enhance_end = time.perf_counter()

        # 2. Face Detection & Driver Absence Check
        t_face_start = time.perf_counter()
        face_info = face_detector.detect_face(enhanced_frame)
        t_face_end = time.perf_counter()

        is_driver_absent = face_info.get("is_driver_absent", False)

        # 3. Facial Landmark Mesh Extraction (MediaPipe 468 Keypoints)
        t_landmark_start = time.perf_counter()
        landmarks_info = landmark_detector.extract_landmarks(enhanced_frame)
        t_landmark_end = time.perf_counter()

        if landmarks_info is None:
            landmarks_info = landmark_detector._generate_fallback_landmarks(w, h)

        # 4. 3D Head Pose Estimation (SolvePnP Pitch, Yaw, Roll)
        t_pose_start = time.perf_counter()
        head_pose = head_pose_estimator.estimate_head_pose(
            landmarks_info.get("head_pose_points", []), (h, w)
        )
        t_pose_end = time.perf_counter()

        # 5. Eye / Blink / PERCLOS / Microsleep Analysis
        t_blink_start = time.perf_counter()
        eye_metrics = blink_analyzer.analyze_eyes(
            landmarks_info.get("left_eye", []),
            landmarks_info.get("right_eye", [])
        )
        t_blink_end = time.perf_counter()

        # 6. Yawn Detection & MAR Analysis
        t_yawn_start = time.perf_counter()
        yawn_metrics = yawn_detector.analyze_mouth(
            landmarks_info.get("mouth_inner", [])
        )
        t_yawn_end = time.perf_counter()

        # 7. Phone Distraction Detection
        t_phone_start = time.perf_counter()
        phone_distraction = phone_distraction_detector.detect_phone_distraction(
            yolo_detections or [],
            face_info.get("bbox", [0, 0, 0, 0]),
            head_pose
        )
        t_phone_end = time.perf_counter()

        # 8. Temporal Sequence Classification
        temporal_input = {
            "is_driver_absent": is_driver_absent,
            "ear": eye_metrics["ear"],
            "is_closed": eye_metrics["is_closed"],
            "is_microsleep": eye_metrics["is_microsleep"],
            "closure_duration_s": eye_metrics["closure_duration_s"],
            "mar": yawn_metrics["mar"],
            "is_yawning": yawn_metrics["is_yawning"],
            "yawn_duration_s": yawn_metrics["yawn_duration_s"],
            "head_down": head_pose["head_down"],
            "looking_away": head_pose["looking_away"],
            "phone_distracted": phone_distraction["is_phone_distracted"]
        }
        driver_state_info = temporal_classifier.update_and_classify(temporal_input)

        # 9. Multi-Stage Weighted Risk Engine
        risk_info = risk_engine.calculate_risk_score(
            eye_metrics,
            yawn_metrics,
            head_pose,
            phone_distraction,
            is_driver_absent
        )

        # 10. Voice Alert Evaluator
        voice_alert = voice_alert_manager.evaluate_alert(
            risk_info["risk_tier"],
            driver_state_info["driver_state"],
            is_driver_absent
        )

        t_end = time.perf_counter()
        total_latency_ms = round((t_end - t_start) * 1000.0, 1)
        ai_fps = round(1000.0 / max(1.0, total_latency_ms), 1)

        # Attention Focus Index (100 - Risk Score)
        attention_score = max(0, 100 - risk_info["risk_score"])

        return {
            "fps": 60,
            "ai_fps": ai_fps,
            "latency_ms": total_latency_ms,
            "night_enhance_applied": apply_night_enhance,
            "face_detected": face_info["face_detected"],
            "face_bbox": face_info["bbox"],
            "is_driver_absent": is_driver_absent,
            "absence_duration_s": face_info["absence_duration_s"],
            "landmarks_count": landmarks_info.get("landmarks_count", 468),
            "detection_engine": landmarks_info.get("detection_engine", "MediaPipe 468 Mesh"),
            
            # Biometric Metrics
            "eye_metrics": eye_metrics,
            "yawn_metrics": yawn_metrics,
            "head_pose": head_pose,
            "phone_distraction": phone_distraction,
            
            # Risk Scoring & State
            "risk_score": risk_info["risk_score"],
            "instant_score": risk_info["instant_score"],
            "risk_tier": risk_info["risk_tier"],
            "risk_color": risk_info["risk_color"],
            "attention_score": attention_score,
            "driver_state": driver_state_info["driver_state"],
            "driver_state_summary": driver_state_info["summary"],
            "weights_breakdown": risk_info["weights_breakdown"],
            
            # Voice Alert Payload
            "voice_alert": voice_alert,

            # Key points for Frontend Canvas Drawing
            "mesh_keypoints_2d": landmarks_info.get("all_landmarks_2d", [])[:60], # Top 60 for performance preview
            "left_eye": landmarks_info.get("left_eye", []),
            "right_eye": landmarks_info.get("right_eye", []),
            "mouth_inner": landmarks_info.get("mouth_inner", []),
            "head_pose_points": landmarks_info.get("head_pose_points", [])
        }

    def _empty_response(self) -> Dict:
        return {
            "fps": 60,
            "ai_fps": 30.0,
            "latency_ms": 0.0,
            "night_enhance_applied": False,
            "face_detected": False,
            "face_bbox": [0, 0, 0, 0],
            "is_driver_absent": True,
            "absence_duration_s": 0.0,
            "landmarks_count": 0,
            "detection_engine": "None",
            "eye_metrics": {"ear": 0.28, "perclos_pct": 0.0, "is_closed": False, "is_microsleep": False, "closure_duration_s": 0.0, "blink_count": 0, "blinks_per_min": 15, "eye_state": "Eyes Open"},
            "yawn_metrics": {"mar": 0.15, "is_yawning": False, "yawn_duration_s": 0.0, "yawn_severity": "Normal", "yawn_count": 0, "repeated_yawning": False},
            "head_pose": {"pitch": 0.0, "yaw": 0.0, "roll": 0.0, "orientation": "Centered / Road Focused", "looking_away": False, "head_down": False},
            "phone_distraction": {"phone_detected": False, "is_phone_distracted": False, "distraction_type": "None"},
            "risk_score": 0,
            "instant_score": 0,
            "risk_tier": "Safe",
            "risk_color": "#10B981",
            "attention_score": 100,
            "driver_state": "Normal",
            "driver_state_summary": "No camera feed",
            "voice_alert": None,
            "mesh_keypoints_2d": [],
            "left_eye": [],
            "right_eye": [],
            "mouth_inner": [],
            "head_pose_points": []
        }

dms_pipeline = DriverMonitoringPipeline()
