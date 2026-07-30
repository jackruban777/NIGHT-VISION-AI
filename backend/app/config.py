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
    
    # High-Speed Real-Time AI Engine Defaults (YOLO12 Nano)
    MODEL_NAME: str = "yolo12n.pt"
    MODEL_PATH: str = os.getenv("YOLO12_MODEL_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "yolo12n.pt"))
    PRIMARY_MODEL_NAME: str = "yolo12n.pt"
    DEFAULT_TRACKER: str = "bytetrack.yaml"
    DEFAULT_CONFIDENCE_THRESHOLD: float = float(os.getenv("DEFAULT_CONFIDENCE_THRESHOLD", "0.25"))
    DEFAULT_IOU_THRESHOLD: float = float(os.getenv("DEFAULT_IOU_THRESHOLD", "0.45"))
    IMAGE_SIZE: int = int(os.getenv("IMAGE_SIZE", "640"))
    MAX_DETECTIONS: int = int(os.getenv("MAX_DETECTIONS", "100"))
    FRAME_SKIP_INTERVAL: int = 5
    BRIGHTNESS_THRESHOLD: float = 80.0
    
    # Low-Memory Resolution Matrix for Render 512MB RAM compatibility
    GPU_RESOLUTION: int = 640
    LOW_GPU_RESOLUTION: int = 512
    CPU_RESOLUTION: int = 320
    LOW_CPU_RESOLUTION: int = 256
    
    # Camera Monocular Calibration
    CAMERA_FOCAL_LENGTH_PX: float = 800.0
    AVERAGE_PEDESTRIAN_HEIGHT_M: float = 1.70
    AVERAGE_CAR_HEIGHT_M: float = 1.50

settings = Settings()
