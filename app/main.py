import os
import sys
import subprocess
import time
import cv2

# Add root directory to python path for module imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import config
from modules.capture import VideoCaptureSource
from modules.enhance import enhance_frame
from modules.detect import HazardDetector
from modules.analyze import analyze_hazards
from modules.alert import AlertSystem
from modules.logger import DatabaseLogger

def check_dependencies():
    print("Checking system dependencies...")
    try:
        import ultralytics
        import streamlit
        import cv2
        import pyttsx3
        print("All dependencies are correctly installed!")
        return True
    except ImportError as e:
        print(f"Error: Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def run_headless():
    """
    Runs the NightVision-AI system headlessly in CLI mode.
    Outputs detections and estimated distances to console.
    """
    print("\nStarting NightVision-AI in Headless CLI Mode...")
    
    # Initialize components
    detector = HazardDetector(model_path=config.MODEL_PATH, conf_threshold=config.CONF_THRESHOLD)
    alert_system = AlertSystem(rate=config.SPEECH_RATE, audio_enabled=True)
    db_logger = DatabaseLogger(db_path=config.DB_PATH)
    
    # Use default camera / webcam (index 0)
    cap = VideoCaptureSource(source_type='webcam', source_path=0)
    if not cap.is_opened:
        # Fallback to demo static image if camera is not available
        static_img_path = os.path.join(config.BASE_DIR, 'data', 'images', 'night_road.jpg')
        if os.path.exists(static_img_path):
            print("Webcam not detected. Falling back to static demonstration frame...")
            cap = VideoCaptureSource(source_type='image', source_path=static_img_path)
        else:
            print("No video source or static frame found. Exiting CLI mode.")
            alert_system.shutdown()
            return
            
    print("Press Ctrl+C to terminate execution.\n")
    try:
        frame_count = 0
        start_time = time.time()
        
        while True:
            ret, frame = cap.read_frame()
            if not ret:
                break
                
            # 1. Image Enhancement
            enhanced = enhance_frame(frame, method=config.DEFAULT_ENHANCE_METHOD)
            
            # 2. Object Detection
            detections = detector.detect(enhanced)
            
            # 3. Hazard & Distance Analysis
            detections = analyze_hazards(detections, enhanced.shape, config.COLLISION_RISK_HIGH, config.COLLISION_RISK_MED)
            
            # 4. Trigger Alerts & Logs
            active_threats = []
            for det in detections:
                label = det['label']
                dist = det['distance']
                risk = det['risk']
                conf = det['conf']
                
                active_threats.append(f"{label} ({dist}m, Risk: {risk})")
                
                # SQLite logging
                if risk in ['Medium', 'High']:
                    db_logger.log_detection(label, conf, dist, risk)
                    
                # Voice Alerts
                if risk in ['Medium', 'High']:
                    alert_system.trigger_beep(frequency=1200, duration=150)
                    alert_system.trigger_voice(label, dist)

            # Output logs to console
            frame_count += 1
            elapsed = time.time() - start_time
            fps = frame_count / elapsed
            
            threats_str = ", ".join(active_threats) if active_threats else "None"
            print(f"[FPS: {fps:.1f}] Detections: {threats_str}", end="\r")
            
            # Give short yield
            time.sleep(0.03)
            
    except KeyboardInterrupt:
        print("\nHalting CLI operations...")
    finally:
        cap.release()
        alert_system.shutdown()
        print("System shutdown complete.")

if __name__ == "__main__":
    if check_dependencies():
        # Ask user if they want to launch Streamlit or run in terminal
        if len(sys.argv) > 1 and sys.argv[1] == '--cli':
            run_headless()
        else:
            print("\nTo launch the visual Streamlit dashboard, run:")
            print("streamlit run dashboard/dashboard.py\n")
            print("To run in headless console mode instead, run:")
            print("python app/main.py --cli")
