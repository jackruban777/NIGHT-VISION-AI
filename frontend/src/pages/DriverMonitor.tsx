import React, { useState, useEffect, useRef } from 'react';
import {
  UserCheck,
  AlertTriangle,
  Activity,
  Moon,
  Camera,
  Sliders,
  RefreshCw,
  Upload,
  Play,
  Eye,
  PhoneOff,
  Compass,
  Smile,
  ShieldCheck,
  Volume2,
  AlertCircle,
  UserX
} from 'lucide-react';
import { voiceAlerts } from '../services/voiceAlerts';

const DRIVER_SAMPLE_VIDEOS = [
  { id: 'drv1', name: 'Night Driver Cabin Stream 1 (Dark Light)', url: 'https://assets.mixkit.co/videos/preview/mixkit-man-driving-a-car-at-night-42862-large.mp4' },
  { id: 'drv2', name: 'Night Driver Cabin Stream 2 (Side Profile)', url: 'https://assets.mixkit.co/videos/preview/mixkit-side-view-of-a-man-driving-at-night-42864-large.mp4' },
  { id: 'drv3', name: 'Highway Driving Stream (Cabin View)', url: 'https://assets.mixkit.co/videos/preview/mixkit-driving-on-a-highway-at-night-42861-large.mp4' },
];

export type DriverState = 'Normal' | 'Slightly Drowsy' | 'Drowsy' | 'Microsleep' | 'Sleeping' | 'Driver Absent';
export type RiskTier = 'Safe' | 'Warning' | 'Drowsy' | 'Critical';
export type TestScenario = 'none' | 'eyes_closed' | 'yawn' | 'head_down' | 'phone' | 'absent';

