import os
import sys
import time
import cv2
import pandas as pd
import numpy as np
import streamlit as st
from PIL import Image

# Add root directory to python path for module imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import config
from modules.capture import VideoCaptureSource
from modules.enhance import enhance_frame
from modules.detect import HazardDetector
from modules.analyze import analyze_hazards, evaluate_risk
from modules.alert import AlertSystem
from modules.logger import DatabaseLogger

# --- Streamlit Page Configuration ---
st.set_page_config(
    page_title="NightVision-AI | Edge Hazard Detection",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize detector, alert system, and database logger (Cached or session-state based)
if 'detector' not in st.session_state:
    st.session_state.detector = HazardDetector(
        model_path=config.MODEL_PATH,
        conf_threshold=config.CONF_THRESHOLD
    )

if 'logger' not in st.session_state:
    st.session_state.logger = DatabaseLogger(db_path=config.DB_PATH)

# --- Custom Premium CSS Styling (Glassmorphism & Neon Accents) ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Outfit:wght@400;600;800&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }
    
    .main-title {
        font-family: 'Outfit', sans-serif;
        font-size: 3rem !important;
        font-weight: 800;
        background: linear-gradient(135deg, #00FFCC 0%, #0099FF 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
        text-shadow: 0px 4px 20px rgba(0, 255, 204, 0.15);
    }
    
    .subtitle-badge {
        background: rgba(0, 153, 255, 0.1);
        border: 1px solid rgba(0, 153, 255, 0.3);
        color: #00CCFF;
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        display: inline-block;
        margin-bottom: 25px;
    }
    
    /* Custom Card Style (Glassmorphism) */
    .glass-card {
        background: rgba(17, 24, 39, 0.6);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 20px;
    }
    
    /* Custom Metric Cards */
    .metric-container {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        margin-bottom: 20px;
    }
    
    .metric-card {
        flex: 1;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 15px 20px;
        text-align: center;
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
    }
    
    .metric-label {
        font-size: 0.8rem;
        color: #9CA3AF;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 5px;
    }
    
    .metric-value {
        font-size: 1.8rem;
        font-weight: 800;
        font-family: 'Outfit', sans-serif;
        color: #FFFFFF;
    }
    
    /* Neon Accent Colors */
    .color-neon-blue { color: #3b82f6; }
    .color-neon-green { color: #10b981; }
    .color-neon-yellow { color: #f59e0b; }
    .color-neon-red { color: #ef4444; }
    
    /* Dynamic Warning Alerts */
    .danger-alert {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.5);
        color: #FF5555;
        padding: 15px;
        border-radius: 10px;
        font-weight: bold;
        text-align: center;
        font-size: 1.1rem;
        animation: pulse 2s infinite;
        margin-bottom: 20px;
    }
    
    @keyframes pulse {
        0% { opacity: 0.85; }
        50% { opacity: 1; border-color: rgba(239, 68, 68, 0.9); box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); }
        100% { opacity: 0.85; }
    }
</style>
""", unsafe_allow_html=True)

# --- Header Section ---
st.markdown("<h1 class='main-title'>NIGHTVISION-AI</h1>", unsafe_allow_html=True)
st.markdown("<div class='subtitle-badge'>EDGE-BASED LOW-LIGHT & FOGGY-CONDITION HAZARD DETECTION</div>", unsafe_allow_html=True)

# --- Sidebar Inputs & Settings ---
st.sidebar.markdown("### ⚙️ SYSTEM SETTINGS")

# Source selector
input_source_type = st.sidebar.selectbox(
    "INPUT MEDIA SOURCE",
    ["Camera / Webcam", "Demo Video File", "Static Night Frame"]
)

# Demo video upload fallback
demo_video_path = os.path.join(config.BASE_DIR, 'data', 'sample_videos', 'demo.mp4')
static_image_path = os.path.join(config.BASE_DIR, 'data', 'images', 'night_road.jpg')

# Ensure demo folders exist
os.makedirs(os.path.join(config.BASE_DIR, 'data', 'sample_videos'), exist_ok=True)
os.makedirs(os.path.join(config.BASE_DIR, 'data', 'images'), exist_ok=True)

source_path = 0
if input_source_type == "Demo Video File":
    # Let user upload a video or default to the demo path
    uploaded_file = st.sidebar.file_uploader("Upload Video File", type=["mp4", "avi", "mov"])
    if uploaded_file is not None:
        # Save temp video file
        temp_path = os.path.join(config.BASE_DIR, 'data', 'sample_videos', 'temp_upload.mp4')
        with open(temp_path, "wb") as f:
            f.write(uploaded_file.read())
        source_path = temp_path
    else:
        # Default fallback
        source_path = demo_video_path
elif input_source_type == "Static Night Frame":
    uploaded_img = st.sidebar.file_uploader("Upload Image File", type=["jpg", "png", "jpeg"])
    if uploaded_img is not None:
        temp_path = os.path.join(config.BASE_DIR, 'data', 'images', 'temp_upload.jpg')
        with open(temp_path, "wb") as f:
            f.write(uploaded_img.read())
        source_path = temp_path
    else:
        source_path = static_image_path

# Enhancement Method
enhance_method = st.sidebar.selectbox(
    "LOW-LIGHT ENHANCEMENT ENGINE",
    ["CLAHE", "Gamma", "Dehaze", "Hybrid", "None"],
    index=0
)

# Adjust Gamma slider if Gamma/Hybrid selected
gamma_val = config.DEFAULT_GAMMA_VALUE
if enhance_method in ["Gamma", "Hybrid"]:
    gamma_val = st.sidebar.slider("Gamma Value", 1.0, 3.0, config.DEFAULT_GAMMA_VALUE, 0.1)

# Detection Thresholds
conf_threshold = st.sidebar.slider("Confidence Threshold", 0.1, 1.0, config.CONF_THRESHOLD, 0.05)
st.session_state.detector.conf_threshold = conf_threshold

# Simulation Controls
st.sidebar.markdown("### 🛠️ SIMULATION INJECTOR")
sim_pothole = st.sidebar.checkbox("Simulate Pothole Detected", value=False)
sim_stray_cow = st.sidebar.checkbox("Simulate Stray Cow Nearby", value=False)

# Audio configuration
st.sidebar.markdown("### 🔊 ALERT CONTROL")
audio_enabled = st.sidebar.toggle("Enable Sound & Voice Alerts", value=config.AUDIO_ENABLED)

# Initialize alerts in session state
if 'alert_system' not in st.session_state or st.session_state.alert_system.audio_enabled != audio_enabled:
    if 'alert_system' in st.session_state:
        st.session_state.alert_system.shutdown()
    st.session_state.alert_system = AlertSystem(rate=config.SPEECH_RATE, audio_enabled=audio_enabled)

# Clear logs button
if st.sidebar.button("🧹 Clear Logs Database"):
    st.session_state.logger.clear_logs()
    st.toast("SQLite logs database cleared!")

# --- Main Layout ---
col_feed, col_logs = st.columns([5, 3])

with col_feed:
    st.markdown("<div class='glass-card'>", unsafe_allow_html=True)
    st.subheader("🎥 Real-Time Operations Feed")
    
    # Grid of live metrics
    metric_cols = st.columns(4)
    fps_metric = metric_cols[0].empty()
    latency_metric = metric_cols[1].empty()
    detection_metric = metric_cols[2].empty()
    risk_metric = metric_cols[3].empty()
    
    # Side-by-side feed layout placeholders
    feed_cols = st.columns(2)
    with feed_cols[0]:
        st.markdown("<div style='text-align: center; color: #9CA3AF;'>Raw Low-Light Frame</div>", unsafe_allow_html=True)
        raw_video_placeholder = st.empty()
    with feed_cols[1]:
        st.markdown("<div style='text-align: center; color: #00FFCC;'>Enhanced AI Detection Feed</div>", unsafe_allow_html=True)
        enhanced_video_placeholder = st.empty()
        
    # Floating notification banner
    warning_banner = st.empty()
    st.markdown("</div>", unsafe_allow_html=True)

with col_logs:
    st.markdown("<div class='glass-card'>", unsafe_allow_html=True)
    st.subheader("📊 Dynamic Safety Analytics")
    
    # Chart visualizer placeholder
    chart_placeholder = st.empty()
    
    # Table visualizer placeholder
    st.markdown("#### recent logs table")
    table_placeholder = st.empty()
    st.markdown("</div>", unsafe_allow_html=True)

# Run logic
run_system = st.checkbox("🟢 ACTIVATE AI EDGE PIPELINE", value=True)

# Create a mock video file or static frame if they do not exist
if not os.path.exists(static_image_path):
    # Create black mock image
    dummy_img = np.zeros((480, 640, 3), dtype=np.uint8)
    # Draw some mock roadway lines
    cv2.line(dummy_img, (100, 480), (300, 240), (100, 100, 100), 2)
    cv2.line(dummy_img, (540, 480), (340, 240), (100, 100, 100), 2)
    cv2.putText(dummy_img, "MOCK NIGHT ROADWAY", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    # Save it
    cv2.imwrite(static_image_path, dummy_img)

# Setup capture source
src_type = 'webcam'
if input_source_type == "Demo Video File":
    src_type = 'video'
elif input_source_type == "Static Night Frame":
    src_type = 'image'

cap_source = VideoCaptureSource(source_type=src_type, source_path=source_path)

if run_system and cap_source.is_opened:
    while run_system:
        start_time = time.time()
        ret, frame = cap_source.read_frame()
        if not ret:
            st.error("End of video file or camera disconnected.")
            break
            
        # Draw mock stray cow if simulation is enabled
        if sim_stray_cow:
            h_f, w_f, _ = frame.shape
            # Let's draw a mock dark contour representing a cow on the dark road
            cv2.rectangle(frame, (int(w_f*0.65), int(h_f*0.6)), (int(w_f*0.8), int(h_f*0.8)), (20, 20, 20), -1) # Dark silhouette
            cv2.putText(frame, "SIMULATED COW", (int(w_f*0.65), int(h_f*0.58)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

        # 1. Capture Raw frame copy
        raw_frame = frame.copy()
        
        # 2. Image Enhancement Engine
        enh_start = time.time()
        enhanced_frame = enhance_frame(frame, method=enhance_method, gamma_value=gamma_val)
        enh_latency = (time.time() - enh_start) * 1000 # ms
        
        # 3. Object Detection Engine
        det_start = time.time()
        detections = st.session_state.detector.detect(enhanced_frame, simulate_potholes=sim_pothole)
        
        # Force add stray cow if simulated
        if sim_stray_cow:
            h_f, w_f, _ = frame.shape
            detections.append({
                'box': [int(w_f*0.65), int(h_f*0.6), int(w_f*0.8), int(h_f*0.8)],
                'label': 'Stray Cow',
                'conf': 0.95
            })
            
        det_latency = (time.time() - det_start) * 1000 # ms
        
        # 4. Hazard Analysis & Distance Calculation
        detections = analyze_hazards(detections, enhanced_frame.shape, config.COLLISION_RISK_HIGH, config.COLLISION_RISK_MED)
        
        # Draw bounding boxes on enhanced frame
        risk_color_mapping = {
            'High': (0, 0, 255),    # Red
            'Medium': (0, 165, 255), # Orange
            'Low': (0, 255, 0)      # Green
        }
        
        highest_risk = "Low"
        active_alert_message = ""
        
        for det in detections:
            box = det['box']
            label = det['label']
            dist = det['distance']
            risk = det['risk']
            conf = det['conf']
            
            # Determine color based on risk level
            color = risk_color_mapping.get(risk, (0, 255, 0))
            
            # Draw bbox rectangle
            cv2.rectangle(enhanced_frame, (box[0], box[1]), (box[2], box[3]), color, 2)
            
            # Draw label banner
            lbl_txt = f"{label} | {dist}m ({risk})"
            cv2.putText(enhanced_frame, lbl_txt, (box[0], box[1] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            # Database logging for Medium or High risk threats
            if risk in ['Medium', 'High']:
                st.session_state.logger.log_detection(label, conf, dist, risk)
                
            # Track highest risk object
            if risk == "High":
                highest_risk = "High"
                active_alert_message = f"🚨 DANGER: {label} very close ({dist}m)!"
                # Trigger sound warnings
                st.session_state.alert_system.trigger_beep(frequency=1500, duration=300)
                st.session_state.alert_system.trigger_voice(label, dist)
            elif risk == "Medium" and highest_risk != "High":
                highest_risk = "Medium"
                active_alert_message = f"⚠️ WARNING: {label} detected ({dist}m) ahead."
                st.session_state.alert_system.trigger_beep(frequency=1000, duration=150)
                st.session_state.alert_system.trigger_voice(label, dist)

        # 5. UI Panel Updates
        # Convert BGR to RGB for Streamlit rendering
        raw_rgb = cv2.cvtColor(raw_frame, cv2.COLOR_BGR2RGB)
        enhanced_rgb = cv2.cvtColor(enhanced_frame, cv2.COLOR_BGR2RGB)
        
        raw_video_placeholder.image(raw_rgb, use_container_width=True)
        enhanced_video_placeholder.image(enhanced_rgb, use_container_width=True)
        
        # Display warning alert if any
        if active_alert_message:
            warning_class = "danger-alert" if highest_risk == "High" else "glass-card color-neon-yellow"
            warning_banner.markdown(f"<div class='{warning_class}'>{active_alert_message}</div>", unsafe_allow_html=True)
        else:
            warning_banner.empty()

        # Update dynamic metrics
        end_time = time.time()
        loop_time = end_time - start_time
        fps = 1.0 / max(0.001, loop_time)
        total_latency = loop_time * 1000 # ms
        
        fps_metric.markdown(f"<div class='metric-card'><div class='metric-label'>Frames Per Second</div><div class='metric-value color-neon-green'>{fps:.1f}</div></div>", unsafe_allow_html=True)
        latency_metric.markdown(f"<div class='metric-card'><div class='metric-label'>Avg Latency</div><div class='metric-value color-neon-blue'>{total_latency:.1f} ms</div></div>", unsafe_allow_html=True)
        detection_metric.markdown(f"<div class='metric-card'><div class='metric-label'>Active Threats</div><div class='metric-value color-neon-yellow'>{len(detections)}</div></div>", unsafe_allow_html=True)
        
        risk_color_class = "color-neon-red" if highest_risk == "High" else ("color-neon-yellow" if highest_risk == "Medium" else "color-neon-green")
        risk_metric.markdown(f"<div class='metric-card'><div class='metric-label'>Threat Level</div><div class='metric-value {risk_color_class}'>{highest_risk}</div></div>", unsafe_allow_html=True)
        
        # Load and update SQLite logs
        log_rows = st.session_state.logger.fetch_recent_logs(limit=10)
        if log_rows:
            df = pd.DataFrame(log_rows, columns=['Timestamp', 'Hazard Type', 'Confidence', 'Distance (m)', 'Risk Level'])
            table_placeholder.dataframe(df, use_container_width=True, hide_index=True)
            
            # Simple bar chart of hazard types
            chart_df = df['Hazard Type'].value_counts().reset_index()
            chart_df.columns = ['Hazard', 'Occurrence Count']
            chart_placeholder.bar_chart(data=chart_df, x='Hazard', y='Occurrence Count', color='#00FFCC')
        else:
            table_placeholder.info("No threats logged in SQLite yet.")
            chart_placeholder.empty()

        # Prevent interface freezing (yield execution context)
        time.sleep(0.03)
        
        # Handle manual break via checkbox toggle
        if not run_system:
            break
            
    cap_source.release()
else:
    st.info("AI Edge Pipeline is currently inactive. Toggle the check box below the operations feed to start the real-time processor.")
