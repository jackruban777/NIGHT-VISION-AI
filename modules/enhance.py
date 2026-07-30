"""
modules/enhance.py  — CPU-safe fast enhancement
All modes designed to run < 5ms on a laptop CPU.
"""
import cv2
import numpy as np


def enhance_frame(frame, method="CLAHE", gamma_value=1.5):
    if frame is None or method == "None":
        return frame
    if method == "CLAHE":
        return _clahe(frame)
    elif method == "Gamma":
        return _gamma(frame, gamma_value)
    elif method == "Dehaze":
        return _dehaze(frame)
    elif method == "Hybrid":
        return _gamma(_clahe(frame), gamma_value)
    elif method == "Sharp":          # replaces old "Ultra" — fast unsharp only
        return _sharp(frame)
    return frame


def _clahe(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    return cv2.cvtColor(cv2.merge([clahe.apply(l), a, b]), cv2.COLOR_LAB2BGR)


def _gamma(frame, g=1.5):
    inv = 1.0 / max(g, 0.1)
    lut = np.array([(i / 255.0) ** inv * 255 for i in range(256)], dtype=np.uint8)
    return cv2.LUT(frame, lut)


def _dehaze(frame):
    f = frame.astype(np.float32) / 255.0
    dark = np.min(f, axis=2)
    k    = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    dc   = cv2.erode(dark, k)
    atm  = float(np.percentile(f, 99))
    t    = np.clip(1.0 - 0.85 * dc, 0.15, 1.0)
    t3   = np.stack([t] * 3, axis=2)
    rec  = np.clip((f - atm) / t3 + atm, 0, 1)
    return (rec * 255).astype(np.uint8)


def _sharp(frame):
    """Fast unsharp mask — no denoising, runs in <3ms."""
    blurred = cv2.GaussianBlur(frame, (0, 0), sigmaX=1.5)
    return cv2.addWeighted(frame, 1.5, blurred, -0.5, 0)


def draw_detection_overlay(frame, detections, font_scale=0.5):
    COLORS = {'High': (0, 30, 255), 'Medium': (0, 140, 255),
              'Low': (0, 210, 80), 'Face': (255, 200, 0)}
    for det in detections:
        box   = det['box']
        label = det.get('label', '')
        dist  = det.get('distance', '?')
        risk  = det.get('risk', 'Low')
        conf  = det.get('conf', 0.0)
        color = COLORS['Face'] if label == 'Driver Face' else COLORS.get(risk, (0, 200, 80))
        x1, y1, x2, y2 = box

        # Glow border
        ov = frame.copy()
        cv2.rectangle(ov, (x1-2, y1-2), (x2+2, y2+2), color, 4)
        cv2.addWeighted(ov, 0.35, frame, 0.65, 0, frame)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        # Corner marks
        cl = max(10, (x2-x1)//6)
        for (cx, cy, dx, dy) in [(x1,y1,1,1),(x2,y1,-1,1),(x1,y2,1,-1),(x2,y2,-1,-1)]:
            cv2.line(frame, (cx, cy), (cx+dx*cl, cy), color, 2)
            cv2.line(frame, (cx, cy), (cx, cy+dy*cl), color, 2)

        # Label
        txt = f"FACE {conf:.0%}" if label == 'Driver Face' else f"{label}  {dist}m  {risk}"
        (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_DUPLEX, font_scale, 1)
        ly = max(y1 - 4, th + 4)
        cv2.rectangle(frame, (x1, ly-th-4), (x1+tw+6, ly+2), color, -1)
        cv2.putText(frame, txt, (x1+3, ly-1),
                    cv2.FONT_HERSHEY_DUPLEX, font_scale, (10, 10, 10), 1, cv2.LINE_AA)
    return frame
