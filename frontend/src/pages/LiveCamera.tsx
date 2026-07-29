import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Upload, Eye, RefreshCw, Volume2, ShieldAlert, Cpu, CheckCircle, MapPin, Maximize, Power } from 'lucide-react';
import { voiceAlerts } from '../services/voiceAlerts';
import { apiService, DetectionResult } from '../services/api';

interface DetectedObject {
  id: string;
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
  const [sourceType, setSourceType] = useState<'video' | 'webcam' | 'upload'>('video');
  const [selectedVideo, setSelectedVideo] = useState(SAMPLE_VIDEOS[0].url);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [nightEnhance, setNightEnhance] = useState(true);
  const [laneDetection, setLaneDetection] = useState(true);
  const [fps, setFps] = useState(58);
  const [backendConnected, setBackendConnected] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [alertLog, setAlertLog] = useState<{ id: string; text: string; time: string; level: string }[]>([]);
  const [modelName, setModelName] = useState<string>('YOLO12 Nano (ByteTrack)');
  const [inferenceMs, setInferenceMs] = useState<number>(24.5);
  const [trackingMs, setTrackingMs] = useState<number>(1.2);
  const [aiFps, setAiFps] = useState<number>(8);
  const [cameraFps, setCameraFps] = useState<number>(60);
  const [hardwareDevice, setHardwareDevice] = useState<string>('CPU');
  const [resolution, setResolution] = useState<string>('416x416');
  
  // Camera & Trip Setup State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [activeTrip, setActiveTrip] = useState<{ start: string; end: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraContainerRef = useRef<HTMLDivElement>(null);

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

  // Turn on Live Cam handler: opens the trip location asking tab first
  const handleTurnOnCameraRequest = () => {
    setShowRouteModal(true);
  };

