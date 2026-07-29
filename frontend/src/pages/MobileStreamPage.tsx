import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Camera,
  RotateCcw,
  Zap,
  ZapOff,
  Video,
  ShieldCheck,
  Battery,
  Wifi,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const MobileStreamPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || localStorage.getItem('nv_mobile_token') || 'dev_token';

  // Camera Settings State
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [resolutionPreset, setResolutionPreset] = useState<'1080p' | '720p' | '480p'>('1080p');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [maxZoom, setMaxZoom] = useState(5.0);
  const [orientationMode, setOrientationMode] = useState<'landscape' | 'portrait'>('landscape');

  // Stream & Telemetry State
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [streamActive, setStreamActive] = useState(false);
  const [fps, setFps] = useState(30);
  const [batteryLevel, setBatteryLevel] = useState(90);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rtcRef = useRef<RTCPeerConnection | null>(null);

  // Monitor Battery API
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((batt: any) => {
        setBatteryLevel(Math.round(batt.level * 100));
        batt.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(batt.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // Initialize Camera Stream & WebRTC Signaling
  useEffect(() => {
    initCamera(facingMode, resolutionPreset);
    initSignaling(token);

    return () => {
      stopCamera();
      if (wsRef.current) wsRef.current.close();
      if (rtcRef.current) rtcRef.current.close();
    };
  }, [facingMode, resolutionPreset]);

  const initCamera = async (facing: 'environment' | 'user', res: '1080p' | '720p' | '480p') => {
    stopCamera();
    setErrorMessage('');

    let resWidth = 1920;
    let resHeight = 1080;
    if (res === '720p') { resWidth = 1280; resHeight = 720; }
    if (res === '480p') { resWidth = 854; resHeight = 480; }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: resWidth },
        height: { ideal: resHeight },
        frameRate: { ideal: 30 },
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      setPermissionGranted(true);
      setStreamActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Check Zoom Capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.zoom) {
          setMaxZoom(capabilities.zoom.max || 5.0);
        }
      }
    } catch (err: any) {
      console.warn('[MobileStream] Camera permission error:', err);
      // Fallback without exact constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        mediaStreamRef.current = fallbackStream;
        setPermissionGranted(true);
        setStreamActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (errFallback) {
        setPermissionGranted(false);
        setErrorMessage('Camera permission denied or camera device unavailable. Please allow access.');
      }
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setStreamActive(false);
  };

  // WebRTC PeerConnection Signaling Setup
  const initSignaling = (sessionToken: string) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/mobile/ws/signal/${sessionToken}?role=mobile`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[MobileStream] Signaling WebSocket connected');
        ws.send(JSON.stringify({ type: 'device_connected', device_name: navigator.userAgent.includes('iPhone') ? 'iPhone Camera' : 'Android Camera' }));
        createWebRTCOffer();
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'answer' && rtcRef.current) {
            await rtcRef.current.setRemoteDescription(msg.answer);
          } else if (msg.type === 'candidate' && rtcRef.current) {
            await rtcRef.current.addIceCandidate(msg.candidate);
          } else if (msg.type === 'switch_camera') {
            setFacingMode(msg.facing === 'user' ? 'user' : 'environment');
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      // Periodic Telemetry Transmission
      const telemetryInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'telemetry',
            fps: 30,
            resolution: `${resolutionPreset} (${facingMode})`,
            battery: batteryLevel,
            signal: 'EXCELLENT'
          }));
        }
      }, 3000);

      ws.onclose = () => clearInterval(telemetryInterval);
    } catch (err) {
      console.warn('[MobileStream] Signaling error:', err);
    }
  };

  const createWebRTCOffer = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      rtcRef.current = pc;

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, mediaStreamRef.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'offer', offer }));
      }
    } catch (err) {
      console.warn('[MobileStream] WebRTC offer creation failed:', err);
    }
  };

  // Toggle Torch / Flash
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({ advanced: [{ torch: nextTorch }] });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('[MobileStream] Torch control not supported on this device/browser:', err);
      setTorchOn(!torchOn);
    }
  };

  // Handle Zoom
  const handleZoomChange = async (val: number) => {
    setZoomLevel(val);
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        await (track as any).applyConstraints({ advanced: [{ zoom: val }] });
      } catch (e) {}
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 select-none">
      
      {/* Mobile Top Header */}
      <div className="flex justify-between items-center bg-slate-900/90 border border-slate-800 p-3 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Camera className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">NightVision Stream</h1>
            <p className="text-[10px] text-cyan-400 font-mono">TOKEN: {token.substring(0, 10)}...</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <Wifi className="w-3.5 h-3.5" /> LIVE
          </span>
          <span className="flex items-center gap-1 text-cyan-400">
            <Battery className="w-3.5 h-3.5" /> {batteryLevel}%
          </span>
        </div>
      </div>

      {/* Main Camera Viewport */}
      <div className="relative flex-1 my-3 bg-black rounded-3xl overflow-hidden border-2 border-cyan-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(0,229,255,0.15)] min-h-[360px]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* HUD Scanlines */}
        <div className="absolute inset-0 hud-scanline opacity-20 pointer-events-none"></div>

        {/* Reticle */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-32 h-32 border border-cyan-500/50 rounded-2xl flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
          </div>
        </div>

        {/* Permission Error Banner */}
        {!permissionGranted && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
            <AlertCircle className="w-12 h-12 text-red-500 animate-bounce" />
            <h2 className="text-lg font-bold text-white uppercase">Camera Access Required</h2>
            <p className="text-xs text-slate-400 max-w-xs">{errorMessage || 'Please allow camera permission to stream video to NightVision AI.'}</p>
            <button
              onClick={() => initCamera(facingMode, resolutionPreset)}
              className="px-6 py-3 bg-cyan-400 text-black font-bold rounded-xl text-xs uppercase font-mono shadow-lg"
            >
              Grant Camera Permission
            </button>
          </div>
        )}
      </div>

      {/* Mobile Stream Bottom Controls */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl space-y-4 backdrop-blur-md">
        
        {/* Zoom Slider */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-400 uppercase w-12">Zoom {zoomLevel.toFixed(1)}x</span>
          <input
            type="range"
            min={1.0}
            max={maxZoom}
            step={0.1}
            value={zoomLevel}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Main Action Buttons */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono font-bold uppercase">
          {/* Switch Rear / Front Camera */}
          <button
            onClick={() => setFacingMode(facingMode === 'environment' ? 'user' : 'environment')}
            className="py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-cyan-400 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-[9px]">{facingMode === 'environment' ? 'Rear Cam' : 'Front Cam'}</span>
          </button>

          {/* Torch / Flash Toggle */}
          <button
            onClick={toggleTorch}
            className={`py-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
              torchOn ? 'bg-amber-400 text-black border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            <span className="text-[9px]">Flash {torchOn ? 'ON' : 'OFF'}</span>
          </button>

          {/* Resolution Preset Toggle */}
          <button
            onClick={() => {
              const nextRes = resolutionPreset === '1080p' ? '720p' : resolutionPreset === '720p' ? '480p' : '1080p';
              setResolutionPreset(nextRes);
            }}
            className="py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1"
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[9px]">{resolutionPreset}</span>
          </button>

          {/* Orientation Toggle */}
          <button
            onClick={() => setOrientationMode(orientationMode === 'landscape' ? 'portrait' : 'landscape')}
            className="py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1"
          >
            <Video className="w-4 h-4 text-cyan-400" />
            <span className="text-[9px]">{orientationMode}</span>
          </button>
        </div>

      </div>

    </div>
  );
};
