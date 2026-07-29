import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class Settings:
    PROJECT_NAME: str = "NightVision AI Server"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "nv_ai_secret_key_8849201938210")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./nightvision.db")
    
    # High-Speed Real-Time AI Engine Defaults
    PRIMARY_MODEL_NAME: str = "yolo11n.pt"  # YOLO11 Nano (Default)
    FALLBACK_MODEL_NAME: str = "yolov8n.pt" # YOLOv8 Nano (Fallback)
    DEFAULT_TRACKER: str = "bytetrack.yaml"  # ByteTrack persistent tracker
    DEFAULT_CONFIDENCE_THRESHOLD: float = 0.20
    DEFAULT_IOU_THRESHOLD: float = 0.45
    FRAME_SKIP_INTERVAL: int = 5  # Run AI detection every 5th frame
    BRIGHTNESS_THRESHOLD: float = 80.0  # Skip CLAHE if ambient brightness >= 80
    
    # Resolution Matrix based on Hardware
    GPU_RESOLUTION: int = 640
    LOW_GPU_RESOLUTION: int = 512
    CPU_RESOLUTION: int = 416
    LOW_CPU_RESOLUTION: int = 320
    
    # Camera Monocular Calibration
    CAMERA_FOCAL_LENGTH_PX: float = 800.0  # Simulated camera focal length in pixels
    AVERAGE_PEDESTRIAN_HEIGHT_M: float = 1.70  # Meters
    AVERAGE_CAR_HEIGHT_M: float = 1.50  # Meters

settings = Settings()
