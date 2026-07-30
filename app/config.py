import os

# Project Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_DIR = os.path.join(BASE_DIR, 'database')
os.makedirs(DATABASE_DIR, exist_ok=True)

# Application Configurations
MODEL_PATH = os.path.join(BASE_DIR, 'yolov8n.pt')       # General object detection
FACE_MODEL_PATH = os.path.join(BASE_DIR, 'yolov8n-face.pt')  # Face detection model
DB_PATH = os.path.join(DATABASE_DIR, 'detections.db')

# Detection settings
CONF_THRESHOLD = 0.30
IOU_THRESHOLD = 0.45
FACE_CONF_THRESHOLD = 0.50

# Alert and Risk settings
DISTANCE_ALERT_THRESHOLD = 15.0  # in meters
COLLISION_RISK_HIGH = 8.0
COLLISION_RISK_MED = 15.0

# Audio Alerts
AUDIO_ENABLED = True
SPEECH_RATE = 150

# Image Enhancement defaults
DEFAULT_ENHANCE_METHOD = "Hybrid"
DEFAULT_GAMMA_VALUE = 1.5

# Camera resolution settings
CAMERA_WIDTH = 1280   # Capture at 1280x720 (HD) for performance; display upscaled
CAMERA_HEIGHT = 720
INFERENCE_WIDTH = 640  # Run YOLO inference at 640 for speed
INFERENCE_HEIGHT = 360

# Performance
DEFAULT_FRAME_SKIP = 2
DEFAULT_INFERENCE_DOWNSCALE = True

# Navigation Alert Cooldowns (seconds)
ALERT_COOLDOWN_HIGH = 3
ALERT_COOLDOWN_MED = 6