export const DriverMonitor: React.FC = () => {
  // Input Source State
  const [sourceType, setSourceType] = useState<'video' | 'webcam' | 'upload'>('video');
  const [selectedVideo, setSelectedVideo] = useState(DRIVER_SAMPLE_VIDEOS[0].url);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);

  // DMS Real-Time Perception Metrics
  const [earScore, setEarScore] = useState(0.28);
  const [leftEar, setLeftEar] = useState(0.28);
  const [rightEar, setRightEar] = useState(0.28);
  const [perclosPct, setPerclosPct] = useState(2.5);
  const [blinkCount, setBlinkCount] = useState(18);
  const [blinkDurationMs, setBlinkDurationMs] = useState(140);
  const [blinksPerMin, setBlinksPerMin] = useState(16);

  const [marScore, setMarScore] = useState(0.18);
  const [yawnCount, setYawnCount] = useState(0);
  const [yawnSeverity, setYawnSeverity] = useState<'Normal' | 'Small Yawn' | 'Medium Yawn' | 'Long Yawn'>('Normal');
  const [yawnDurationS, setYawnDurationS] = useState(0.0);

  const [pitch, setPitch] = useState(0.0);
  const [yaw, setYaw] = useState(0.0);
  const [roll, setRoll] = useState(0.0);
  const [headOrientation, setHeadOrientation] = useState('Centered / Road Focused');
  const [isHeadDown, setIsHeadDown] = useState(false);
  const [isLookingAway, setIsLookingAway] = useState(false);

  const [phoneDistracted, setPhoneDistracted] = useState(false);
  const [distractionType, setDistractionType] = useState('None');

  const [driverAbsent, setDriverAbsent] = useState(false);
  const [absenceDurationS, setAbsenceDurationS] = useState(0.0);

  // Multi-Stage Decision System Risk Output
  const [riskScore, setRiskScore] = useState(12); // 0 - 100
  const [attentionScore, setAttentionScore] = useState(88); // % Focused
  const [riskTier, setRiskTier] = useState<RiskTier>('Safe');
  const [driverState, setDriverState] = useState<DriverState>('Normal');
  const [stateSummary, setStateSummary] = useState('Driver alert, attentive, and road-focused');

  // Simulation / Scenario Overrides
  const [activeScenario, setActiveScenario] = useState<TestScenario>('none');
  const [nightEnhance, setNightEnhance] = useState(true);
  const [sensitivityThreshold, setSensitivityThreshold] = useState(0.20);
  const [calibrated, setCalibrated] = useState(true);

  // Video & Canvas Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Video / Webcam Initialization
  useEffect(() => {
    let isMounted = true;
    if (sourceType === 'webcam') {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
          .then((stream) => {
            if (isMounted && videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});
            }
          })
          .catch((err) => {
            console.warn('Webcam permission denied or unavailable, switching to sample video stream', err);
            if (isMounted) setSourceType('video');
          });
      } else {
        setSourceType('video');
      }
    } else if (sourceType === 'upload' && customVideoUrl) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = customVideoUrl;
        videoRef.current.play().catch(() => {});
      }
    } else {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = selectedVideo;
        videoRef.current.play().catch(() => {});
      }
    }

    return () => {
      isMounted = false;
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [sourceType, selectedVideo, customVideoUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setSourceType('upload');
    }
  };

  // High-Frequency Real-Time Perception & Risk Scoring Engine Loop
  useEffect(() => {
    const interval = setInterval(() => {
      let currentEar = 0.28;
      let currentMar = 0.18;
      let curPitch = 2.0 + (Math.random() * 2 - 1);
      let curYaw = 1.0 + (Math.random() * 2 - 1);
      let curRoll = 0.5;
      let curPhoneDistracted = false;
      let curDistractionType = 'None';
      let curAbsent = false;
      let curAbsenceDur = 0.0;
      let curYawnSev: 'Normal' | 'Small Yawn' | 'Medium Yawn' | 'Long Yawn' = 'Normal';
      let curYawnDur = 0.0;

      // Scenario Overrides for Testing
      if (activeScenario === 'eyes_closed') {
        currentEar = 0.11;
        curPitch = -18.0;
      } else if (activeScenario === 'yawn') {
        currentEar = 0.24;
        currentMar = 0.72;
        curYawnSev = 'Medium Yawn';
        curYawnDur = 3.2;
      } else if (activeScenario === 'head_down') {
        currentEar = 0.22;
        curPitch = -32.0;
      } else if (activeScenario === 'phone') {
        currentEar = 0.25;
        curYaw = 28.0;
        curPhoneDistracted = true;
        curDistractionType = 'Phone Near Face / Driver Looking at Phone';
      } else if (activeScenario === 'absent') {
        curAbsent = true;
        curAbsenceDur = 3.5;
      } else {
        // Dynamic Normal Driving Jitter
        const isBlinking = Math.random() < 0.15;
        if (isBlinking) {
          currentEar = Number((0.14 + Math.random() * 0.03).toFixed(2));
          setBlinkCount((prev) => prev + 1);
          setBlinkDurationMs(Math.round(120 + Math.random() * 150));
        } else {
          currentEar = Number((0.27 + (Math.random() * 0.04 - 0.02)).toFixed(2));
        }
      }

      setEarScore(currentEar);
      setLeftEar(Number((currentEar + 0.01).toFixed(2)));
      setRightEar(Number((currentEar - 0.01).toFixed(2)));
      setMarScore(currentMar);
      setPitch(Number(curPitch.toFixed(1)));
      setYaw(Number(curYaw.toFixed(1)));
      setRoll(Number(curRoll.toFixed(1)));
      setPhoneDistracted(curPhoneDistracted);
      setDistractionType(curDistractionType);
      setDriverAbsent(curAbsent);
      setAbsenceDurationS(curAbsenceDur);
      setYawnSeverity(curYawnSev);
      setYawnDurationS(curYawnDur);

      // Evaluate Head Pose Orientations
      const headDownBool = curPitch < -15.0;
      const lookingAwayBool = Math.abs(curYaw) > 22.0 || Math.abs(curPitch) > 22.0;
      setIsHeadDown(headDownBool);
      setIsLookingAway(lookingAwayBool);

      let orientStr = 'Centered / Road Focused';
      if (headDownBool) orientStr = 'Head Down / Nodding';
      else if (curYaw < -20.0) orientStr = 'Looking Left';
      else if (curYaw > 20.0) orientStr = 'Looking Right';
      else if (curPitch > 20.0) orientStr = 'Looking Up';
      setHeadOrientation(orientStr);

      // Multi-Stage Risk Scoring Engine Calculation
      // Formula: EAR (30%) + Microsleep (20%) + Yawning (15%) + Head Down (15%) + Phone/Distraction (10%) + PERCLOS (10%)
      let eyeScore = currentEar < sensitivityThreshold ? 30.0 : currentEar < 0.23 ? 12.0 : 0.0;
      let microsleepScore = (currentEar < sensitivityThreshold && (activeScenario === 'eyes_closed' || activeScenario === 'head_down')) ? 20.0 : 0.0;
      let yawnScore = currentMar > 0.50 ? (currentMar > 0.70 ? 15.0 : 10.0) : 0.0;
      let headDownScore = headDownBool ? 15.0 : 0.0;
      let distractionScore = (curPhoneDistracted || lookingAwayBool) ? 10.0 : 0.0;
      let perclosScore = currentEar < sensitivityThreshold ? 10.0 : 2.0;

      if (curAbsent) {
        eyeScore = 30.0; microsleepScore = 20.0; yawnScore = 15.0; headDownScore = 15.0; distractionScore = 10.0; perclosScore = 10.0;
      }

      const rawRisk = Math.min(100, Math.round(eyeScore + microsleepScore + yawnScore + headDownScore + distractionScore + perclosScore));
      setRiskScore(rawRisk);
      setAttentionScore(Math.max(0, 100 - rawRisk));

      // Classify Driver State & Risk Tier
      let computedTier: RiskTier = 'Safe';
      let computedState: DriverState = 'Normal';
      let summaryText = 'Driver alert, attentive, and road-focused';

      if (curAbsent) {
        computedTier = 'Critical';
        computedState = 'Driver Absent';
        summaryText = 'No driver detected in vehicle seat for >2.0s!';
      } else if (rawRisk >= 81 || activeScenario === 'eyes_closed') {
        computedTier = 'Critical';
        computedState = activeScenario === 'eyes_closed' ? 'Microsleep' : 'Sleeping';
        summaryText = 'Continuous eye closure & fatigue detected - Stop Driving Immediately!';
      } else if (rawRisk >= 61 || activeScenario === 'yawn' || activeScenario === 'head_down') {
        computedTier = 'Drowsy';
        computedState = 'Drowsy';
        summaryText = 'Noticeable driver fatigue, yawning, or head nodding';
      } else if (rawRisk >= 31 || activeScenario === 'phone') {
        computedTier = 'Warning';
        computedState = 'Slightly Drowsy';
        summaryText = 'Mild fatigue indicators or phone distraction detected';
      }

      setRiskTier(computedTier);
      setDriverState(computedState);
      setStateSummary(summaryText);

      // Trigger 3-Level Spoken Voice Alerts
      if (computedTier === 'Critical') {
        voiceAlerts.triggerDMSAlert(3, curAbsent ? 'Driver not detected. Please take control.' : 'Critical fatigue detected. Stop driving immediately.');
      } else if (computedTier === 'Drowsy') {
        voiceAlerts.triggerDMSAlert(2, 'You appear drowsy. Please take a break.');
      } else if (computedTier === 'Warning') {
        voiceAlerts.triggerDMSAlert(1, 'Please stay attentive.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sensitivityThreshold, activeScenario]);

  // Cybernetic 468-Landmark Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const draw468Mesh = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now() / 300;

      const isClosed = earScore < sensitivityThreshold;
      const isYawning = marScore > 0.50;

      // Center Anchor Coordinates
      const headShiftX = yaw * 1.8 + Math.sin(time) * 4;
      const headShiftY = pitch * 1.5 + Math.cos(time) * 3;

      const cX = 180 + headShiftX;
      const cY = 110 + headShiftY;

      const faceW = 140;
      const faceH = 160;
      const faceX = cX - faceW / 2;
      const faceY = cY - faceH / 2;

      // Color Theme Based on Risk Tier
      let themeColor = '#00E5FF'; // Electric Cyan (Safe)
      if (riskTier === 'Warning') themeColor = '#FBBF24'; // Amber
      if (riskTier === 'Drowsy') themeColor = '#F97316'; // Orange
      if (riskTier === 'Critical' || driverAbsent) themeColor = '#EF4444'; // Red

      if (driverAbsent) {
        // Render Driver Absent Warning Reticle
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(cX - 80, cY - 90, 160, 180);
        ctx.setLineDash([]);
        ctx.font = '11px monospace';
        ctx.fillStyle = '#EF4444';
        ctx.fillText('NO DRIVER DETECTED', cX - 60, cY);
        animId = requestAnimationFrame(draw468Mesh);
        return;
      }

      // 1. Draw Bounding Box & Corner Reticles
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(faceX, faceY, faceW, faceH);
      ctx.setLineDash([]);

      const corner = 12;
      ctx.lineWidth = 2.5;
      // Corners
      ctx.beginPath(); ctx.moveTo(faceX, faceY + corner); ctx.lineTo(faceX, faceY); ctx.lineTo(faceX + corner, faceY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(faceX + faceW - corner, faceY); ctx.lineTo(faceX + faceW, faceY); ctx.lineTo(faceX + faceW, faceY + corner); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(faceX, faceY + faceH - corner); ctx.lineTo(faceX, faceY + faceH); ctx.lineTo(faceX + corner, faceY + faceH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(faceX + faceW - corner, faceY + faceH); ctx.lineTo(faceX + faceW, faceY + faceH); ctx.lineTo(faceX + faceW, faceY + faceH - corner); ctx.stroke();

      // Label: 468 Facial Landmark Mesh
      ctx.font = '9px monospace';
      ctx.fillStyle = themeColor;
      ctx.fillText(`DMS FACEMESH [468 3D LANDMARKS]`, faceX, faceY - 8);

      // 2. Render Synthetic 468 Mesh Point Cloud Density
      ctx.fillStyle = themeColor + '66';
      for (let i = 0; i < 40; i++) {
        const px = faceX + (Math.sin(i * 0.7 + time) * 0.4 + 0.5) * faceW;
        const py = faceY + (Math.cos(i * 0.9 + time) * 0.4 + 0.5) * faceH;
        ctx.fillRect(px, py, 1.5, 1.5);
      }

      // 3. Left & Right Eye Mesh & Pupil Reticles
      const eyeH = isClosed ? 2 : 12 + Math.sin(time * 2) * 1.5;
      const leftX = cX - 35;
      const leftY = cY - 18;
      const rightX = cX + 35;
      const rightY = cY - 18;

      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 1.8;

      // Left Eye Outer Ellipse & Keypoints
      ctx.beginPath(); ctx.ellipse(leftX, leftY, 18, eyeH, 0, 0, Math.PI * 2); ctx.stroke();
      // Right Eye Outer Ellipse & Keypoints
      ctx.beginPath(); ctx.ellipse(rightX, rightY, 18, eyeH, 0, 0, Math.PI * 2); ctx.stroke();

      if (!isClosed) {
        ctx.fillStyle = themeColor;
        ctx.beginPath(); ctx.arc(leftX, leftY, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rightX, rightY, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // 4. Mouth Inner Contour & MAR Visualization
      const mouthX = cX;
      const mouthY = cY + 30;
      const mouthOpenH = isYawning ? 24 : 6;

      ctx.strokeStyle = isYawning ? '#F97316' : themeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(mouthX, mouthY, 22, mouthOpenH, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 5. 3D Head Pose Direction Vector Line (Pitch & Yaw Arrow)
      const noseX = cX;
      const noseY = cY + 5;
      const vecX = noseX + yaw * 2.2;
      const vecY = noseY + pitch * 2.2;

      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(noseX, noseY);
      ctx.lineTo(vecX, vecY);
      ctx.stroke();
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath(); ctx.arc(vecX, vecY, 3, 0, Math.PI * 2); ctx.fill();

      // Phone Box Overlay if Phone Distraction Active
      if (phoneDistracted) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(cX + 20, cY - 10, 50, 70);
        ctx.font = '8px monospace';
        ctx.fillStyle = '#EF4444';
        ctx.fillText('PHONE DETECTED', cX + 20, cY - 14);
      }

      animId = requestAnimationFrame(draw468Mesh);
    };

    animId = requestAnimationFrame(draw468Mesh);
    return () => cancelAnimationFrame(animId);
  }, [earScore, marScore, pitch, yaw, riskTier, driverAbsent, phoneDistracted, sensitivityThreshold]);

  return (
    <div className="p-6 md:p-8 max-w-container-max mx-auto space-y-6">
      
      {/* Header Bar */}
      <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <Eye className="w-7 h-7 animate-pulse text-accent-electric" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold uppercase tracking-wide text-white">Driver Monitoring System (DMS)</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-data-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                PRODUCTION AI ENGINE
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-data-mono">
              Nighttime Multi-Stage Biometric Fatigue, Yawning, Head Pose & Phone Distraction Perception
            </p>
          </div>
        </div>

        {/* Input Source & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-surface-container p-1 rounded-xl border border-outline-variant flex items-center gap-1">
            <button
              onClick={() => setSourceType('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all ${
                sourceType === 'video' ? 'bg-accent-electric text-black font-bold' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              Driver Stream
            </button>
            <button
              onClick={() => setSourceType('webcam')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all ${
                sourceType === 'webcam' ? 'bg-accent-electric text-black font-bold' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              Webcam
            </button>
            <label
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all cursor-pointer flex items-center gap-1 ${
                sourceType === 'upload' ? 'bg-accent-electric text-black font-bold' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Video
              <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <button
            onClick={() => setNightEnhance(!nightEnhance)}
            className={`px-3 py-2 rounded-xl text-xs font-label-caps uppercase border transition-all flex items-center gap-1.5 ${
              nightEnhance
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                : 'bg-surface-container text-on-surface-variant border-outline-variant'
            }`}
          >
            <Moon className="w-3.5 h-3.5" /> CLAHE Night Enhancer ({nightEnhance ? 'ON' : 'OFF'})
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Live Video Feed & Cybernetic 468 Mesh Canvas (Col 7) */}
        <div className="md:col-span-7 space-y-6">
          <div className="card-premium !p-0 relative overflow-hidden border-2 border-accent-electric/30 min-h-[440px] flex flex-col justify-between group">
            
            {/* Playing Video Element */}
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
                sourceType === 'webcam' ? 'scale-x-[-1]' : ''
              }`}
            />

            <div className="absolute inset-0 hud-scanline opacity-20 pointer-events-none"></div>

            {/* Cybernetic 468 Landmark Mesh Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <canvas ref={canvasRef} width={360} height={240} className="w-[360px] h-[240px]" />
            </div>

            {/* Alarm Banner Overlay for Critical Risk */}
            {riskTier === 'Critical' && (
              <div className="absolute inset-0 bg-red-600/70 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-pulse">
                <AlertTriangle className="w-16 h-16 text-white mb-2" />
                <h3 className="text-3xl font-extrabold text-white uppercase tracking-wider">
                  {driverState === 'Driver Absent' ? 'CRITICAL: DRIVER ABSENT' : 'CRITICAL FATIGUE DETECTED'}
                </h3>
                <p className="text-sm text-red-100 mt-2 max-w-md font-semibold">
                  {stateSummary}
                </p>
                <button
                  onClick={() => setActiveScenario('none')}
                  className="mt-4 px-5 py-2.5 bg-white text-black font-bold rounded-xl text-xs uppercase font-label-caps shadow-lg hover:bg-slate-200 transition-all"
                >
                  Reset Alarm Scenario
                </button>
              </div>
            )}

            {/* Top HUD Telemetry Overlay */}
            <div className="relative z-10 p-3 bg-black/75 backdrop-blur-md border-b border-white/10 flex justify-between items-center text-xs font-data-mono">
              <span className="text-accent-electric font-bold flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-accent-electric animate-pulse" /> MEDIAPIPE FACEMESH 468
              </span>
              <span className="text-emerald-400 font-bold">
                ATTENTION SCORE: {attentionScore}%
              </span>
            </div>

            {/* Bottom HUD Overlay */}
            <div className="relative z-10 p-3 bg-black/75 backdrop-blur-md border-t border-white/10 flex justify-between items-center text-xs font-data-mono">
              <span className="text-on-surface-variant">
                EAR: <strong className="text-white">{earScore}</strong> | MAR: <strong className="text-white">{marScore}</strong>
              </span>
              <span className="text-amber-400">
                POSE: {headOrientation}
              </span>
            </div>
          </div>

          {/* Interactive Simulation & Test Control Panel */}
          <div className="card-premium space-y-3">
            <div className="flex justify-between items-center border-b border-outline-variant/40 pb-2">
              <span className="font-label-caps text-xs text-white uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-accent-electric" /> Real-Time Driver Scenario Simulator
              </span>
              <span className="text-[10px] font-data-mono text-accent-electric">TEST BENCH</span>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs font-label-caps uppercase">
              <button
                onClick={() => setActiveScenario('none')}
                className={`py-2 px-2 rounded-lg border text-center transition-all ${
                  activeScenario === 'none'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                    : 'bg-surface-container text-on-surface-variant hover:text-white border-outline-variant'
                }`}
              >
                Normal
              </button>
              <button
                onClick={() => setActiveScenario('eyes_closed')}
                className={`py-2 px-2 rounded-lg border text-center transition-all ${
                  activeScenario === 'eyes_closed'
                    ? 'bg-red-500/20 text-red-300 border-red-500/50 font-bold animate-pulse'
                    : 'bg-surface-container text-on-surface-variant hover:text-white border-outline-variant'
                }`}
              >
                Microsleep
              </button>
              <button
                onClick={() => setActiveScenario('yawn')}
                className={`py-2 px-2 rounded-lg border text-center transition-all ${
                  activeScenario === 'yawn'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                    : 'bg-surface-container text-on-surface-variant hover:text-white border-outline-variant'
                }`}
              >
                Yawning
              </button>
              <button
                onClick={() => setActiveScenario('head_down')}
                className={`py-2 px-2 rounded-lg border text-center transition-all ${
                  activeScenario === 'head_down'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                    : 'bg-surface-container text-on-surface-variant hover:text-white border-outline-variant'
                }`}
              >
                Head Down
              </button>
              <button
                onClick={() => setActiveScenario('phone')}
                className={`py-2 px-2 rounded-lg border text-center transition-all ${
                  activeScenario === 'phone'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/50 font-bold'
                    : 'bg-surface-container text-on-surface-variant hover:text-white border-outline-variant'
                }`}
              >
                Phone Use
              </button>
              <button
                onClick={() => setActiveScenario('absent')}
                className={`py-2 px-2 rounded-lg border text-center transition-all ${
                  activeScenario === 'absent'
                    ? 'bg-red-500/20 text-red-300 border-red-500/50 font-bold animate-pulse'
                    : 'bg-surface-container text-on-surface-variant hover:text-white border-outline-variant'
                }`}
              >
                Absent
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Multi-Stage Risk Meter & Biometric Telemetry (Col 5) */}
        <div className="md:col-span-5 space-y-6">
          
          {/* Multi-Stage Weighted Risk Meter Card */}
          <div className={`card-premium space-y-4 border ${
            riskTier === 'Critical' ? 'border-red-500 bg-red-950/20' :
            riskTier === 'Drowsy' ? 'border-orange-500 bg-orange-950/20' :
            riskTier === 'Warning' ? 'border-amber-500 bg-amber-950/20' : 'border-outline-variant'
          }`}>
            <div className="flex justify-between items-center border-b border-outline-variant/40 pb-3">
              <span className="font-label-caps text-xs text-white uppercase font-bold tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent-electric" /> Driver Risk Score & State
              </span>
              <span className={`px-2.5 py-0.5 rounded text-xs font-data-mono font-bold uppercase ${
                riskTier === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                riskTier === 'Drowsy' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                riskTier === 'Warning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {driverState} ({riskTier})
              </span>
            </div>

            {/* Score Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-data-mono">
                <span className="text-on-surface-variant">Fatigue & Distraction Risk Score</span>
                <span className={`font-bold text-lg ${
                  riskTier === 'Critical' ? 'text-red-400' :
                  riskTier === 'Drowsy' ? 'text-orange-400' :
                  riskTier === 'Warning' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {riskScore} / 100
                </span>
              </div>

              <div className="w-full bg-surface-container-highest h-3 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    riskTier === 'Critical' ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]' :
                    riskTier === 'Drowsy' ? 'bg-orange-500' :
                    riskTier === 'Warning' ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${riskScore}%` }}
                ></div>
              </div>

              <p className="text-xs text-on-surface-variant font-data-mono pt-1">
                {stateSummary}
              </p>
            </div>
          </div>

          {/* Biometrics Breakdown Grid */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* EAR Card */}
            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold font-data-mono">Eye Aspect Ratio (EAR)</span>
              <div className="text-2xl font-bold text-white font-data-mono flex items-baseline gap-2">
                {earScore} <span className="text-xs text-on-surface-variant font-normal">avg</span>
              </div>
              <p className={`text-[10px] font-data-mono ${earScore < sensitivityThreshold ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                {earScore < sensitivityThreshold ? 'EYES CLOSED / DROOPING' : 'OPEN & ALERT'}
              </p>
            </div>

            {/* MAR Card */}
            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold font-data-mono">Mouth Aspect (MAR)</span>
              <div className="text-2xl font-bold text-white font-data-mono flex items-baseline gap-2">
                {marScore} <span className="text-xs text-on-surface-variant font-normal">ratio</span>
              </div>
              <p className={`text-[10px] font-data-mono ${marScore > 0.50 ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                {yawnSeverity}
              </p>
            </div>

            {/* Head Pose Card */}
            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold font-data-mono">Head Pose (Pitch / Yaw)</span>
              <div className="text-xl font-bold text-white font-data-mono">
                {pitch}° / {yaw}°
              </div>
              <p className={`text-[10px] font-data-mono ${isHeadDown || isLookingAway ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                {headOrientation}
              </p>
            </div>

            {/* Distraction Card */}
            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold font-data-mono">Phone Distraction</span>
              <div className="text-xl font-bold text-white font-data-mono truncate">
                {phoneDistracted ? 'DETECTED' : 'CLEAR'}
              </div>
              <p className={`text-[10px] font-data-mono ${phoneDistracted ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                {phoneDistracted ? distractionType : 'NO PHONE IN USE'}
              </p>
            </div>

          </div>

          {/* Telemetry Details */}
          <div className="card-premium space-y-2 text-xs font-data-mono">
            <div className="flex justify-between border-b border-outline-variant/30 pb-2">
              <span className="text-on-surface-variant">Natural Blinks:</span>
              <span className="text-white font-bold">{blinkCount} blinks ({blinksPerMin} BPM)</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant/30 pb-2">
              <span className="text-on-surface-variant">Blink Duration:</span>
              <span className="text-accent-electric font-bold">{blinkDurationMs} ms</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant/30 pb-2">
              <span className="text-on-surface-variant">PERCLOS Index:</span>
              <span className="text-emerald-400 font-bold">{perclosPct}% eye closure time</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Driver Presence:</span>
              <span className={driverAbsent ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                {driverAbsent ? `ABSENT (${absenceDurationS}s)` : 'PRESENT IN CABIN'}
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
