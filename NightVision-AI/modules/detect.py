from ultralytics import YOLO
import numpy as np

class HazardDetector:
    def __init__(self, model_path='yolov8n.pt', conf_threshold=0.25):
        """
        model_path: Path to the YOLO weight file.
        conf_threshold: Confidence threshold for predictions.
        """
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.model = None
        self.load_model()

    def load_model(self):
        try:
            # Ultralytics will auto-download 'yolov8n.pt' if it's not present locally
            self.model = YOLO(self.model_path)
            print(f"YOLO Model successfully loaded from {self.model_path}")
        except Exception as e:
            print(f"Error loading YOLO model: {e}")

    def detect(self, frame, simulate_potholes=False):
        """
        Runs object detection on the input frame.
        Returns a list of dicts: [ { 'box': [x1, y1, x2, y2], 'label': str, 'conf': float } ]
        """
        if self.model is None:
            return []

        results = self.model.predict(
            source=frame,
            conf=self.conf_threshold,
            verbose=False
        )

        detections = []
        
        # Standard COCO class names index mappings to our custom dashboard names
        # e.g., 'person' -> 'Pedestrian', 'cow' -> 'Stray Cow', etc.
        class_mapping = {
            'person': 'Pedestrian',
            'car': 'Vehicle',
            'truck': 'Vehicle',
            'bus': 'Vehicle',
            'motorcycle': 'Bike',
            'bicycle': 'Bike',
            'cow': 'Stray Cow',
            'dog': 'Stray Animal'
        }

        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Get class index, confidence, and coords
                cls_id = int(box.cls[0])
                cls_name = self.model.names[cls_id]
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].tolist() # [x1, y1, x2, y2]

                # Map class name if it is in our mapping
                label = class_mapping.get(cls_name, cls_name.capitalize())
                
                detections.append({
                    'box': [int(c) for c in xyxy],
                    'label': label,
                    'conf': round(conf, 2)
                })

        # Simulation for Potholes if enabled (for demonstration purposes since COCO doesn't have potholes)
        if simulate_potholes:
            h, w, _ = frame.shape
            # Mock a pothole in the lower-middle part of the road if we see low-contrast blobs,
            # or simply place one static demonstration pothole in the bottom-center region.
            detections.append({
                'box': [int(w * 0.45), int(h * 0.75), int(w * 0.55), int(h * 0.85)],
                'label': 'Pothole',
                'conf': 0.88
            })

        return detections
