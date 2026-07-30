"""
modules/drowsiness.py
=====================
Driver Drowsiness & Fatigue Detection using OpenCV DNN Face + Eye detection.

Works fully offline — no extra model downloads needed.
Uses OpenCV's built-in HOG + eye-region intensity analysis.

Features:
  • Face ROI detection via YOLO (reuses existing model)
  • Eye region brightness analysis → blink / eye-closure detection
  • Consecutive closed-eye frame counting → DROWSY alert
  • Yawn detection via mouth open ratio
  • Head nod via face bounding box vertical drift
"""

import cv2
import numpy as np
import time
import os

# ── Project-local cascade files (OpenCV 5 doesn't ship them) ─────────────────
_CASCADE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'cascades')

def _load_cascade(xml_name):
    path = os.path.join(_CASCADE_DIR, xml_name)
    if not os.path.exists(path):
        print(f"[drowsiness] Cascade file not found: {path}")
        return None
    try:
        if hasattr(cv2, 'objdetect') and hasattr(cv2.objdetect, 'CascadeClassifier'):
            cc = cv2.objdetect.CascadeClassifier(path)
        elif hasattr(cv2, 'CascadeClassifier'):
            cc = cv2.CascadeClassifier(path)
        else:
            return None
        return cc if not cc.empty() else None
    except Exception as e:
        print(f"[drowsiness] Cascade load error: {e}")
        return None

_FACE_CC = _load_cascade('haarcascade_frontalface_default.xml')
_EYE_CC  = _load_cascade('haarcascade_eye.xml')

# ── Thresholds ────────────────────────────────────────────────────────────────
EAR_CONSEC_FRAMES = 20       # consecutive no-eye-detected frames → drowsy
YAWN_FRAMES       = 12       # consecutive large-mouth frames → yawn
HEAD_DRIFT_PX     = 40       # px face drops before head-nod alert


