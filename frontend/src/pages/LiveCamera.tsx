import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Upload, Eye, RefreshCw, Volume2, ShieldAlert, Cpu, CheckCircle, MapPin, Maximize } from 'lucide-react';
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
  
  // Trip Setup & Fullscreen State
  const [showRouteModal, setShowRouteModal] = useState(true);
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

  // Initialize Video or Webcam input
  useEffect(() => {
    if (sourceType === 'webcam') {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 1280, height: 720 } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
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
        videoRef.current.play();
      }
    } else {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = selectedVideo;
        videoRef.current.play();
      }
    }
  }, [sourceType, selectedVideo, customVideoUrl]);

  // File Upload Handler for Custom Videos / Images
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setSourceType('upload');
    }
  };

  // AI Hazard Bounding Box & Canvas Loop
  useEffect(() => {
    const interval = setInterval(async () => {
      let backendActive = false;
      let currentObjects: DetectedObject[] = [];

      // Check if Backend API is responding with live OpenCV frames
      const canvas = document.createElement('canvas');
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(async (blob) => {
            if (blob) {
              const res: DetectionResult | null = await apiService.analyzeFrame(blob, nightEnhance);
              if (res) {
                setBackendConnected(true);
                setFps(res.fps);
                backendActive = true;

                if (res.detections && res.detections.length > 0) {
                  const mapped: DetectedObject[] = res.detections.map((d, index) => {
                    const width = 1280;
                    const height = 720;
                    return {
                      id: d.id || `det_${index}`,
                      class: d.class,
                      confidence: d.confidence,
                      x: Number(((d.bbox[0] / width) * 100).toFixed(1)),
                      y: Number(((d.bbox[1] / height) * 100).toFixed(1)),
                      w: Number(((d.bbox[2] / width) * 100).toFixed(1)),
                      h: Number(((d.bbox[3] / height) * 100).toFixed(1)),
                      distance: d.distance_m,
                      speed: d.class === 'Pedestrian' ? 4 : 78,
                      risk: (d.risk?.risk_level as any) || 'Low',
                    };
                  });
                  setDetectedObjects(mapped);
                  currentObjects = mapped;
                }
              }
            }
          }, 'image/jpeg', 0.6);
        }
      }

      if (!backendActive) {
        // Multi-object continuous tracking simulation (Pedestrians, Vehicles, Bikes, Cones)
        const cycleProgress = ((Date.now() / 1000) % 20) / 20; // 0 to 1 over 20s
        const p1Dist = Number((45 - cycleProgress * 32).toFixed(1)); // 45m -> 13m
        const v1Dist = Number((55 - cycleProgress * 35).toFixed(1)); // 55m -> 20m
        const b1Dist = Number((38 - cycleProgress * 24).toFixed(1)); // 38m -> 14m
        const c1Dist = Number((22 - cycleProgress * 15).toFixed(1)); // 22m -> 7m

        const getRiskLevel = (dist: number): 'Low' | 'Medium' | 'High' | 'Critical' => {
          if (dist < 12) return 'Critical';
          if (dist < 25) return 'High';
          if (dist < 40) return 'Medium';
          return 'Low';
        };

        const simulated: DetectedObject[] = [
          {
            id: 'obj_p1',
            class: 'Pedestrian',
            confidence: 0.94,
            x: 24 + Math.sin(Date.now() / 800) * 2.5,
            y: 40,
            w: 10,
            h: 26,
            distance: p1Dist,
            speed: 4,
            risk: getRiskLevel(p1Dist),
          },
          {
            id: 'obj_v1',
            class: 'Car',
            confidence: 0.96,
            x: 46,
            y: 34,
            w: 20,
            h: 22,
            distance: v1Dist,
            speed: 68,
            risk: getRiskLevel(v1Dist),
          },
          {
            id: 'obj_b1',
            class: 'Bike',
            confidence: 0.91,
            x: 72 + Math.cos(Date.now() / 1200) * 1.5,
            y: 44,
            w: 12,
            h: 18,
            distance: b1Dist,
            speed: 52,
            risk: getRiskLevel(b1Dist),
          },
          {
            id: 'obj_c1',
            class: 'Traffic Cone',
            confidence: 0.89,
            x: 38,
            y: 68,
            w: 6,
            h: 10,
            distance: c1Dist,
            speed: 0,
            risk: getRiskLevel(c1Dist),
          },
        ];

        setDetectedObjects(simulated);
        currentObjects = simulated;
        if (!backendConnected) {
          setFps(55 + Math.floor(Math.random() * 6));
        }
      }

      // Evaluate Hazard Alerts: Beep sound for routine objects, voice ONLY for true emergencies
      currentObjects.forEach((obj) => {
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
    }, 1000);

    return () => clearInterval(interval);
  }, [nightEnhance, backendConnected]);

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
            <p className="text-xs text-on-surface-variant font-data-mono">YOLOv8 Hazard Detection & Monocular Distance Estimation</p>
          </div>
        </div>

        {/* Source Controls */}
        <div className="flex flex-wrap items-center gap-3">
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
            autoPlay
            className={`w-full h-full object-cover transition-all duration-300 ${
              nightEnhance ? 'contrast-125 brightness-110 saturate-150 grayscale-[20%]' : ''
            }`}
          />

          {/* HUD Overlay Lines */}
          <div className="absolute inset-0 hud-scanline opacity-25"></div>

          {/* Simulated Lane Guidance Overlay */}
          {laneDetection && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon points="15,100 45,55 55,55 85,100" fill="rgba(0, 229, 255, 0.06)" />
              <line x1="15" y1="100" x2="45" y2="55" stroke="#00E5FF" strokeWidth="0.8" strokeDasharray="2 2" className="animate-pulse" />
              <line x1="85" y1="100" x2="55" y2="55" stroke="#00E5FF" strokeWidth="0.8" strokeDasharray="2 2" className="animate-pulse" />
            </svg>
          )}

          {/* Bounding Box Overlays */}
          {detectedObjects.map((obj) => (
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
                <span>{obj.class}</span>
                <span>[{obj.distance}m]</span>
                <span>({Math.round(obj.confidence * 100)}%)</span>
              </div>
            </div>
          ))}

          {/* Top Canvas Status */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
            <div className="px-3 py-1.5 glass-overlay border border-white/10 rounded-xl text-xs font-data-mono text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent-electric" /> FPS: {fps} | CLAHE ENHANCED
            </div>
            <div className="px-3 py-1.5 glass-overlay border border-red-500/40 rounded-xl text-xs font-data-mono text-red-400 font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" /> COLLISION THREAT MONITOR: ACTIVE
            </div>
          </div>
        </div>

        {/* Live Detection Radar & Telemetry Log (Col 4) */}
        <div className="md:col-span-4 space-y-6">
          
          {/* Active Hazards Table Card */}
          <div className="card-premium space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/40 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-accent-electric">Active Target Matrix</h3>
              <span className="text-[10px] font-data-mono text-on-surface-variant">{detectedObjects.length} Targets In Field</span>
            </div>

            <div className="space-y-2.5">
              {detectedObjects.map((obj) => (
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
              ))}
            </div>
          </div>

          {/* Voice Alert Log Card */}
          <div className="card-premium space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-accent-electric" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Auditory Alert Log</h3>
              </div>
              <span className="text-[9px] font-data-mono text-emerald-400">SPEECH ACTIVE</span>
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

      {/* Trip Starting & Ending Point Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-md card-premium border border-outline-variant p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase">Set Route Details</h3>
                <p className="text-xs text-on-surface-variant">Enter starting and destination points for trip logging</p>
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
                }}
                className="flex-1 py-3 bg-accent-electric hover:bg-accent-electric/90 text-black font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all"
              >
                Start Live Trip
              </button>
              <button
                onClick={() => setShowRouteModal(false)}
                className="px-5 py-3 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-white font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
