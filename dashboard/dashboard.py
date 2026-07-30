"""
NightVision-AI · GUARDIAN v3.1
Fast, reliable laptop camera dashboard.
Uses MSMF backend (confirmed working on this machine).
"""
import os, sys
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import streamlit as st
import cv2, numpy as np, time, base64, io, pandas as pd
import folium
from streamlit_folium import st_folium
import app.config as config
from modules.enhance    import enhance_frame, draw_detection_overlay
from modules.detect     import HazardDetector
from modules.analyze    import analyze_hazards
from modules.alert      import AlertSystem
from modules.logger     import DetectionLogger
from modules.drowsiness import DrowsinessDetector

# ── Page ──────────────────────────────────────────────────────────────────────
st.set_page_config(page_title="NightVision-AI · Guardian", page_icon="🔮",
                   layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Fira+Code:wght@400;600;700&display=swap');
:root{
  --bg0:#000000; --bg1:#050a05; --bg2:#0a120a;
  --bdr:#004400; --bdr-glow:#00ff4133;
  --pk:#00FF41;  --tl:#00ff00;  --vi:#008f11;
  --gr:#00FF41;  --rd:#ff003c;  --yw:#ffe600;
  --tx:#00FF41;  --dm:#006611;
  --r:4px;
}
html,body{background:var(--bg0)!important;}
*,[class*="css"]{font-family:'Fira Code',monospace!important;color:var(--tx)!important;}
#MainMenu,footer,header{visibility:hidden;}
.block-container{padding:.7rem 1rem!important;max-width:100%!important;}
section[data-testid="stSidebar"]>div{background:var(--bg1)!important;border-right:1px solid var(--bdr)!important;}
.stApp{background:var(--bg0)!important;}

/* Hero */
.hero{background:var(--bg1);border:1px solid var(--bdr);border-bottom:3px solid var(--pk);
  border-radius:var(--r);padding:12px 20px;margin-bottom:10px;
  display:flex;align-items:center;justify-content:space-between;
  box-shadow:0 0 15px var(--bdr-glow);}
.htitle{font-family:'Share Tech Mono',monospace;font-size:26px;font-weight:700;letter-spacing:4px;
  color:var(--pk);text-shadow:0 0 10px rgba(0,255,65,0.4);}
.hsub{font-size:10px;color:var(--vi);letter-spacing:3px;margin-top:3px;}
.hbadge{background:#001100;border:1px solid var(--vi);
  border-radius:2px;padding:4px 12px;font-size:11px;font-weight:700;color:var(--pk);
  box-shadow:inset 0 0 8px rgba(0,255,65,0.2);}
.dot{display:inline-block;width:8px;height:8px;background:var(--pk);
  box-shadow:0 0 8px var(--pk);animation:pd 1s infinite;margin-right:6px;}
@keyframes pd{0%,100%{opacity:1}50%{opacity:.1}}

/* Metrics */
.mrow{display:flex;gap:8px;margin-bottom:8px;}
.mc{flex:1;background:var(--bg1);border:1px solid var(--bdr);border-radius:2px;
  padding:10px;text-align:center;box-shadow:inset 0 0 10px rgba(0,255,65,0.05);}
.ml{font-size:9px;letter-spacing:1px;color:var(--vi);text-transform:uppercase;margin-bottom:4px;}
.mv{font-size:18px;font-weight:700;}
.cpk{color:var(--pk);text-shadow:0 0 8px rgba(0,255,65,.6);}
.ctl{color:var(--tl);text-shadow:0 0 8px rgba(0,255,0,.6);}
.cgr{color:var(--gr);text-shadow:0 0 8px rgba(0,255,65,.6);}
.crd{color:var(--rd);text-shadow:0 0 12px rgba(255,0,60,.8);}
.cyw{color:var(--yw);text-shadow:0 0 8px rgba(255,230,0,.6);}
.cvi{color:var(--vi);text-shadow:0 0 8px rgba(0,143,17,.6);}
.cdm{color:var(--dm);}

/* Alerts */
.adanger{background:#1a0005;border:1px solid var(--rd);
  border-left:8px solid var(--rd);border-radius:2px;
  padding:12px 16px;margin:6px 0;font-weight:700;font-size:14px;color:var(--rd);
  text-align:center;animation:afl .3s infinite alternate;}
@keyframes afl{from{box-shadow:0 0 5px rgba(255,0,60,.3)}to{box-shadow:0 0 20px rgba(255,0,60,.8)}}
.awarn{background:#111100;border:1px solid var(--yw);
  border-left:6px solid var(--yw);border-radius:2px;
  padding:10px 14px;margin:5px 0;color:var(--yw);font-size:12px;font-weight:700;}
.aclear{background:#001100;border:1px solid var(--vi);
  border-radius:2px;padding:8px 14px;margin:5px 0;
  color:var(--pk);font-size:12px;text-align:center;letter-spacing:2px;}
.anav{background:#001100;border:1px solid var(--bdr);
  border-left:4px solid var(--pk);border-radius:2px;
  padding:6px 12px;margin:3px 0;font-size:10px;color:var(--pk);}

/* Panel */
.panel{background:var(--bg1);border:1px solid var(--bdr);border-radius:2px;padding:10px;}
.pt2{border-top:2px solid var(--tl);}
.ptpk{border-top:2px solid var(--pk);}
.ptvi{border-top:2px solid var(--vi);}
.ptitle{font-size:10px;letter-spacing:2px;text-transform:uppercase;
  padding-bottom:6px;border-bottom:1px dashed var(--bdr);margin-bottom:8px;}
.tl-t,.pk-t,.vi-t{color:var(--pk);text-shadow:0 0 5px rgba(0,255,65,0.4);}

/* Nav keys */
.nk{display:inline-flex;align-items:center;background:#000;
  border:1px solid var(--vi);border-bottom:3px solid var(--pk);border-radius:2px;
  padding:6px 10px;margin:2px;font-size:11px;font-weight:700;color:var(--pk);}

/* Sidebar */
.ss{font-size:10px;letter-spacing:2px;font-weight:700;color:var(--pk);
  text-transform:uppercase;padding:8px 0 4px;border-bottom:1px dashed var(--bdr);margin-bottom:8px;}
.stButton>button{background:#001100!important;border:1px solid var(--pk)!important;
  color:var(--pk)!important;border-radius:2px!important;font-weight:700!important;
  text-transform:uppercase;letter-spacing:1px;}
.stButton>button:hover{background:var(--pk)!important;color:#000!important;}
.stSlider>div>div>div>div{background:var(--pk)!important;}
.stSelectbox>div>div{background:#000!important;border:1px solid var(--vi)!important;color:var(--pk)!important;}
.stSelectbox>div>div:focus{border-color:var(--pk)!important;box-shadow:0 0 5px var(--pk)!important;}

/* Risk bar */
.rbar-bg{background:#001100;border:1px solid var(--bdr);border-radius:2px;height:8px;margin:4px 0;}
.rbar{height:100%;background:var(--pk);transition:width .4s;}
</style>
""", unsafe_allow_html=True)

# ── Session state ─────────────────────────────────────────────────────────────
def _init():
    if 'detector'  not in st.session_state:
        st.session_state.detector  = HazardDetector(model_path=config.MODEL_PATH, conf_threshold=0.30)
    if 'logger'    not in st.session_state:
        st.session_state.logger    = DetectionLogger(db_path=config.DB_PATH)
    if 'alerts'    not in st.session_state:
        st.session_state.alerts    = AlertSystem(rate=config.SPEECH_RATE, audio_enabled=True)
    if 'drowsy'    not in st.session_state:
        st.session_state.drowsy    = DrowsinessDetector()
    if 'cap'       not in st.session_state:
        st.session_state.cap       = None
    if 'cap_key'   not in st.session_state:
        st.session_state.cap_key   = None
    if 'fc'        not in st.session_state:
        st.session_state.fc        = 0
    if 'last_dets' not in st.session_state:
        st.session_state.last_dets = []
    if 'drow_alrt' not in st.session_state:
        st.session_state.drow_alrt = 0
_init()

# ── Hero ───────────────────────────────────────────────────────────────────────
st.markdown("""
<div class="hero">
  <div>
    <div class="htitle">🔮 NIGHTVISION — AI</div>
    <div class="hsub">GUARDIAN v3.1 · DRIVER SAFETY · DROWSINESS MONITOR · ZERO-LAG</div>
  </div>
  <div style="text-align:right">
    <div class="hbadge"><span class="dot"></span>LIVE</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#5A4E7A;margin-top:3px;">MSMF · THREADED · REAL-TIME</div>
  </div>
</div>
""", unsafe_allow_html=True)

# ── Sidebar ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown('<div class="ss">📡 CAMERA</div>', unsafe_allow_html=True)
    cam_idx  = st.selectbox('Camera Index', [0, 1, 2], index=0)
    cam_w    = st.select_slider('Width', [480, 640, 1280], value=1280)
    cam_h    = {480:360, 640:480, 1280:720}[cam_w]

    st.markdown('<div class="ss">🧠 DROWSINESS</div>', unsafe_allow_html=True)
    drow_on   = st.toggle('Enable', value=True)
    drow_thr  = st.slider('Alert after N frames', 10, 40, 20)

    st.markdown('<div class="ss">🔬 ENHANCEMENT</div>', unsafe_allow_html=True)
    enh_mode = st.selectbox('Mode', ['CLAHE','Sharp','Hybrid','Gamma','Dehaze','None'], index=0)
    gamma_v  = 1.5
    if enh_mode in ['Gamma','Hybrid']:
        gamma_v = st.slider('Gamma', 1.0, 3.0, 1.5, 0.1)

    st.markdown('<div class="ss">⚡ PERFORMANCE</div>', unsafe_allow_html=True)
    frame_skip = st.slider('YOLO Frame Skip', 1, 8, 4)
    infer_w    = st.select_slider('YOLO Size', [224, 320, 416], value=320)
    conf_thr   = st.slider('Confidence', 0.10, 0.90, 0.30, 0.05)
    st.session_state.detector.conf_threshold = conf_thr

    st.markdown('<div class="ss">🧪 SIMULATION</div>', unsafe_allow_html=True)
    sim_pot  = st.checkbox('Pothole')
    sim_cow  = st.checkbox('Stray Cow')
    sim_bsp  = st.checkbox('Blind Spot')
    det_face = st.checkbox('Face Detection', value=True)

    st.markdown('<div class="ss">🔊 ALERTS</div>', unsafe_allow_html=True)
    audio_on = st.toggle('Sound Alerts', value=True)
    if st.session_state.alerts.audio_enabled != audio_on:
        st.session_state.alerts.shutdown()
        st.session_state.alerts = AlertSystem(rate=config.SPEECH_RATE, audio_enabled=audio_on)

    if st.button('🧹 Clear Logs'):
        st.session_state.logger.clear_logs(); st.toast('Cleared!', icon='✅')

    run = st.toggle('🟢 ACTIVATE', value=True)

# ── Camera manager ─────────────────────────────────────────────────────────────
cap_key = f'{cam_idx}_{cam_w}x{cam_h}'
if st.session_state.cap_key != cap_key:
    if st.session_state.cap and st.session_state.cap.isOpened():
        st.session_state.cap.release()
    # Try MSMF → ANY → DSHOW
    cap = None
    for backend in [cv2.CAP_MSMF, cv2.CAP_ANY, cv2.CAP_DSHOW]:
        try:
            c = cv2.VideoCapture(cam_idx, backend)
            if c.isOpened():
                c.set(cv2.CAP_PROP_FRAME_WIDTH,  cam_w)
                c.set(cv2.CAP_PROP_FRAME_HEIGHT, cam_h)
                c.set(cv2.CAP_PROP_FPS, 30)
                c.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                # Warmup reads to clear MSMF first-frame error
                for _ in range(5):
                    c.read()
                ret, test = c.read()
                if ret and test is not None:
                    cap = c
                    break
            c.release()
        except Exception:
            continue
    st.session_state.cap     = cap
    st.session_state.cap_key = cap_key
    st.session_state.fc      = 0
    st.session_state.last_dets = []

cap = st.session_state.cap

# ── Layout placeholders ────────────────────────────────────────────────────────
met_ph  = st.empty()
drow_ph = st.empty()

col_v, col_r = st.columns([7, 3], gap='medium')
with col_v:
    hud_ph = st.empty()
    vid_ph = st.empty()
    alr_ph = st.empty()

with col_r:
    st.markdown('<div class="panel pt2"><div class="ptitle tl-t">📊 THREAT ANALYTICS</div>', unsafe_allow_html=True)
    chart_ph = st.empty()
    table_ph = st.empty()
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="panel ptpk" style="margin-top:8px"><div class="ptitle pk-t">🧠 DROWSINESS METER</div>', unsafe_allow_html=True)
    dstat_ph = st.empty()
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown("""
    <div class="panel ptvi" style="margin-top:8px">
      <div class="ptitle vi-t">🗺️ REAL-TIME MAP (INDIA)</div>
    </div>
    """, unsafe_allow_html=True)
    
    # City list for autocomplete
    cities = {
        "Karur": [10.9601, 78.0766], "Chennai": [13.0827, 80.2707], "Coimbatore": [11.0168, 76.9558],
        "Madurai": [9.9252, 78.1198], "Trichy": [10.7905, 78.7047], "Salem": [11.6643, 78.1460],
        "Erode": [11.3410, 77.7172], "Tiruppur": [11.1085, 77.3411], "Vellore": [12.9165, 79.1325],
        "Thoothukudi": [8.7642, 78.1348], "Dindigul": [10.3673, 77.9803], "Thanjavur": [10.7870, 79.1378],
        "Ranipet": [12.9274, 79.3326], "Sivakasi": [9.4533, 77.8024], "Ooty": [11.4100, 76.6950],
        "Hosur": [12.7409, 77.8253], "Nagercoil": [8.1833, 77.4119], "Kanchipuram": [12.8185, 79.6947],
        "Kumarapalayam": [11.4428, 77.7153], "Karaikkudi": [10.0762, 78.7745], "Neyveli": [11.5944, 79.4881],
        "Cuddalore": [11.7480, 79.7714], "Kumbakonam": [10.9602, 79.3845], "Tiruvannamalai": [12.2253, 79.0747],
        "Kodaikanal": [10.2381, 77.4892], "Rameswaram": [9.2876, 79.3129], "Kanyakumari": [8.0883, 77.5385],
        "Tirunelveli": [8.7139, 77.7567], "Rajapalayam": [9.4491, 77.5553], "Pudukkottai": [10.3797, 78.8205],
        "Namakkal": [11.2189, 78.1674], "Dharmapuri": [12.1211, 78.1582], "Krishnagiri": [12.5186, 78.2137],
        "Tenkasi": [8.9594, 77.3144], "Villupuram": [11.9401, 79.4861], "Arakkonam": [13.0805, 79.6702],
        "Chidambaram": [11.3992, 79.6936], "Mayiladuthurai": [11.1018, 79.6521], "Nagapattinam": [10.7661, 79.8449],
        "Pollachi": [10.6623, 77.0065], "Udhagamandalam": [11.4064, 76.6932], "Ambur": [12.7845, 78.7136],
        "Bangalore": [12.9716, 77.5946], "Mumbai": [19.0760, 72.8777], "Delhi": [28.7041, 77.1025],
        "Hyderabad": [17.3850, 78.4867], "Ahmedabad": [23.0225, 72.5714], "Kolkata": [22.5726, 88.3639],
        "Pune": [18.5204, 73.8567], "Jaipur": [26.9124, 75.7873], "Surat": [21.1702, 72.8311],
        "Lucknow": [26.8467, 80.9462], "Kanpur": [26.4499, 80.3319], "Nagpur": [21.1458, 79.0882],
        "Indore": [22.7196, 75.8577], "Thane": [19.2183, 72.9781], "Bhopal": [23.2599, 77.4126],
        "Visakhapatnam": [17.6868, 83.2185], "Patna": [25.5941, 85.1376], "Vadodara": [22.3072, 73.1812],
        "Ghaziabad": [28.6692, 77.4538], "Ludhiana": [30.9010, 75.8573], "Agra": [27.1767, 78.0081],
        "Nashik": [20.0059, 73.7629], "Faridabad": [28.4089, 77.3178], "Meerut": [28.9845, 77.7064],
        "Rajkot": [22.3039, 70.8022], "Kalyan-Dombivli": [19.2437, 73.1355], "Vasai-Virar": [19.3919, 72.8397],
        "Varanasi": [25.3176, 82.9739], "Srinagar": [34.0837, 74.7973], "Aurangabad": [19.8762, 75.3433],
        "Dhanbad": [23.7957, 86.4304], "Amritsar": [31.6340, 74.8723], "Navi Mumbai": [19.0330, 73.0297],
        "Allahabad": [25.4358, 81.8463], "Howrah": [22.5958, 88.2636], "Ranchi": [23.3441, 85.3096],
        "Gwalior": [26.2124, 78.1772], "Jabalpur": [23.1815, 79.9864], "Vijayawada": [16.5062, 80.6480],
        "Jodhpur": [26.2389, 73.0243], "Raipur": [21.2514, 81.6296], "Kota": [25.2138, 75.8648],
        "Guwahati": [26.1445, 91.7362], "Chandigarh": [30.7333, 76.7794], "Thiruvananthapuram": [8.5241, 76.9366],
        "Kochi": [9.9312, 76.2673], "Bhubaneswar": [20.2961, 85.8245], "Dehradun": [30.3165, 78.0322],
        "Jammu": [32.7266, 74.8570], "Agartala": [23.8315, 91.2868], "Aizawl": [23.7271, 92.7176],
        "Imphal": [24.8170, 93.9368], "Shillong": [25.5788, 91.8933], "Gangtok": [27.3314, 88.6138],
        "Panaji": [15.4909, 73.8278], "Shimla": [31.1048, 77.1734]
    }
    city_names = sorted(list(cities.keys()))
    selected_city = st.selectbox("Search City / Location", city_names, index=city_names.index("Karur"))
    
    loc = cities[selected_city]
    m = folium.Map(location=loc, zoom_start=12, control_scale=True)
    folium.Marker(loc, popup=selected_city, icon=folium.Icon(color="green", icon="car", prefix='fa')).add_to(m)
    st_folium(m, width=300, height=200, returned_objects=[])

    st.markdown("""
    <div class="panel ptvi" style="margin-top:8px">
      <div class="ptitle vi-t">🚗 NAVIGATION ASSIST</div>
      <span class="nk">⬆ Go</span><span class="nk">⬇ Brake</span>
      <span class="nk">⬅ L</span><span class="nk">➡ R</span>
      <span class="nk">⏸ Stop</span>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#5A4E7A;margin-top:6px;line-height:1.8;">
        AUTO-BRAKE: HIGH risk detected<br>
        DROWSY BRAKE: eye closure alert<br>
        BLIND SPOT: 360° scan active
      </div>
    </div>
    """, unsafe_allow_html=True)

nav_ph = st.empty()

# ── Main loop ──────────────────────────────────────────────────────────────────
if not run:
    vid_ph.markdown("""
    <div style="height:380px;display:flex;align-items:center;justify-content:center;
      background:#0D0020;border-radius:12px;border:1px solid #2A1050;">
      <div style="text-align:center;">
        <div style="font-size:42px;">⏸</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;
          letter-spacing:2px;color:#5A4E7A;margin-top:8px;">GUARDIAN INACTIVE</div>
      </div>
    </div>""", unsafe_allow_html=True)

elif cap is None or not cap.isOpened():
    vid_ph.markdown("""
    <div style="height:380px;display:flex;align-items:center;justify-content:center;
      background:#0D0020;border-radius:12px;border:2px solid #FF3D00;">
      <div style="text-align:center;">
        <div style="font-size:42px;">📷</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;
          color:#FF3D00;margin-top:8px;letter-spacing:2px;">CAMERA NOT FOUND</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;
          color:#5A4E7A;margin-top:5px;">Check if another app is using the camera<br>
          Try Camera Index 0 in sidebar</div>
      </div>
    </div>""", unsafe_allow_html=True)

else:
    fc        = st.session_state.fc
    last_dets = st.session_state.last_dets

    for _ in range(800):   # ~800 frames per page render cycle
        t0 = time.time()

        ret, frame = cap.read()
        if not ret or frame is None:
            # Camera stuttered — try to recover
            for _ in range(3):
                cap.read()
            ret, frame = cap.read()
            if not ret or frame is None:
                time.sleep(0.05)
                continue

        fc += 1
        h0, w0 = frame.shape[:2]

        # Enhancement
        enhanced = enhance_frame(frame, method=enh_mode, gamma_value=gamma_v)

        # YOLO detection
        if fc % frame_skip == 0 or fc == 1:
            if infer_w < w0:
                ih   = int(h0 * infer_w / w0)
                sm   = cv2.resize(enhanced, (infer_w, ih), interpolation=cv2.INTER_LINEAR)
                dets = st.session_state.detector.detect(sm, simulate_potholes=sim_pot, detect_faces=det_face)
                sx, sy = w0/infer_w, h0/ih
                for d in dets:
                    if d['label'] != 'Pothole':
                        d['box'] = [int(d['box'][0]*sx), int(d['box'][1]*sy),
                                    int(d['box'][2]*sx), int(d['box'][3]*sy)]
            else:
                dets = st.session_state.detector.detect(enhanced, simulate_potholes=sim_pot, detect_faces=det_face)

            if sim_cow:
                dets.append({'box':[int(w0*.62),int(h0*.57),int(w0*.78),int(h0*.8)],
                             'label':'Stray Cow','conf':0.95})
            last_dets = dets

        dets     = analyze_hazards(last_dets, enhanced.shape, config.COLLISION_RISK_HIGH, config.COLLISION_RISK_MED)
        enhanced = draw_detection_overlay(enhanced, dets)

        # Drowsiness
        drow = {'alert_level':'NONE','alert_msg':'','eye_count':2,'face_found':False,'annotated':enhanced}
        if drow_on:
            drow = st.session_state.drowsy.analyse(enhanced)
            enhanced = drow['annotated']

        # HUD text on frame
        ts = time.strftime('%H:%M:%S')
        cv2.putText(enhanced, f'GUARDIAN v3 · {ts} · {w0}x{h0}',
                    (8, h0-8), cv2.FONT_HERSHEY_DUPLEX, 0.4, (0,255,209), 1, cv2.LINE_AA)

        # Risk
        highest='Low'; h_msg=''; nav=[]
        for d in dets:
            r,l,dist = d.get('risk','Low'), d.get('label',''), d.get('distance','?')
            if r=='High':
                highest='High'; h_msg=f'🚨 DANGER — {l} at {dist}m! BRAKE!'
                nav.append(f'⛔ COLLISION · {l} · {dist}m')
                st.session_state.alerts.trigger_beep(1800,350)
                try: st.session_state.alerts.trigger_voice(l, float(str(dist).replace('m','')))
                except: pass
            elif r=='Medium' and highest!='High':
                highest='Medium'; h_msg=f'⚠️ {l} — {dist}m'
                nav.append(f'⚠️ CAUTION · {l} · {dist}m')
                st.session_state.alerts.trigger_beep(1100,200)
            if l=='Pothole': nav.append('🕳️ POTHOLE — slow down')
            if l.startswith('Driver Face'):
                if 'WORN' in l:
                    nav.append('👤 Driver face locked (Seatbelt OK)')
                elif 'NO' in l:
                    nav.append('🚨 SEATBELT NOT WORN! Please wear it.')
                    if highest != 'High':
                        highest = 'High'
                        h_msg = '🚨 SEATBELT NOT WORN! Please wear it.'
                        st.session_state.alerts.trigger_beep(1500, 300)
                        try: st.session_state.alerts.trigger_voice('Please wear your seat belt', 0)
                        except: pass
            if r in ('Medium','High'): st.session_state.logger.log_detection(l,d['conf'],dist,r)

        # Drowsiness beep
        now  = time.time()
        dlvl = drow['alert_level']
        if dlvl in ('DANGER','WARNING') and now - st.session_state.drow_alrt > (3 if dlvl=='DANGER' else 7):
            st.session_state.alerts.trigger_beep(2200 if dlvl=='DANGER' else 1400, 500)
            st.session_state.drow_alrt = now

        # FPS
        elapsed = max(time.time()-t0, 0.001)
        fps = round(1.0/elapsed, 1)
        lat = round(elapsed*1000, 0)

        # ── Convert frame → JPEG base64 (fastest display method) ─────────────
        rgb = cv2.cvtColor(enhanced, cv2.COLOR_BGR2RGB)
        _, buf = cv2.imencode('.jpg', rgb, [cv2.IMWRITE_JPEG_QUALITY, 98])
        jpg64 = base64.b64encode(buf.tobytes()).decode()

        # ── Metrics ───────────────────────────────────────────────────────────
        ec   = drow.get('eye_count', 2)
        rclr = {'High':'crd','Medium':'cyw','Low':'cgr'}[highest]
        eclr = 'crd' if ec==0 else 'cgr'
        fclr = 'cvi' if drow.get('face_found') else 'cdm'

        met_ph.markdown(f"""
        <div class="mrow">
          <div class="mc"><div class="ml">FPS</div><div class="mv ctl">{fps}</div></div>
          <div class="mc"><div class="ml">Latency</div><div class="mv ctl">{int(lat)}ms</div></div>
          <div class="mc"><div class="ml">Hazards</div><div class="mv {'cyw' if len(dets)>0 else 'cgr'}">{len([d for d in dets if d.get('label')!='Driver Face'])}</div></div>
          <div class="mc"><div class="ml">Face</div><div class="mv {fclr}">{'ON' if drow.get('face_found') else 'OFF'}</div></div>
          <div class="mc"><div class="ml">Eyes</div><div class="mv {eclr}">{ec}/2</div></div>
          <div class="mc"><div class="ml">Risk</div><div class="mv {rclr}">{highest}</div></div>
        </div>""", unsafe_allow_html=True)

        # ── Drowsiness banner ─────────────────────────────────────────────────
        if dlvl=='DANGER':
            drow_ph.markdown(f'<div class="adanger">😴 {drow.get("alert_msg","DRIVER ALERT!")}</div>', unsafe_allow_html=True)
        elif dlvl=='WARNING':
            drow_ph.markdown(f'<div class="awarn">⚠️ {drow.get("alert_msg","")}</div>', unsafe_allow_html=True)
        else:
            drow_ph.markdown('<div class="aclear">👁️ DRIVER AWAKE — Eyes Normal</div>', unsafe_allow_html=True)

        # ── HUD bar ───────────────────────────────────────────────────────────
        hud_ph.markdown(f"""
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#5A4E7A;
          display:flex;justify-content:space-between;padding:2px 0 6px;">
          <span>📡 <span style="color:#00FFD1;">CAM {cam_idx} · {cam_w}x{cam_h}</span></span>
          <span>{ts}</span>
          <span>{enh_mode} · skip:{frame_skip} · yolo:{infer_w}px</span>
        </div>""", unsafe_allow_html=True)

        # ── Video frame ───────────────────────────────────────────────────────
        vid_ph.markdown(
            f'<img src="data:image/jpeg;base64,{jpg64}" '
            f'style="width:100%;border-radius:10px;border:1px solid #2A1050;display:block;"/>',
            unsafe_allow_html=True)

        # ── Hazard alert ──────────────────────────────────────────────────────
        if h_msg:
            alr_ph.markdown(f'<div class="{"adanger" if highest=="High" else "awarn"}">{h_msg}</div>', unsafe_allow_html=True)
        else:
            alr_ph.markdown('<div class="aclear">✅ ROAD CLEAR</div>', unsafe_allow_html=True)

        # ── Nav ───────────────────────────────────────────────────────────────
        if sim_bsp: nav.append('🔴 BLIND SPOT — vehicle right lane')
        nav_ph.markdown(''.join(f'<div class="anav">{a}</div>' for a in (nav or ['🚗 NAV NOMINAL · Clear'])), unsafe_allow_html=True)

        # ── Drowsiness meter ──────────────────────────────────────────────────
        no_eye_ct = st.session_state.drowsy._no_eye_count
        pct = min(100, int(no_eye_ct / max(drow_thr,1) * 100))
        dclr = '#FF3D00' if pct>70 else ('#FFD600' if pct>40 else '#00FFA3')
        dstat_ph.markdown(f"""
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#5A4E7A;line-height:2;">
          Closed-eye frames: <span style="color:#EDE8FF">{no_eye_ct}/{drow_thr}</span><br>
          Yawn count: <span style="color:#EDE8FF">{st.session_state.drowsy._yawn_count}</span><br>
          Head nod: <span style="color:#EDE8FF">{st.session_state.drowsy._drift_count}</span>
        </div>
        <div class="rbar-bg"><div class="rbar" style="width:{pct}%;background:{dclr};"></div></div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:{dclr};margin-top:3px;">
          FATIGUE RISK: {pct}%
        </div>""", unsafe_allow_html=True)

        # ── Analytics ─────────────────────────────────────────────────────────
        rows = st.session_state.logger.fetch_recent_logs(limit=8)
        if rows:
            df = pd.DataFrame(rows, columns=['Time','Hazard','Conf','Dist','Risk'])
            table_ph.dataframe(df, width='stretch', hide_index=True, height=160)
            cd = df['Hazard'].value_counts().reset_index(); cd.columns=['Hazard','Count']
            chart_ph.bar_chart(cd, x='Hazard', y='Count', color='#FF00CC', height=120)
        else:
            table_ph.info('No threats logged.')

        st.session_state.fc        = fc
        st.session_state.last_dets = last_dets

        if not run:
            break