class DrowsinessDetector:
    """
    Stateful drowsiness detector using OpenCV cascade classifiers.
    Call analyse(frame) every frame to get results.
    """

    def __init__(self):
        self.available        = (_FACE_CC is not None)
        self._no_eye_count    = 0
        self._yawn_count      = 0
        self._last_face_y     = None
        self._drift_count     = 0
        self._last_alert_time = 0

    # ── internal helpers ──────────────────────────────────────────────────────
    def _detect_faces(self, gray):
        if _FACE_CC is None:
            return []
        try:
            return _FACE_CC.detectMultiScale(gray, 1.1, 5, minSize=(80, 80))
        except Exception:
            return []

    def _detect_eyes(self, face_gray):
        if _EYE_CC is None:
            return []
        try:
            return _EYE_CC.detectMultiScale(face_gray, 1.1, 5, minSize=(20, 20))
        except Exception:
            return []

    def _mouth_open_ratio(self, face_gray, face_h):
        """Simple vertical gradient in lower-face region as yawn proxy."""
        mouth_roi = face_gray[int(face_h * 0.65):, :]
        if mouth_roi.size == 0:
            return 0.0
        _, thresh = cv2.threshold(mouth_roi, 60, 255, cv2.THRESH_BINARY_INV)
        dark_ratio = np.sum(thresh > 0) / max(thresh.size, 1)
        return float(dark_ratio)

    # ── main analyse ──────────────────────────────────────────────────────────
    def analyse(self, frame):
        """
        Returns dict:
          face_found, eyes_visible, eye_count, yawning, nodding,
          alert_level ('NONE'|'WARNING'|'DANGER'), alert_msg, annotated
        """
        annotated = frame.copy()
        result = dict(
            face_found   = False,
            eyes_visible = False,
            eye_count    = 0,
            yawning      = False,
            nodding      = False,
            ear          = 1.0,   # proxy: 1=open, 0=closed
            mar          = 0.0,
            head_tilt    = 0.0,
            alert_level  = 'NONE',
            alert_msg    = '',
            annotated    = annotated,
        )

        gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray  = cv2.equalizeHist(gray)
        faces = self._detect_faces(gray)

        if len(faces) == 0:
            self._no_eye_count = min(self._no_eye_count + 1, EAR_CONSEC_FRAMES + 5)
            result['annotated'] = annotated
            return result

        # Use the largest face
        fx, fy, fw, fh = max(faces, key=lambda r: r[2] * r[3])
        result['face_found'] = True

        # Draw face box
        cv2.rectangle(annotated, (fx, fy), (fx+fw, fy+fh), (0, 229, 255), 2)
        cv2.putText(annotated, 'DRIVER FACE', (fx, fy - 8),
                    cv2.FONT_HERSHEY_DUPLEX, 0.5, (0, 229, 255), 1, cv2.LINE_AA)

        # ── Eye detection inside upper face ───────────────────────────────
        face_gray     = gray[fy:fy+fh, fx:fx+fw]
        upper_face    = face_gray[:int(fh * 0.6), :]
        eyes          = self._detect_eyes(upper_face)
        eye_count     = len(eyes)
        result['eye_count']    = eye_count
        result['eyes_visible'] = eye_count >= 1

        # EAR proxy: 1 if both eyes visible, 0.5 if one, 0 if none
        ear_proxy = eye_count / 2.0
        result['ear'] = round(ear_proxy, 2)

        for (ex, ey, ew, eh) in eyes:
            # absolute coords
            cv2.rectangle(annotated, (fx+ex, fy+ey), (fx+ex+ew, fy+ey+eh), (0, 230, 120), 1)

        # Consecutive no-eye counter
        if eye_count == 0:
            self._no_eye_count += 1
        else:
            self._no_eye_count = max(0, self._no_eye_count - 3)

        # ── Mouth / yawn detection ────────────────────────────────────────
        mar = self._mouth_open_ratio(face_gray, fh)
        result['mar'] = round(mar, 3)
        if mar > 0.18:
            self._yawn_count += 1
        else:
            self._yawn_count = max(0, self._yawn_count - 1)
        yawning = self._yawn_count >= YAWN_FRAMES
        result['yawning'] = yawning

        # ── Head nod (vertical drift of face Y) ───────────────────────────
        face_center_y = fy + fh // 2
        if self._last_face_y is not None:
            drift = face_center_y - self._last_face_y
            if drift > HEAD_DRIFT_PX:
                self._drift_count += 1
            else:
                self._drift_count = max(0, self._drift_count - 1)
        self._last_face_y = face_center_y
        nodding = self._drift_count >= 4
        result['nodding']    = nodding
        result['head_tilt']  = float(self._drift_count)

        # ── HUD overlays ──────────────────────────────────────────────────
        eye_color = (0, 60, 255) if eye_count == 0 else (0, 230, 120)
        h_frame   = frame.shape[0]
        cv2.putText(annotated, f'EYES:{eye_count}/2', (10, 30),
                    cv2.FONT_HERSHEY_DUPLEX, 0.55, eye_color, 1, cv2.LINE_AA)
        cv2.putText(annotated, f'YAWN:{self._yawn_count}', (10, 52),
                    cv2.FONT_HERSHEY_DUPLEX, 0.55, (0, 200, 255), 1, cv2.LINE_AA)
        cv2.putText(annotated, f'NOD:{self._drift_count}', (10, 74),
                    cv2.FONT_HERSHEY_DUPLEX, 0.55, (200, 200, 0), 1, cv2.LINE_AA)

        # ── Alert level ───────────────────────────────────────────────────
        alert_level = 'NONE'
        alert_msg   = ''

        if self._no_eye_count >= EAR_CONSEC_FRAMES:
            alert_level = 'DANGER'
            alert_msg   = f'🚨 EYES CLOSED {self._no_eye_count} FRAMES — WAKE UP! DRIVER ALERT!'
            # Red danger overlay
            ov = annotated.copy()
            cv2.rectangle(ov, (0, 0), (annotated.shape[1], annotated.shape[0]), (0, 0, 180), -1)
            cv2.addWeighted(ov, 0.2, annotated, 0.8, 0, annotated)
            cv2.putText(annotated, '! DROWSY !',
                        (annotated.shape[1]//2 - 100, annotated.shape[0]//2),
                        cv2.FONT_HERSHEY_DUPLEX, 1.8, (0, 60, 255), 3, cv2.LINE_AA)
        elif nodding:
            alert_level = 'DANGER'
            alert_msg   = '🚨 HEAD NODDING — Driver falling asleep!'
        elif yawning:
            alert_level = 'WARNING'
            alert_msg   = '⚠️ YAWNING DETECTED — Driver fatigue warning!'
        elif self._no_eye_count >= EAR_CONSEC_FRAMES // 2:
            alert_level = 'WARNING'
            alert_msg   = '⚠️ Eyes drooping — Stay alert!'

        result['alert_level'] = alert_level
        result['alert_msg']   = alert_msg
        result['annotated']   = annotated
        return result

    def release(self):
        pass   # no resources to free
