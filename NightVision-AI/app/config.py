import os

# Project Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_DIR = os.path.join(BASE_DIR, 'database')
os.makedirs(DATABASE_DIR, exist_ok=True)

# Application Configurations
MODEL_PATH = os.path.join(BASE_DIR, 'yolov8n.pt') # Downloaded automatically by Ultralytics
DB_PATH = os.path.join(DATABASE_DIR, 'detections.db')

# Detection settings
CONF_THRESHOLD = 0.25
IOU_THRESHOLD = 0.45

# Alert and Risk settings
DISTANCE_ALERT_THRESHOLD = 15.0 # in meters (estimated)
COLLISION_RISK_HIGH = 8.0      # in meters
COLLISION_RISK_MED = 15.0      # in meters

# Audio Alerts
AUDIO_ENABLED = True
SPEECH_RATE = 150 # Words per minute

# Image Enhancement defaults
DEFAULT_ENHANCE_METHOD = "CLAHE" # Options: None, CLAHE, Gamma, Hybrid
DEFAULT_GAMMA_VALUE = 1.5
