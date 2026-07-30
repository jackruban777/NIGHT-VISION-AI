import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Video,
  Upload,
  Eye,
  Volume2,
  ShieldAlert,
  Cpu,
  CheckCircle,
  MapPin,
  Maximize,
  Power,
  Bug,
  Terminal,
  Box,
  AlertTriangle,
  Radio,
  Zap,
  Activity,
  Navigation,
  Layers,
  Sparkles,
  Crosshair,
  Wifi,
  CloudRain
} from 'lucide-react';
import { voiceAlerts } from '../services/voiceAlerts';
import { apiService, DetectionResult } from '../services/api';

interface DetectedObject {
  id: string;
  trackId: number | string;
  class: string;
  confidence: number;
  x: number; // percentage 0-100
  y: number;
  w: number;
  h: number;
  distance: number; // meters
  speed: number; // km/h relative
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface FloatingAlert {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  level: 'critical' | 'warning' | 'info';
  timestamp: string;
}

const SAMPLE_VIDEOS = [
  { id: 'v1', name: 'Urban Highway (Night)', url: 'https://assets.mixkit.co/videos/preview/mixkit-driving-on-a-highway-at-night-42861-large.mp4' },
  { id: 'v2', name: 'City Street & Pedestrians', url: 'https://assets.mixkit.co/videos/preview/mixkit-car-driving-through-a-city-street-at-night-41551-large.mp4' },
];

export const LiveCamera: React.FC = () => {
  const [sourceType, setSourceType] = useState<'video' | 'webcam' | 'upload' | 'mobile'>(
    (localStorage.getItem('nv_preferred_camera_source') as any) || 'video'
  );
  const [selectedVideo, setSelectedVideo] = useState(SAMPLE_VIDEOS[0].url);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [nightEnhance, setNightEnhance] = useState(true);
  const [nightVisionMode, setNightVisionMode] = useState<'Auto' | 'Day' | 'Evening' | 'Night' | 'Extreme Dark'>(
    (localStorage.getItem('nv_night_vision_mode') as any) || 'Auto'
  );
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [zeroReason, setZeroReason] = useState<string>('');
  
  const [nightVisionTelemetry, setNightVisionTelemetry] = useState({
    model: 'Zero-DCE++ (Deep Curve AI)',
    mode: 'Auto (Night)',
    luminance: 42.5,
    enhancementMs: 8.2,
    detectionFps: 32.0,
  });
  const [fps, setFps] = useState(30);
  const [backendConnected, setBackendConnected] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [floatingAlerts, setFloatingAlerts] = useState<FloatingAlert[]>([]);
  const [modelName, setModelName] = useState<string>('YOLO12 Nano (ByteTrack)');
  const [inferenceMs, setInferenceMs] = useState<number>(24.5);
  const [trackingMs, setTrackingMs] = useState<number>(1.2);
  const [aiFps, setAiFps] = useState<number>(25.0);
  const [cameraFps, setCameraFps] = useState<number>(60);
  const [hardwareDevice, setHardwareDevice] = useState<string>('CPU');
  const [resolution, setResolution] = useState<string>('640x480');
  
  // Camera & Trip Setup State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [activeTrip, setActiveTrip] = useState<{ start: string; end: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraContainerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Track motion history (last 30 frames per track ID)
  const motionHistoryRef = useRef<Map<string | number, { x: number; y: number }[]>>(new Map());

  const addDebugLog = (msg: string) => {
    const timeStr = new Date().toLocaleTimeString();
    const line = `[${timeStr}] ${msg}`;
    setDebugLogs((prev) => [line, ...prev.slice(0, 49)]);
  };

  const addFloatingAlert = (title: string, subtitle: string, icon: string, level: 'critical' | 'warning' | 'info') => {
    const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timeStr = new Date().toLocaleTimeString();
    const newAlert: FloatingAlert = { id: alertId, title, subtitle, icon, level, timestamp: timeStr };

    setFloatingAlerts((prev) => [newAlert, ...prev.slice(0, 4)]);

    // Auto-remove alert after 4.5s
    setTimeout(() => {
      setFloatingAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }, 4500);
  };

  const toggleFullscreen = () => {
    if (!cameraContainerRef.current) return;
    if (!document.fullscreenElement) {
      if (cameraContainerRef.current.requestFullscreen) {
        cameraContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleTurnOnCameraRequest = () => {
    setShowRouteModal(true);
  };

  const handleTurnOffCamera = () => {
    setIsCameraActive(false);
    setDetectedObjects([]);
    motionHistoryRef.current.clear();
    addDebugLog('Camera Stopped');
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  // Initialize Video / Webcam
  useEffect(() => {
    if (!isCameraActive) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      return;
    }

    addDebugLog(`Camera Stream Active (${sourceType})`);

    if (sourceType === 'webcam') {
      navigator.mediaDevices
        .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => addDebugLog(`Webcam play error: ${e}`));
          }
        })
        .catch((err) => {
          addDebugLog(`Webcam permission notice: ${err}. Falling back to demo stream`);
          setSourceType('video');
        });
    } else if (sourceType === 'upload' && customVideoUrl) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = customVideoUrl;
        videoRef.current.play().catch(e => addDebugLog(`Video play error: ${e}`));
      }
    } else {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = selectedVideo;
        videoRef.current.play().catch(e => addDebugLog(`Sample video play error: ${e}`));
      }
    }
  }, [isCameraActive, sourceType, selectedVideo, customVideoUrl]);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setSourceType('upload');
      if (!isCameraActive) {
        setShowRouteModal(true);
      }
    }
  };

  // Draw Motion Trails on Canvas Overlay
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !isCameraActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = cameraContainerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update history for current detected objects
    const currentTrackIds = new Set<string | number>();

    detectedObjects.forEach((obj) => {
      currentTrackIds.add(obj.trackId);
      const px = (obj.x + obj.w / 2) * (canvas.width / 100);
      const py = (obj.y + obj.h / 2) * (canvas.height / 100);

      const history = motionHistoryRef.current.get(obj.trackId) || [];
      history.push({ x: px, y: py });
      if (history.length > 30) history.shift();
      motionHistoryRef.current.set(obj.trackId, history);

      // Draw Motion Trail Lines
      if (history.length > 1) {
        ctx.beginPath();
        ctx.moveTo(history[0].x, history[0].y);
        for (let i = 1; i < history.length; i++) {
          ctx.lineTo(history[i].x, history[i].y);
        }

        const trailColor =
          obj.risk === 'Critical' ? 'rgba(239, 68, 68, ' : obj.risk === 'High' ? 'rgba(249, 115, 22, ' : 'rgba(0, 229, 255, ';

        const gradient = ctx.createLinearGradient(
          history[0].x,
          history[0].y,
          history[history.length - 1].x,
          history[history.length - 1].y
        );
        gradient.addColorStop(0, trailColor + '0.05)');
        gradient.addColorStop(1, trailColor + '0.8)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = obj.risk === 'Critical' ? '#EF4444' : '#00E5FF';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });

    // Prune stale track histories
    for (const trackId of motionHistoryRef.current.keys()) {
      if (!currentTrackIds.has(trackId)) {
        motionHistoryRef.current.delete(trackId);
      }
    }
  }, [detectedObjects, isCameraActive]);

  // Continuous High-Speed Real-Time Asynchronous AI Frame Processing Loop (~35ms = 25+ FPS)
  useEffect(() => {
    if (!isCameraActive) return;

    let isMounted = true;
    let isProcessing = false;
    let loopTimeout: number;

    const processFrameLoop = async () => {
      if (!isMounted) return;

      if (!isProcessing && videoRef.current && videoRef.current.readyState >= 2) {
        const vWidth = videoRef.current.videoWidth || 640;
        const vHeight = videoRef.current.videoHeight || 360;

        if (vWidth > 0 && vHeight > 0) {
          isProcessing = true;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = vWidth;
            canvas.height = vHeight;
            const ctx = canvas.getContext('2d');

            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              addDebugLog(`Frame Captured: ${vWidth}x${vHeight}`);

              const blob: Blob | null = await new Promise((resolve) => {
                try {
                  canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
                } catch (e_canvas) {
                  addDebugLog(`Canvas export error: ${e_canvas}`);
                  resolve(null);
                }
              });

              if (blob) {
                addDebugLog('Frame Sent to Backend Detection Service');
                const res: DetectionResult | null = await apiService.analyzeFrame(blob, nightEnhance, nightVisionMode);

                if (res && isMounted) {
                  setBackendConnected(true);
                  if (res.fps) setFps(res.fps);
                  if (res.camera_fps) setCameraFps(res.camera_fps);
                  if (res.ai_fps) setAiFps(res.ai_fps);
                  if (res.model_name) setModelName(res.model_name);
                  if (res.inference_time_ms !== undefined) setInferenceMs(res.inference_time_ms);
                  if (res.tracking_time_ms !== undefined) setTrackingMs(res.tracking_time_ms);
                  if (res.device) setHardwareDevice(res.device);
                  if (res.resolution) setResolution(res.resolution);
                  if (res.zero_detections_reason) setZeroReason(res.zero_detections_reason);

                  if (res.night_vision) {
                    setNightVisionTelemetry({
                      model: res.night_vision.enhancement_model,
                      mode: res.night_vision.mode,
                      luminance: res.night_vision.luminance,
                      enhancementMs: res.night_vision.enhancement_ms,
                      detectionFps: res.night_vision.detection_fps,
                    });
                  }

                  const rawDets = res.detections || [];
                  addDebugLog(`YOLO ByteTrack Finished: ${rawDets.length} Objects Found`);

                  if (rawDets.length > 0) {
                    const mapped: DetectedObject[] = rawDets.map((d, index) => {
                      const riskLevel = (d.risk?.risk_level as any) || 'Low';
                      return {
                        id: d.id || `det_${index + 1}`,
                        trackId: d.track_id !== null && d.track_id !== undefined ? d.track_id : index + 1,
                        class: d.class,
                        confidence: d.confidence,
                        x: Number(((d.bbox[0] / vWidth) * 100).toFixed(1)),
                        y: Number(((d.bbox[1] / vHeight) * 100).toFixed(1)),
                        w: Number(((d.bbox[2] / vWidth) * 100).toFixed(1)),
                        h: Number(((d.bbox[3] / vHeight) * 100).toFixed(1)),
                        distance: d.distance_m,
                        speed: d.class === 'Pedestrian' || d.class === 'Person' ? 4 : 65,
                        risk: riskLevel,
                      };
                    });

                    // Sort automatically by collision risk (Critical > High > Medium > Low)
                    const sorted = [...mapped].sort((a, b) => {
                      const priority = { Critical: 4, High: 3, Medium: 2, Low: 1 };
                      return priority[b.risk] - priority[a.risk];
                    });

                    setDetectedObjects(sorted);
                    addDebugLog(`Surveillance Overlays Rendered (${sorted.length} targets tracked)`);

                    // Spoken Voice Alerts & Floating Toast Notifications
                    sorted.forEach((obj) => {
                      const result = voiceAlerts.evaluateHazard(obj.id, obj.class, obj.distance, obj.confidence);
                      if (result.alertTriggered && result.message) {
                        const icon =
                          obj.class === 'Person' || obj.class === 'Pedestrian'
                            ? '🚶'
                            : obj.class === 'Car' || obj.class === 'Truck'
                            ? '🚗'
                            : obj.class === 'Dog' || obj.class === 'Cat' || obj.class === 'Cow'
                            ? '🐕'
                            : '⚠️';

                        addFloatingAlert(
                          result.isEmergency ? '🚨 COLLISION HAZARD' : `⚠️ ${obj.class.toUpperCase()} AHEAD`,
                          result.message,
                          icon,
                          result.isEmergency ? 'critical' : 'warning'
                        );
                      }
                    });
                  } else {
                    setDetectedObjects([]);
                    if (res.zero_detections_reason) {
                      addDebugLog(`Zero detections: ${res.zero_detections_reason}`);
                    }
                  }
                }
              }
            }
          } catch (err) {
            addDebugLog(`Frame processing exception: ${err}`);
          } finally {
            isProcessing = false;
          }
        }
      }

      if (isMounted && isCameraActive) {
        loopTimeout = window.setTimeout(processFrameLoop, 35);
      }
    };

    processFrameLoop();

    return () => {
      isMounted = false;
      clearTimeout(loopTimeout);
    };
  }, [isCameraActive, nightEnhance, nightVisionMode]);

  // Overall highest risk level calculation
  const highestRisk = detectedObjects.some((o) => o.risk === 'Critical')
    ? 'CRITICAL'
    : detectedObjects.some((o) => o.risk === 'High')
    ? 'HIGH'
    : detectedObjects.some((o) => o.risk === 'Medium')
    ? 'MEDIUM'
    : 'SAFE';

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5 font-sans">
      
      {/* 1. TOP SURVEILLANCE INFORMATIONAL HEADER BAR */}
      <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-dark/90 border-2 border-accent-electric/40 backdrop-blur-xl shadow-[0_0_30px_rgba(0,229,255,0.15)]">
        
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-accent-electric/15 border border-accent-electric/40 flex items-center justify-center text-accent-electric shadow-[0_0_15px_rgba(0,229,255,0.3)]">
            <Radio className="w-6 h-6 animate-pulse text-accent-electric" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold uppercase tracking-wider text-white font-data-mono">
                ADAS Tactical AI Surveillance Suite
              </h1>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[10px] font-data-mono font-bold flex items-center gap-1 uppercase">
                <Wifi className="w-3 h-3 text-emerald-400 animate-ping" /> Real-Time Engine Active
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-data-mono flex items-center gap-3 mt-0.5">
              <span>Model: <strong className="text-accent-electric">{modelName}</strong></span>
              <span>•</span>
              <span>Device: <strong className="text-emerald-400">{hardwareDevice} ({resolution})</strong></span>
              <span>•</span>
              <span>Latency: <strong className="text-amber-300">{inferenceMs} ms</strong></span>
            </p>
          </div>
        </div>

        {/* Dynamic Telemetry Metric Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-data-mono">
          <div className="px-3 py-1.5 bg-surface-container border border-outline-variant/60 rounded-xl flex items-center gap-2">
            <span className="text-[10px] text-on-surface-variant uppercase">Cam FPS</span>
            <strong className="text-emerald-400 text-sm">{isCameraActive ? cameraFps : 0}</strong>
          </div>
          <div className="px-3 py-1.5 bg-surface-container border border-outline-variant/60 rounded-xl flex items-center gap-2">
            <span className="text-[10px] text-on-surface-variant uppercase">Detection FPS</span>
            <strong className="text-accent-electric text-sm">{isCameraActive ? aiFps : 0}</strong>
          </div>
          <div className="px-3 py-1.5 bg-surface-container border border-outline-variant/60 rounded-xl flex items-center gap-2">
            <span className="text-[10px] text-on-surface-variant uppercase">Targets</span>
            <strong className="text-white text-sm">{isCameraActive ? detectedObjects.length : 0}</strong>
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-data-mono flex items-center gap-1.5 uppercase ${
              highestRisk === 'CRITICAL'
                ? 'bg-red-500/20 text-red-400 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse'
                : highestRisk === 'HIGH'
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/60'
                : highestRisk === 'MEDIUM'
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/60'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>RISK: {highestRisk}</span>
          </div>

          {/* Master Turn On/Off Live Cam Button */}
          <button
            onClick={() => {
              if (isCameraActive) {
                handleTurnOffCamera();
              } else {
                handleTurnOnCameraRequest();
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-label-caps uppercase border transition-all flex items-center gap-2 font-bold ${
              isCameraActive
                ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                : 'bg-accent-electric text-black border-accent-electric hover:opacity-90 shadow-[0_0_20px_rgba(0,229,255,0.4)]'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isCameraActive ? 'Turn Off Cam' : 'Turn On Cam'}</span>
          </button>
        </div>

      </div>

      {/* Control Configuration Strip */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-surface-container p-2.5 rounded-2xl border border-outline-variant/60 text-xs font-data-mono">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Input Stream:</span>
          {(['video', 'webcam', 'mobile'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSourceType(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all ${
                sourceType === mode ? 'bg-accent-electric text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.3)]' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
          <label className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all cursor-pointer flex items-center gap-1 ${
            sourceType === 'upload' ? 'bg-accent-electric text-black font-bold' : 'text-on-surface-variant hover:text-white'
          }`}>
            <Upload className="w-3.5 h-3.5" /> Upload File
            <input type="file" accept="video/*,image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-surface-container-dark p-1 rounded-xl border border-outline-variant">
            <span className="text-[10px] font-label-caps text-on-surface-variant px-2 uppercase font-bold">AI Night Mode:</span>
            {(['Auto', 'Day', 'Evening', 'Night', 'Extreme Dark'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setNightVisionMode(mode);
                  localStorage.setItem('nv_night_vision_mode', mode);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-label-caps uppercase transition-all ${
                  nightVisionMode === mode
                    ? 'bg-accent-electric text-black font-bold'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsDebugMode(!isDebugMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-label-caps uppercase border transition-all flex items-center gap-1 font-bold ${
              isDebugMode ? 'bg-amber-400 text-black border-amber-400' : 'bg-surface-container-dark text-on-surface-variant border-outline-variant'
            }`}
          >
            <Bug className="w-4 h-4" /> Debug HUD {isDebugMode ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-xl text-xs font-label-caps uppercase border bg-surface-container-dark text-on-surface-variant hover:text-white border-outline-variant flex items-center gap-1 transition-all"
          >
            <Maximize className="w-4 h-4 text-accent-electric" /> {isFullscreen ? 'Exit' : 'Full Screen'}
          </button>
        </div>
      </div>

      {/* Main Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* MAIN VIDEO SCREEN & SURVEILLANCE OVERLAYS (Col 8) */}
        <div ref={cameraContainerRef} className="lg:col-span-8 card-premium !p-0 relative overflow-hidden border-2 border-accent-electric/40 min-h-[460px] md:min-h-[540px] bg-black shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          
          <video
            ref={videoRef}
            loop
            muted
            playsInline
            crossOrigin="anonymous"
            className={`w-full h-full object-cover transition-all duration-300 ${
              nightEnhance ? 'contrast-125 brightness-110 saturate-150 grayscale-[15%]' : ''
            }`}
          />

          {/* Canvas Layer for Motion Trails & Line Overlays */}
          <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-none z-10 w-full h-full" />

          {/* Standby Screen when Live Cam is OFF */}
          {!isCameraActive && (
            <div className="absolute inset-0 bg-surface-container-dark/95 flex flex-col items-center justify-center p-6 text-center z-30 space-y-5 backdrop-blur-md">
              <div className="w-20 h-20 rounded-3xl bg-accent-electric/10 border-2 border-accent-electric/40 flex items-center justify-center text-accent-electric shadow-[0_0_30px_rgba(0,229,255,0.3)]">
                <Crosshair className="w-10 h-10 animate-spin text-accent-electric" />
              </div>
              
              <div className="space-y-2 max-w-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full border border-outline-variant">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="font-label-caps text-[10px] text-amber-300 uppercase tracking-widest font-bold">TACTICAL SURVEILLANCE STANDBY</span>
                </div>
                <h3 className="text-2xl font-bold text-white uppercase tracking-wide">Live Stream Ready</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Turn on the live stream to initialize real-time YOLO12 object detection, ByteTrack motion trails, tactical radar, and spoken hazard alerts.
                </p>
              </div>

              <button
                onClick={handleTurnOnCameraRequest}
                className="px-8 py-4 bg-accent-electric hover:bg-accent-electric/90 text-black font-bold rounded-xl font-label-caps text-xs uppercase tracking-widest transition-all shadow-[0_0_25px_rgba(0,229,255,0.4)] hover:scale-105 active:scale-95 flex items-center gap-3"
              >
                <Video className="w-5 h-5" />
                <span>Initialize Live Vision Stream</span>
              </button>
            </div>
          )}

          {/* HUD Target Crosshair Center Overlay */}
          <div className="absolute inset-0 hud-scanline opacity-20 pointer-events-none"></div>

          {/* PROFESSIONAL SURVEILLANCE BOUNDING BOXES OVERLAY */}
          {isCameraActive && detectedObjects.map((obj) => {
            const riskColor =
              obj.risk === 'Critical'
                ? { border: 'border-red-500', bg: 'bg-red-500/15', labelBg: 'bg-red-600', text: 'text-red-400', shadow: 'shadow-[0_0_25px_rgba(239,68,68,0.7)]' }
                : obj.risk === 'High'
                ? { border: 'border-orange-500', bg: 'bg-orange-500/15', labelBg: 'bg-orange-500', text: 'text-orange-400', shadow: 'shadow-[0_0_20px_rgba(249,115,22,0.6)]' }
                : obj.risk === 'Medium'
                ? { border: 'border-amber-400', bg: 'bg-amber-400/15', labelBg: 'bg-amber-400', text: 'text-amber-300', shadow: 'shadow-[0_0_15px_rgba(251,191,36,0.5)]' }
                : { border: 'border-emerald-400', bg: 'bg-emerald-400/15', labelBg: 'bg-emerald-500', text: 'text-emerald-400', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]' };

            return (
              <div
                key={obj.id}
                className={`absolute border-2 transition-all duration-150 pointer-events-none rounded-sm ${riskColor.border} ${riskColor.bg} ${riskColor.shadow}`}
                style={{
                  left: `${obj.x}%`,
                  top: `${obj.y}%`,
                  width: `${obj.w}%`,
                  height: `${obj.h}%`,
                }}
              >
                {/* Surveillance Corner Bracket Reticles */}
                <div className={`absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 ${riskColor.border}`}></div>
                <div className={`absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 ${riskColor.border}`}></div>
                <div className={`absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 ${riskColor.border}`}></div>
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 ${riskColor.border}`}></div>

                {/* Primary Object Header Label: Class | ID:XX | XX% | X.X m */}
                <div
                  className={`absolute -top-7 left-0 px-2.5 py-0.5 text-[10px] font-data-mono font-bold rounded-md flex items-center gap-1.5 uppercase tracking-wider text-black shadow-lg backdrop-blur-md whitespace-nowrap ${riskColor.labelBg}`}
                >
                  <span>{obj.class}</span>
                  <span className="opacity-75">|</span>
                  <span>ID:{obj.trackId}</span>
                  <span className="opacity-75">|</span>
                  <span>{Math.round(obj.confidence * 100)}%</span>
                  <span className="opacity-75">|</span>
                  <span>{obj.distance} m</span>
                </div>

                {/* Bottom Distance Tag Below Box */}
                <div
                  className={`absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px] font-data-mono font-bold rounded bg-black/85 text-white border border-white/20 shadow-md whitespace-nowrap`}
                >
                  📏 {obj.distance} m
                </div>
              </div>
            );
          })}

          {/* Floating "No Objects Detected" HUD Pill */}
          {isCameraActive && detectedObjects.length === 0 && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/85 border border-amber-400/60 rounded-full text-xs font-data-mono text-amber-300 font-bold z-20 backdrop-blur-md shadow-xl flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
              <span>No objects detected in frame.</span>
            </div>
          )}

          {/* FLOATING LIVE ALERT TOAST STACK (Top-Right) */}
          <div className="absolute top-16 right-4 z-30 space-y-2 pointer-events-none max-w-xs">
            {floatingAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-2xl border-2 backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-right flex items-center gap-3 ${
                  alert.level === 'critical'
                    ? 'bg-red-950/90 border-red-500 text-red-200 shadow-[0_0_25px_rgba(239,68,68,0.5)]'
                    : 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                }`}
              >
                <span className="text-2xl">{alert.icon}</span>
                <div className="flex-1 space-y-0.5">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase font-data-mono tracking-wide">{alert.title}</h4>
                    <span className="text-[9px] opacity-75 font-data-mono">{alert.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-white/90 leading-tight">{alert.subtitle}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Visual Debug Mode Overlay HUD */}
          {isDebugMode && (
            <div className="absolute inset-x-4 bottom-4 bg-black/90 border-2 border-amber-400/80 rounded-2xl p-4 z-40 text-amber-300 font-data-mono text-xs space-y-3 backdrop-blur-md shadow-[0_0_30px_rgba(251,191,36,0.25)]">
              <div className="flex justify-between items-center border-b border-amber-400/40 pb-2">
                <span className="font-bold flex items-center gap-2 text-white">
                  <Bug className="w-4 h-4 text-amber-400" /> VISUAL DEBUG HUD (SURVEILLANCE TELEMETRY)
                </span>
                <span className="text-[10px] bg-amber-400 text-black font-bold px-2 py-0.5 rounded">DEBUG ACTIVE</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                <div className="bg-surface-container p-2 rounded-xl border border-amber-400/30">
                  <span className="text-[9px] text-on-surface-variant block uppercase">Camera FPS</span>
                  <span className="text-emerald-400 font-bold text-sm">{cameraFps} FPS</span>
                </div>
                <div className="bg-surface-container p-2 rounded-xl border border-amber-400/30">
                  <span className="text-[9px] text-on-surface-variant block uppercase">Detection FPS</span>
                  <span className="text-emerald-400 font-bold text-sm">{aiFps} FPS</span>
                </div>
                <div className="bg-surface-container p-2 rounded-xl border border-amber-400/30">
                  <span className="text-[9px] text-on-surface-variant block uppercase">Inference Time</span>
                  <span className="text-accent-electric font-bold text-sm">{inferenceMs} ms</span>
                </div>
                <div className="bg-surface-container p-2 rounded-xl border border-amber-400/30">
                  <span className="text-[9px] text-on-surface-variant block uppercase">Active Targets</span>
                  <span className="text-white font-bold text-sm">{detectedObjects.length} Targets</span>
                </div>
              </div>

              <div className="bg-surface-container-dark p-2 rounded-xl border border-amber-400/20 max-h-24 overflow-y-auto text-[10px] font-mono text-emerald-400">
                {debugLogs.map((log, idx) => <div key={idx}>{log}</div>)}
              </div>
            </div>
          )}

        </div>

        {/* SIDE PANELS: MINIMAP RADAR, AUTO-SORTED OBJECT MATRIX & TELEMETRY (Col 4) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* TACTICAL MINIMAP RADAR WIDGET */}
          <div className="card-premium space-y-3 border-2 border-accent-electric/40 bg-surface-container-dark/95">
            <div className="flex justify-between items-center border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-accent-electric animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-data-mono">Tactical Radar Minimap</h3>
              </div>
              <span className="text-[10px] font-data-mono text-accent-electric font-bold">50m RADIAL SCAN</span>
            </div>

            {/* Radar Circular Sweep Visualization */}
            <div className="relative w-full aspect-square max-w-[220px] mx-auto rounded-full bg-black/90 border-2 border-accent-electric/40 overflow-hidden shadow-[0_0_25px_rgba(0,229,255,0.2)] flex items-center justify-center">
              
              {/* Radar Rings */}
              <div className="absolute inset-4 rounded-full border border-accent-electric/20"></div>
              <div className="absolute inset-12 rounded-full border border-accent-electric/25"></div>
              <div className="absolute inset-20 rounded-full border border-accent-electric/30"></div>
              
              {/* Radar Crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-[1px] bg-accent-electric/25"></div>
                <div className="h-full w-[1px] bg-accent-electric/25"></div>
              </div>

              {/* Ego Vehicle Centered at Bottom */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-accent-electric rounded-sm shadow-[0_0_10px_#00E5FF] flex items-center justify-center">
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-black"></div>
              </div>

              {/* Plot Detected Objects Radially */}
              {isCameraActive && detectedObjects.map((obj) => {
                // Convert distance (0-50m) and horizontal X offset (0-100%) to radar (x, y) coordinates
                const normalizedDist = Math.min(1.0, obj.distance / 50.0);
                const rRadius = normalizedDist * 85; // pixels from center bottom
                const angleRad = ((obj.x - 50) / 50) * (Math.PI / 4); // -45 deg to +45 deg sweep

                const rx = 110 + rRadius * Math.sin(angleRad);
                const ry = 190 - rRadius * Math.cos(angleRad);

                const blipColor =
                  obj.risk === 'Critical' ? 'bg-red-500 shadow-[0_0_12px_#EF4444] animate-ping' : obj.risk === 'High' ? 'bg-orange-500 shadow-[0_0_10px_#F97316]' : 'bg-accent-electric shadow-[0_0_8px_#00E5FF]';

                return (
                  <div
                    key={obj.id}
                    className={`absolute w-3 h-3 rounded-full ${blipColor} transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[7px] font-bold text-black`}
                    style={{ left: `${rx}px`, top: `${ry}px` }}
                    title={`${obj.class} (ID:${obj.trackId}) - ${obj.distance}m`}
                  >
                    {obj.trackId}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AUTO-SORTED OBJECT LIST PANEL (TARGET MATRIX) */}
          <div className="card-premium space-y-3 border border-outline-variant">
            <div className="flex justify-between items-center border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-accent-electric" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-data-mono">Active Target Matrix</h3>
              </div>
              <span className="text-[10px] font-data-mono text-on-surface-variant">{isCameraActive ? detectedObjects.length : 0} Sorted By Risk</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {!isCameraActive ? (
                <div className="text-xs text-on-surface-variant italic text-center py-6 border border-dashed border-outline-variant/50 rounded-xl">
                  Turn on live vision stream to track target objects.
                </div>
              ) : detectedObjects.length === 0 ? (
                <div className="text-xs text-on-surface-variant text-center py-4 border border-dashed border-outline-variant/40 rounded-xl">
                  No objects currently detected.
                </div>
              ) : (
                detectedObjects.map((obj) => (
                  <div key={obj.id} className="p-2.5 bg-surface-container rounded-xl border border-outline-variant/50 flex justify-between items-center text-xs font-data-mono">
                    <div className="space-y-0.5">
                      <div className="font-bold text-white uppercase flex items-center gap-1.5">
                        <span>ID:{obj.trackId}</span>
                        <span className="text-accent-electric">{obj.class}</span>
                      </div>
                      <div className="text-[10px] text-on-surface-variant">
                        Dist: <strong className="text-white">{obj.distance}m</strong> | Conf: <strong className="text-emerald-400">{Math.round(obj.confidence * 100)}%</strong>
                      </div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                          obj.risk === 'Critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                            : obj.risk === 'High'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                            : obj.risk === 'Medium'
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        }`}
                      >
                        {obj.risk}
                      </span>
                      <div className="text-[10px] text-on-surface-variant">{obj.speed} km/h</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI NIGHT VISION TELEMETRY CARD */}
          <div className="card-premium space-y-3 border border-accent-electric/30">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-accent-electric animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Night Enhancement Telemetry</h3>
              </div>
              <span className="text-[9px] font-data-mono text-emerald-400 font-bold">ZERO-DCE++ ACTIVE</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-data-mono">
              <div className="bg-surface-container p-2 rounded-xl border border-outline-variant/40">
                <span className="text-[9px] text-on-surface-variant block uppercase">Engine</span>
                <span className="text-accent-electric font-bold text-[11px]">{nightVisionTelemetry.model}</span>
              </div>
              <div className="bg-surface-container p-2 rounded-xl border border-outline-variant/40">
                <span className="text-[9px] text-on-surface-variant block uppercase">Luminance</span>
                <span className="text-white font-bold text-[11px]">{nightVisionTelemetry.luminance} cd/m²</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 2. BOTTOM SURVEILLANCE STATUS BAR */}
      <div className="bg-surface-container-dark/95 border-2 border-outline-variant/60 rounded-2xl p-3.5 flex flex-wrap justify-between items-center gap-4 text-xs font-data-mono text-on-surface-variant shadow-xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-white">
            <Camera className="w-4 h-4 text-accent-electric" />
            <span>Resolution: <strong className="text-accent-electric">{resolution}</strong></span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5 text-white">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>ByteTrack Status: <strong className="text-emerald-400">ACTIVE</strong></span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5 text-white">
            <Eye className="w-4 h-4 text-accent-electric" />
            <span>Night Enhancement: <strong className="text-accent-electric">{nightVisionMode} Mode</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-white">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>Audio Warnings: <strong className="text-amber-300">SPEECH ENABLED</strong></span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5 text-white">
            <CloudRain className="w-4 h-4 text-accent-electric" />
            <span>Weather Mode: <strong className="text-accent-electric">Clear Night</strong></span>
          </div>
        </div>
      </div>

      {/* Trip Route Setup Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-md card-premium border-2 border-accent-electric/50 p-6 space-y-5 shadow-[0_0_40px_rgba(0,229,255,0.25)]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent-electric/10 border border-accent-electric/40 flex items-center justify-center text-accent-electric">
                <MapPin className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wide">Set Route Details</h3>
                <p className="text-xs text-on-surface-variant">Enter starting and destination points for this live trip</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider block">Starting Location</label>
                <input
                  type="text"
                  placeholder="e.g., Highway 101 North"
                  value={startPoint}
                  onChange={(e) => setStartPoint(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant rounded-xl py-2.5 px-3.5 text-xs text-white focus:outline-none focus:border-accent-electric font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider block">Destination Location</label>
                <input
                  type="text"
                  placeholder="e.g., Bay Area Expressway"
                  value={endPoint}
                  onChange={(e) => setEndPoint(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant rounded-xl py-2.5 px-3.5 text-xs text-white focus:outline-none focus:border-accent-electric font-sans"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  if (startPoint && endPoint) {
                    setActiveTrip({ start: startPoint, end: endPoint });
                  }
                  setShowRouteModal(false);
                  setIsCameraActive(true);
                }}
                className="flex-1 py-3 bg-accent-electric hover:bg-accent-electric/90 text-black font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)]"
              >
                Start Live Trip & Cam
              </button>
              <button
                onClick={() => {
                  setShowRouteModal(false);
                  setIsCameraActive(true);
                }}
                className="px-5 py-3 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-white font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all"
              >
                Skip Route
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