  // Turn off Live Cam
  const handleTurnOffCamera = () => {
    setIsCameraActive(false);
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

    if (sourceType === 'webcam') {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 1280, height: 720 } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.warn(e));
          }
        })
        .catch((err) => {
          console.warn('Webcam permission denied, falling back to sample video', err);
          setSourceType('video');
        });
    } else if (sourceType === 'upload' && customVideoUrl) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = customVideoUrl;
        videoRef.current.play().catch(e => console.warn(e));
      }
    } else {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = selectedVideo;
        videoRef.current.play().catch(e => console.warn(e));
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

  // AI Hazard Bounding Box & Canvas Loop (Runs ONLY when camera is active)
  useEffect(() => {
    if (!isCameraActive) return;

    let isProcessing = false;

    const interval = setInterval(async () => {
      if (isProcessing) return;
      if (!videoRef.current || videoRef.current.videoWidth === 0) return;

      isProcessing = true;
      try {
        const vWidth = videoRef.current.videoWidth || 640;
        const vHeight = videoRef.current.videoHeight || 360;
        const canvas = document.createElement('canvas');
        canvas.width = vWidth;
        canvas.height = vHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(async (blob) => {
            try {
              if (blob) {
                const res: DetectionResult | null = await apiService.analyzeFrame(blob, nightEnhance);
                if (res) {
                  setBackendConnected(true);
                  if (res.fps) setFps(res.fps);
                  if (res.camera_fps) setCameraFps(res.camera_fps);
                  if (res.ai_fps) setAiFps(res.ai_fps);
                  if (res.model_name) setModelName(res.model_name);
                  if (res.inference_time_ms !== undefined) setInferenceMs(res.inference_time_ms);
                  if (res.tracking_time_ms !== undefined) setTrackingMs(res.tracking_time_ms);
                  if (res.device) setHardwareDevice(res.device);
                  if (res.resolution) setResolution(res.resolution);

                  if (res.detections && res.detections.length > 0) {
                    const mapped: DetectedObject[] = res.detections.map((d, index) => ({
                      id: d.id || `det_${index}`,
                      class: d.class,
                      confidence: d.confidence,
                      x: Number(((d.bbox[0] / vWidth) * 100).toFixed(1)),
                      y: Number(((d.bbox[1] / vHeight) * 100).toFixed(1)),
                      w: Number(((d.bbox[2] / vWidth) * 100).toFixed(1)),
                      h: Number(((d.bbox[3] / vHeight) * 100).toFixed(1)),
                      distance: d.distance_m,
                      speed: d.class === 'Pedestrian' ? 4 : 65,
                      risk: (d.risk?.risk_level as any) || 'Low',
                    }));
                    setDetectedObjects(mapped);

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
                  }
                }
              }
            } catch (err) {
              console.warn('Frame analysis error:', err);
            } finally {
              isProcessing = false;
            }
          }, 'image/jpeg', 0.8);
        } else {
          isProcessing = false;
        }
      } catch (e) {
        isProcessing = false;
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isCameraActive, nightEnhance]);

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
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-data-mono font-bold">
                  FASTAPI CONNECTED
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
            <label
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps uppercase transition-all cursor-pointer flex items-center gap-1 ${
                sourceType === 'upload' ? 'bg-accent-electric text-black font-bold' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Upload Video
              <input type="file" accept="video/*,image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <button
            onClick={() => setNightEnhance(!nightEnhance)}
            className={`px-3 py-2 rounded-xl text-xs font-label-caps uppercase border transition-all flex items-center gap-1.5 ${
              nightEnhance ? 'bg-accent-electric/20 text-accent-electric border-accent-electric/40' : 'bg-surface-container text-on-surface-variant border-outline-variant'
            }`}
          >
            <Eye className="w-4 h-4" /> Night CLAHE: {nightEnhance ? 'ON' : 'OFF'}
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



          {/* Bounding Box Overlays */}
          {isCameraActive && detectedObjects.map((obj) => (
            <div
              key={obj.id}
              className={`absolute border-2 transition-all duration-300 rounded-lg pointer-events-none ${
                obj.risk === 'Critical'
                  ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                  : obj.risk === 'High'
                  ? 'border-amber-400 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                  : 'border-accent-electric bg-accent-electric/10 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
              }`}
              style={{
                left: `${obj.x}%`,
                top: `${obj.y}%`,
                width: `${obj.w}%`,
                height: `${obj.h}%`,
              }}
            >
              <div
                className={`absolute -top-7 left-0 px-2 py-0.5 text-[10px] font-data-mono font-bold rounded flex items-center gap-1 uppercase tracking-wider text-black ${
                  obj.risk === 'Critical' ? 'bg-red-500' : obj.risk === 'High' ? 'bg-amber-400' : 'bg-accent-electric'
                }`}
              >
                <span>#{obj.id} {obj.class}</span>
                <span>[{obj.distance}m]</span>
                <span>({Math.round(obj.confidence * 100)}%)</span>
              </div>
            </div>
          ))}

          {/* Top Canvas Status */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none z-10">
            <div className="px-3 py-1.5 glass-overlay border border-white/10 rounded-xl text-xs font-data-mono text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent-electric" /> CAM: {isCameraActive ? cameraFps : 0} FPS | AI: {isCameraActive ? aiFps : 0} FPS | {modelName} | Infer: {inferenceMs}ms | Track: {trackingMs}ms
            </div>
            <div className="px-3 py-1.5 glass-overlay border border-red-500/40 rounded-xl text-xs font-data-mono text-red-400 font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" /> COLLISION THREAT MONITOR: {isCameraActive ? 'ACTIVE' : 'STANDBY'}
            </div>
          </div>
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
              ) : (
                detectedObjects.map((obj) => (
                  <div key={obj.id} className="p-3 bg-surface-container rounded-xl border border-outline-variant/40 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs text-white uppercase">{obj.class}</span>
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
                      <span>Distance: {obj.distance}m</span>
                      <span>Rel. Speed: {obj.speed} km/h</span>
                    </div>
                  </div>
                ))
              )}
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

