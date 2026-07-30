# NightVision-AI

Edge-based low-light and foggy-condition object detection for safer driving. This is a 100% software solution optimized to run locally on your system to identify road hazards, pedestrians, vehicles, bikes, and animals.

---

## Key Features

1. **Low-Light Image Enhancement**: Uses CLAHE, Gamma Correction, and bilateral noise reduction filters to clear dark frames.
2. **Object Detection**: Leverages quantized/lightweight YOLOv8 models (`yolov8n.pt`) for real-time edge processing.
3. **Collision Risk Analysis**: Monocular distance estimation classifying targets into High, Medium, or Low risk thresholds.
4. **Instant Alerts**:
   - **Sound alerts** (frequency-tuned beep codes).
   - **Voice alerts** (multithreaded local text-to-speech warnings).
5. **Interactive Operations Dashboard**: Built using Streamlit, featuring real-time side-by-side operations feeds, metrics tracking, and SQLite history analysis logs.

---

## Directory Structure

```text
NightVision-AI/
├── app/
│   ├── config.py         # App thresholds, paths, and speed parameters
│   └── main.py           # Entry CLI runner & dependencies check
├── modules/
│   ├── capture.py        # Video/Webcam frame capture interface
│   ├── enhance.py        # Contrast, Gamma, and Dehazing enhancement filters
│   ├── detect.py         # YOLOv8 inference wrapper and COCO category mapping
│   ├── analyze.py        # Distance & risk evaluation logic
│   ├── alert.py          # Asynchronous speech and sound sirens
│   └── logger.py         # SQLite logging for persistent storage
├── dashboard/
│   └── dashboard.py      # Main Streamlit web application dashboard
├── database/
│   └── detections.db     # SQLite persistence database (created automatically)
├── requirements.txt      # List of dependencies
└── README.md             # Guide documentation
```

---

## Installation & Setup

Ensure Python 3.10+ is installed on your Windows machine, then follow these steps:

### 1. Set Up Virtual Environment (Optional)
If you wish to use the workspace's virtual environment:
```powershell
# From the workspace root
.\venv\Scripts\activate
```

### 2. Install Project Dependencies
```bash
pip install -r requirements.txt
```

### 3. Start the Interactive Dashboard
Run the following command from the `NightVision-AI` directory:
```bash
streamlit run dashboard/dashboard.py
```
This will launch the dashboard in your default browser at `http://localhost:8501`.

### 4. Running in CLI Mode (Headless)
If you wish to run the detection engine directly in your terminal without the GUI dashboard:
```bash
python app/main.py --cli
```
Press `Ctrl + C` to stop the program.
