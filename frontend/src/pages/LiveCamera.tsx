import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Video,
  Upload,
  Eye,
  RefreshCw,
  Volume2,
  ShieldAlert,
  Cpu,
  CheckCircle,
  MapPin,
  Maximize,
  Power,
  Bug,
  Activity,
  Layers,
  Terminal,
  Clock,
  Box,
  AlertCircle
} from 'lucide-react';
import { voiceAlerts } from '../services/voiceAlerts';
import { apiService, DetectionResult } from '../services/api';

interface DetectedObject {
  id: string;
  trackId: number | string;
  class: string;
  confidence: number;
  x: number; // percentage
  y: number;
  w: number;
  h: number;
  distance: number; // meters
  speed: number; // km/h relative
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
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
  const [cameraViewMode, setCameraViewMode] = useState<'enhanced' | 'original' | 'split'>('enhanced');
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
  const [alertLog, setAlertLog] = useState<{ id: string; text: string; time: string; level: string }[]>([]);
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

  const addDebugLog = (msg: string) => {
    const timeStr = new Date().toLocaleTimeString();
    const line = `[${timeStr}] ${msg}`;
    setDebugLogs((prev) => [line, ...prev.slice(0, 49)]);
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

  // Turn on Live Cam handler
  const handleTurnOnCameraRequest = () => {
    setShowRouteModal(true);
  };

  // Turn off Live Cam
  const handleTurnOffCamera = () => {
    setIsCameraActive(false);
    setDetectedObjects([]);
    addDebugLog('Camera Stopped');
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  // Initialize Video or Webcam input based on isCameraActive state
  useEffect(() => {
    if (!isCameraActive) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      return;
    }

    addDebugLog(`Camera Started (${sourceType})`);

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
          addDebugLog(`Webcam permission error: ${err}. Falling back to sample video`);
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

  // File Upload Handler for Custom Videos / Images
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

  // Continuous High-Speed Real-Time Asynchronous AI Frame Processing Loop (~40ms loop = 20-30 FPS target)
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
                    const mapped: DetectedObject[] = rawDets.map((d, index) => ({
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
                      risk: (d.risk?.risk_level as any) || 'Low',
                    }));
                    setDetectedObjects(mapped);
                    addDebugLog(`Bounding Boxes Rendered (${mapped.length} boxes active)`);

                    mapped.forEach((obj) => {
                      const result = voiceAlerts.evaluateHazard(obj.id, obj.class, obj.distance, obj.confidence);
                      if (result.alertTriggered && result.message) {
                        const timeStr = new Date().toLocaleTimeString();
                        setAlertLog((prev) => [
                          {
                            id: `alt_${Date.now()}_${obj.id}`,
                            text: result.message,
                            time: timeStr,
                            level: result.isEmergency ? 'critical' : result.zone,
                          },
                          ...prev.slice(0, 9),
                        ]);
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
        loopTimeout = window.setTimeout(processFrameLoop, 35); // Continuous ~25 FPS loop
      }
    };

    processFrameLoop();

    return () => {
      isMounted = false;
      clearTimeout(loopTimeout);
    };
  }, [isCameraActive, nightEnhance, nightVisionMode]);

  return (
    <div className="p-6 md:p-8 max-w-container-max mx-auto space-y-6">
      
      {/* Stream Control Bar */}
      <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <Camera className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold uppercase tracking-wide text-white">Live Tactical AI Vision Stream</h2>
              {backendConnected && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-data-mono font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> FASTAPI CONNECTED
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant font-data-mono">
              {modelName} | Hardware: <strong className="text-accent-electric">{hardwareDevice} ({resolution})</strong> | Latency: <strong className="text-emerald-400">{inferenceMs} ms</strong>
            </p>
          </div>
        </div>

        {/* Master Camera Toggle & Controls */}
        <div className="flex flex-wrap items-center gap-3">
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
                : 'bg-accent-electric text-black border-accent-electric hover:opacity-90 shadow-[0_0_15px_rgba(0,229,255,0.4)]'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isCameraActive ? 'Turn Off Live Cam' : 'Turn On Live Cam'}</span>
          </button>

          <div className="bg-surface-container p-1 rounded-xl border border-outline-variant flex items-center gap-1">
            <button
              onClick={() => setSourceType('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all ${
                sourceType === 'video' ? 'bg-accent-electric text-black font-bold' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              Demo Stream
            </button>
            <button
              onClick={() => setSourceType('webcam')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all ${
                sourceType === 'webcam' ? 'bg-accent-electric text-black font-bold' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              Webcam
            </button>
            <button
              onClick={() => setSourceType('mobile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all ${
                sourceType === 'mobile' ? 'bg-accent-electric text-black font-bold' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              Mobile Cam
            </button>
            <label
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all cursor-pointer flex items-center gap-1 ${
                sourceType === 'upload' ? 'bg-accent-electric text-black font-bold' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Upload Video
              <input type="file" accept="video/*,image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Night Vision Mode Selector */}
          <div className="bg-surface-container p-1 rounded-xl border border-outline-variant flex items-center gap-1">
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
                    ? 'bg-accent-electric text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Visual Debug Mode Toggle */}
          <button
            onClick={() => setIsDebugMode(!isDebugMode)}
            className={`px-3 py-2 rounded-xl text-xs font-label-caps uppercase border transition-all flex items-center gap-1.5 font-bold ${
              isDebugMode
                ? 'bg-amber-400 text-black border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                : 'bg-surface-container text-on-surface-variant hover:text-white border-outline-variant'
            }`}
          >
            <Bug className="w-4 h-4" /> Debug Mode {isDebugMode ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={toggleFullscreen}
            className="px-3 py-2 rounded-xl text-xs font-label-caps uppercase border bg-surface-container text-on-surface-variant hover:text-white border-outline-variant flex items-center gap-1.5 transition-all"
          >
            <Maximize className="w-4 h-4 text-accent-electric" /> {isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}
          </button>
        </div>
      </div>

      {/* Trip Route Active Banner */}
      {activeTrip && (
        <div className="p-3 bg-accent-electric/10 border border-accent-electric/30 rounded-xl flex justify-between items-center text-xs font-data-mono text-white">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent-electric" />
            <span>ROUTE: <strong className="text-accent-electric">{activeTrip.start}</strong> → <strong className="text-emerald-400">{activeTrip.end}</strong></span>
          </div>
          <button onClick={() => setShowRouteModal(true)} className="text-[10px] text-accent-electric hover:underline font-label-caps uppercase">Change Route</button>
        </div>
      )}

      {/* Main Viewport Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Video Screen (Col 8) */}
        <div ref={cameraContainerRef} className="md:col-span-8 card-premium !p-0 relative overflow-hidden border-2 border-accent-electric/40 min-h-[420px] md:min-h-[500px]">
          
          <video
            ref={videoRef}
            loop
            muted
            playsInline
            crossOrigin="anonymous"
            className={`w-full h-full object-cover transition-all duration-300 ${
              nightEnhance ? 'contrast-125 brightness-110 saturate-150 grayscale-[20%]' : ''
            }`}
          />

          {/* Standby Screen when Live Cam is OFF */}
          {!isCameraActive && (
            <div className="absolute inset-0 bg-surface-container-dark/95 flex flex-col items-center justify-center p-6 text-center z-20 space-y-5 backdrop-blur-md">
              <div className="w-20 h-20 rounded-2xl bg-accent-electric/10 border border-accent-electric/40 flex items-center justify-center text-accent-electric shadow-[0_0_30px_rgba(0,229,255,0.25)]">
                <Power className="w-10 h-10 animate-pulse text-accent-electric" />
              </div>
              
              <div className="space-y-2 max-w-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full border border-outline-variant">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="font-label-caps text-[10px] text-amber-300 uppercase tracking-widest font-bold">LIVE CAM STANDBY</span>
                </div>
                <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Camera Feed Offline</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Turn on the live camera stream to initialize trip route tracking, real-time AI object detection, and spoken hazard warning alerts.
                </p>
              </div>

              <button
                onClick={handleTurnOnCameraRequest}
                className="px-8 py-4 bg-accent-electric hover:bg-accent-electric/90 text-black font-bold rounded-xl font-label-caps text-xs uppercase tracking-widest transition-all shadow-[0_0_25px_rgba(0,229,255,0.4)] hover:scale-105 active:scale-95 flex items-center gap-3"
              >
                <Video className="w-5 h-5" />
                <span>Turn On Live Cam</span>
              </button>
            </div>
          )}

          {/* HUD Overlay Lines */}
          <div className="absolute inset-0 hud-scanline opacity-25"></div>

          {/* Real-time Bounding Box Overlays */}
          {isCameraActive && detectedObjects.map((obj) => (
            <div
              key={obj.id}
              className={`absolute border-2 transition-all duration-150 rounded-lg pointer-events-none ${
                obj.risk === 'Critical'
                  ? 'border-red-500 bg-red-500/15 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                  : obj.risk === 'High'
                  ? 'border-amber-400 bg-amber-400/15 shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                  : 'border-accent-electric bg-accent-electric/15 shadow-[0_0_15px_rgba(0,229,255,0.4)]'
              }`}
              style={{
                left: `${obj.x}%`,
                top: `${obj.y}%`,
                width: `${obj.w}%`,
                height: `${obj.h}%`,
              }}
            >
              <div
                className={`absolute -top-7 left-0 px-2 py-0.5 text-[10px] font-data-mono font-bold rounded flex items-center gap-1 uppercase tracking-wider text-black shadow-md ${
                  obj.risk === 'Critical' ? 'bg-red-500' : obj.risk === 'High' ? 'bg-amber-400' : 'bg-accent-electric'
                }`}
              >
                <span>ID: {obj.trackId} | {obj.class} | {Math.round(obj.confidence * 100)}%</span>
              </div>
            </div>
          ))}

          {/* Floating "No objects detected" badge when active but no objects in frame */}
          {isCameraActive && detectedObjects.length === 0 && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/80 border border-amber-400/50 rounded-full text-xs font-data-mono text-amber-300 font-bold z-10 backdrop-blur-md shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>No objects detected.</span>
            </div>
          )}

          {/* Top Canvas Status Overlay Bar */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none z-10">
            <div className="px-3 py-1.5 glass-overlay border border-white/10 rounded-xl text-xs font-data-mono text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent-electric" /> CAM: {isCameraActive ? cameraFps : 0} FPS | AI: {isCameraActive ? aiFps : 0} FPS | {modelName} | Infer: {inferenceMs}ms | Hardware: {hardwareDevice} | Objects: {isCameraActive ? detectedObjects.length : 0}
            </div>
            <div className="px-3 py-1.5 glass-overlay border border-red-500/40 rounded-xl text-xs font-data-mono text-red-400 font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" /> COLLISION THREAT MONITOR: {isCameraActive ? 'ACTIVE' : 'STANDBY'}
            </div>
          </div>

          {/* Visual Debug Mode Overlay HUD */}
          {isDebugMode && (
            <div className="absolute inset-x-4 bottom-4 bg-black/90 border-2 border-amber-400/80 rounded-2xl p-4 z-30 text-amber-300 font-data-mono text-xs space-y-3 backdrop-blur-md shadow-[0_0_30px_rgba(251,191,36,0.25)]">
              <div className="flex justify-between items-center border-b border-amber-400/40 pb-2">
                <span className="font-bold flex items-center gap-2 text-white">
                  <Bug className="w-4 h-4 text-amber-400" /> VISUAL DEBUG MODE HUD (REAL-TIME PIPELINE TELEMETRY)
                </span>
                <span className="text-[10px] bg-amber-400 text-black font-bold px-2 py-0.5 rounded">DEBUG ACTIVE</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                <div className="bg-surface-container p-2 rounded-xl border border-amber-400/30">
                  <span className="text-[9px] text-on-surface-variant block uppercase">Camera FPS (Target 30+)</span>
                  <span className="text-emerald-400 font-bold text-sm">{cameraFps} FPS</span>
                </div>
                <div className="bg-surface-container p-2 rounded-xl border border-amber-400/30">
                  <span className="text-[9px] text-on-surface-variant block uppercase">Detection FPS (Target 20+)</span>
                  <span className="text-emerald-400 font-bold text-sm">{aiFps} FPS</span>
                </div>
                <div className="bg-surface-container p-2 rounded-xl border border-amber-400/30">
                  <span className="text-[9px] text-on-surface-variant block uppercase">Inference Time</span>
                  <span className="text-accent-electric font-bold text-sm">{inferenceMs} ms</span>
                </div>
                <div className="bg-surface-container p-2 rounded-xl border border-amber-400/30">
                  <span className="text-[9px] text-on-surface-variant block uppercase">Detections / Boxes</span>
                  <span className="text-white font-bold text-sm">{detectedObjects.length} Active Boxes</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px] text-white">
                <div>Model: <strong className="text-amber-300">{modelName}</strong></div>
                <div>Device: <strong className="text-emerald-400">{hardwareDevice}</strong></div>
                <div>Res: <strong className="text-accent-electric">{resolution}</strong></div>
              </div>

              {/* Console Stage Logs */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> Real-Time Stage Event Log:
                </div>
                <div className="bg-surface-container-dark p-2 rounded-xl border border-amber-400/20 max-h-24 overflow-y-auto space-y-0.5 text-[10px] font-mono text-emerald-400">
                  {debugLogs.length === 0 ? (
                    <div className="text-on-surface-variant italic">Waiting for camera pipeline events...</div>
                  ) : (
                    debugLogs.map((log, idx) => <div key={idx}>{log}</div>)
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Live Detection Radar & Telemetry Log (Col 4) */}
        <div className="md:col-span-4 space-y-6">
          
          {/* Active Hazards Table Card */}
          <div className="card-premium space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/40 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-accent-electric">Active Target Matrix</h3>
              <span className="text-[10px] font-data-mono text-on-surface-variant">{isCameraActive ? detectedObjects.length : 0} Targets In Field</span>
            </div>

            <div className="space-y-2.5">
              {!isCameraActive ? (
                <div className="text-xs text-on-surface-variant italic text-center py-8 border border-dashed border-outline-variant/50 rounded-xl">
                  Turn on live camera to start scanning for road hazards & distance targets.
                </div>
              ) : detectedObjects.length === 0 ? (
                <div className="text-xs text-on-surface-variant text-center py-6 border border-dashed border-outline-variant/40 rounded-xl space-y-1">
                  <p className="font-semibold text-white">No Objects Currently Detected</p>
                  <p className="text-[10px] font-data-mono text-amber-300">
                    {zeroReason || 'Searching frame... (Threshold: 0.25)'}
                  </p>
                </div>
              ) : (
                detectedObjects.map((obj) => (
                  <div key={obj.id} className="p-3 bg-surface-container rounded-xl border border-outline-variant/40 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs text-white uppercase flex items-center gap-1.5">
                        <Box className="w-3.5 h-3.5 text-accent-electric" /> ID: {obj.trackId} | {obj.class}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-data-mono font-bold uppercase ${
                          obj.risk === 'Critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : obj.risk === 'High'
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                            : 'bg-accent-electric/20 text-accent-electric border border-accent-electric/40'
                        }`}
                      >
                        {obj.risk} Risk
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] font-data-mono text-on-surface-variant">
                      <span>Dist: {obj.distance}m</span>
                      <span>Conf: {Math.round(obj.confidence * 100)}%</span>
                      <span>Rel. Speed: {obj.speed} km/h</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Low-Light Enhancement Telemetry Card */}
          <div className="card-premium space-y-3 border border-accent-electric/30">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-accent-electric animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">AI Night Vision Telemetry</h3>
              </div>
              <span className="text-[9px] font-data-mono text-emerald-400 font-bold">ZERO-DCE++ ACTIVE</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-data-mono">
              <div className="bg-surface-container p-2.5 rounded-xl space-y-0.5 border border-outline-variant/40">
                <span className="text-[9px] text-on-surface-variant uppercase font-label-caps block">Model Engine</span>
                <span className="text-accent-electric font-bold text-[11px]">{nightVisionTelemetry.model}</span>
              </div>
              <div className="bg-surface-container p-2.5 rounded-xl space-y-0.5 border border-outline-variant/40">
                <span className="text-[9px] text-on-surface-variant uppercase font-label-caps block">Active Lighting Mode</span>
                <span className="text-emerald-400 font-bold text-[11px]">{nightVisionTelemetry.mode}</span>
              </div>
              <div className="bg-surface-container p-2.5 rounded-xl space-y-0.5 border border-outline-variant/40">
                <span className="text-[9px] text-on-surface-variant uppercase font-label-caps block">Scene Luminance</span>
                <span className="text-white font-bold text-[11px]">{nightVisionTelemetry.luminance} cd/m²</span>
              </div>
              <div className="bg-surface-container p-2.5 rounded-xl space-y-0.5 border border-outline-variant/40">
                <span className="text-[9px] text-on-surface-variant uppercase font-label-caps block">Enhance Latency</span>
                <span className="text-emerald-400 font-bold text-[11px]">{nightVisionTelemetry.enhancementMs} ms</span>
              </div>
            </div>
          </div>

          {/* Voice Alert Log Card */}
          <div className="card-premium space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-accent-electric" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Auditory Alert Log</h3>
              </div>
              <span className="text-[9px] font-data-mono text-emerald-400">{isCameraActive ? 'SPEECH ACTIVE' : 'SPEECH READY'}</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {alertLog.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic text-center py-4">No critical hazard warnings triggered yet.</p>
              ) : (
                alertLog.map((log) => (
                  <div key={log.id} className="p-2 bg-surface-container-low rounded-lg border border-red-500/20 text-xs space-y-0.5">
                    <div className="flex justify-between text-[10px] text-red-400 font-data-mono">
                      <span>CRITICAL AUDIT</span>
                      <span>{log.time}</span>
                    </div>
                    <p className="text-white text-[11px] font-sans">{log.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Trip Starting & Ending Point Modal (Appears ONLY when user turns on the Live Cam) */}
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
