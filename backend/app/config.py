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
    
    # AI Engine Defaults
    DEFAULT_CONFIDENCE_THRESHOLD: float = 0.50
    CAMERA_FOCAL_LENGTH_PX: float = 800.0  # Simulated camera focal length in pixels
    AVERAGE_PEDESTRIAN_HEIGHT_M: float = 1.70  # Meters
    AVERAGE_CAR_HEIGHT_M: float = 1.50  # Meters

settings = Settings()
