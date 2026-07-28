# 👁️ NightVision AI – ADAS Night-Driving Safety Platform

**NightVision AI** is a production-ready, intelligent night-driving safety platform that uses computer vision and AI to detect road hazards, predict collisions, monitor driver fatigue, and issue real-time auditory warnings before accidents occur.

---

## 🌟 Key Features

* **Preserved Tactical UI**: Built directly around the Stitch design system (Automotive Minimalism, `#00E5FF` electric blue accents, `#FFB300` amber alerts, glassmorphism overlays, and HUD scanlines).
* **Real-time AI Hazard Detection**: YOLOv8 + OpenCV monocular distance estimation detecting Pedestrians, Vehicles, Animals, Potholes, Traffic Cones, and Speed Breakers.
* **Collision Risk Predictor**: Calculates Time-To-Collision (TTC) in seconds (`TTC = distance / relative_velocity`) categorizing risk into Low, Medium, High, and Critical.
* **Driver Drowsiness Monitor**: Eye Aspect Ratio (EAR < 0.20) and yawning frequency tracker with auditory wake-up alerts.
* **Spoken Voice Warnings**: Integrated Web SpeechSynthesis engine emitting real-time auditory warnings for high-risk hazards.
* **Emergency SOS Module**: 5-second countdown SOS emergency broadcast with direct GPS location sharing and emergency contact notification.
* **Trip History & Safety Analytics**: Complete trip logs, average/max speed, hazard timeline, interactive risk charts (Recharts), and PDF/CSV report export.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18 / Vite / TypeScript
- **Styling**: Tailwind CSS (with exact Stitch design tokens)
- **Icons**: Lucide-react + Material Symbols Outlined
- **Charts**: Recharts
- **Audio/Voice**: Web SpeechSynthesis API

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Computer Vision**: OpenCV, Ultralytics YOLOv8, NumPy
- **Database**: PostgreSQL / SQLite (SQLAlchemy ORM)
- **Auth**: JWT Authentication
- **Streaming**: WebSockets

---

## 🚀 Quick Start (Local Development)

### 1. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open browser at `http://localhost:3000`.

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python -m app.main
```
Backend API will be running at `http://localhost:8000` (Docs at `http://localhost:8000/docs`).

---

## 🐳 Docker Deployment

To launch the full production environment (Frontend, FastAPI Backend, PostgreSQL DB):

```bash
docker-compose up --build -d
```
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **PostgreSQL**: `localhost:5432`

---

## 🔒 Security & Architecture

- **Clean Modular Architecture**: Service layer separation, repository patterns, custom hooks.
- **Input Validation**: Pydantic schemas & TypeScript type safety.
- **Fail-Safe Client Engine**: Standalone web simulation guarantees 100% functionality out of the box even without hardware camera attached.
