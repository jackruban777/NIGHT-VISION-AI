from ultralytics import YOLO
import numpy as np
import cv2
import os

# ── OpenCV 5 compatible face cascade loader ───────────────────────────────────
def _load_face_cascade():
    try:
        data_path = getattr(cv2, 'data', None)
        if data_path is None:
            return None
        xml_path = data_path.haarcascades + 'haarcascade_frontalface_default.xml'
        # Try objdetect submodule first (OpenCV 5)
        if hasattr(cv2, 'objdetect') and hasattr(cv2.objdetect, 'CascadeClassifier'):
            cc = cv2.objdetect.CascadeClassifier(xml_path)
            return cc if not cc.empty() else None
        # Fallback: direct attribute (OpenCV 4)
        if hasattr(cv2, 'CascadeClassifier'):
            cc = cv2.CascadeClassifier(xml_path)
            return cc if not cc.empty() else None
        return None
    except Exception as e:
        print(f"[detect] Face cascade load error: {e}")
        return None

_HAAR = _load_face_cascade()

# ── COCO → readable road hazard labels ───────────────────────────────────────
COCO_CLASS_MAP = {
    'person': 'Pedestrian', 'bicycle': 'Bike', 'car': 'Vehicle', 'motorcycle': 'Bike', 
    'airplane': 'Aircraft', 'bus': 'Vehicle', 'train': 'Train', 'truck': 'Unlit Truck', 
    'boat': 'Boat', 'traffic light': 'Traffic Signal', 'fire hydrant': 'Fire Hydrant', 
    'stop sign': 'Stop Sign', 'parking meter': 'Parking Meter', 'bench': 'Bench', 
    'bird': 'Stray Animal', 'cat': 'Stray Animal', 'dog': 'Stray Animal', 'horse': 'Stray Animal', 
    'sheep': 'Stray Animal', 'cow': 'Stray Cow', 'elephant': 'Wild Animal', 'bear': 'Wild Animal', 
    'zebra': 'Wild Animal', 'giraffe': 'Wild Animal', 'backpack': 'Bag', 'umbrella': 'Umbrella', 
    'handbag': 'Bag', 'tie': 'Tie', 'suitcase': 'Luggage', 'frisbee': 'Frisbee', 'skis': 'Skis', 
    'snowboard': 'Snowboard', 'sports ball': 'Ball', 'kite': 'Kite', 'baseball bat': 'Bat', 
    'baseball glove': 'Glove', 'skateboard': 'Skateboard', 'surfboard': 'Surfboard', 
    'tennis racket': 'Racket', 'bottle': 'Bottle', 'wine glass': 'Glass', 'cup': 'Cup', 
    'fork': 'Fork', 'knife': 'Knife', 'spoon': 'Spoon', 'bowl': 'Bowl', 'banana': 'Food', 
    'apple': 'Food', 'sandwich': 'Food', 'orange': 'Food', 'broccoli': 'Food', 'carrot': 'Food', 
    'hot dog': 'Food', 'pizza': 'Food', 'donut': 'Food', 'cake': 'Food', 'chair': 'Chair', 
    'couch': 'Couch', 'potted plant': 'Plant', 'bed': 'Bed', 'dining table': 'Table', 
    'toilet': 'Toilet', 'tv': 'TV', 'laptop': 'Laptop', 'mouse': 'Mouse', 'remote': 'Remote', 
    'keyboard': 'Keyboard', 'cell phone': 'Mobile', 'microwave': 'Microwave', 'oven': 'Oven', 
    'toaster': 'Toaster', 'sink': 'Sink', 'refrigerator': 'Fridge', 'book': 'Book', 'clock': 'Clock', 
    'vase': 'Vase', 'scissors': 'Scissors', 'teddy bear': 'Toy', 'hair drier': 'Dryer', 
    'toothbrush': 'Toothbrush'
}


class HazardDetector:
    def __init__(self, model_path='yolov8n.pt', conf_threshold=0.30):
        self.model_path    = model_path
        self.conf_threshold = conf_threshold
        self.model         = None
        self._load_model()

    def _load_model(self):
        try:
            self.model = YOLO(self.model_path)
            print(f"[detect] YOLO model loaded: {self.model_path}")
        except Exception as e:
            print(f"[detect] YOLO load error: {e}")

    def _detect_seatbelt(self, frame, x, y, w, h):
        """Heuristic Seatbelt detection using Edge & HoughLines on torso region."""
        img_h, img_w = frame.shape[:2]
        
        # Torso area roughly below the face
        tx1 = max(0, x - int(w * 0.5))
        ty1 = min(img_h, y + h)
        tx2 = min(img_w, x + int(w * 1.5))
        ty2 = min(img_h, y + h + int(h * 2.5))
        
        if ty2 <= ty1 or tx2 <= tx1:
            return "Seat Belt: NO"
            
        torso = frame[ty1:ty2, tx1:tx2]
        if torso.size == 0:
            return "Seat Belt: NO"
            
        gray = cv2.cvtColor(torso, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 20, minLineLength=20, maxLineGap=10)
        
        if lines is not None:
            for line in lines:
                lx1, ly1, lx2, ly2 = line[0]
                if lx2 - lx1 == 0:
                    continue
                angle = np.abs(np.degrees(np.arctan((ly2 - ly1) / (lx2 - lx1))))
                # Seatbelt diagonal angle usually between 30 and 70 degrees
                if 25 < angle < 75:
                    return "Seat Belt: WORN"
                    
        return "Seat Belt: NO"

    # ── face detection via Haar cascade ──────────────────────────────────────
    def _detect_faces(self, frame):
        if _HAAR is None:
            return []
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)
            faces = _HAAR.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
            )
            result = []
            for (x, y, w, h) in faces:
                sb_status = self._detect_seatbelt(frame, x, y, w, h)
                result.append({
                    'box':   [int(x), int(y), int(x + w), int(y + h)],
                    'label': f'Driver Face ({sb_status})',
                    'conf':  0.92,
                })
            return result
        except Exception as e:
            print(f"[detect] Face detect error: {e}")
            return []

    # ── main detect method ────────────────────────────────────────────────────
    def detect(self, frame, simulate_potholes=False, detect_faces=True):
        detections = []

        if self.model is not None:
            try:
                results = self.model.predict(
                    source=frame,
                    conf=self.conf_threshold,
                    verbose=False,
                    imgsz=640,
                )
                for result in results:
                    for box in result.boxes:
                        cls_id   = int(box.cls[0])
                        cls_name = self.model.names[cls_id]
                        conf     = float(box.conf[0])
                        xyxy     = box.xyxy[0].tolist()
                        label    = COCO_CLASS_MAP.get(cls_name, cls_name.capitalize())
                        detections.append({
                            'box':   [int(c) for c in xyxy],
                            'label': label,
                            'conf':  round(conf, 2),
                        })
            except Exception as e:
                print(f"[detect] YOLO predict error: {e}")

        # Face detection
        if detect_faces:
            detections.extend(self._detect_faces(frame))

        # Simulated pothole
        if simulate_potholes:
            h, w = frame.shape[:2]
            detections.append({
                'box':   [int(w * 0.42), int(h * 0.72), int(w * 0.58), int(h * 0.86)],
                'label': 'Pothole',
                'conf':  0.91,
            })

        return detections
