import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Camera,
  RotateCcw,
  Zap,
  ZapOff,
  Video,
  Battery,
  Wifi,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  Activity,
  ShieldCheck,
  Power
} from 'lucide-react';

export type MobileCameraStatus =
  | 'Camera Ready'
  | 'Requesting Permission'
  | 'Camera Connected'
  | 'Streaming'
  | 'Camera Disconnected'
  | 'Camera Error';

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

  // Status & Telemetry State
  const [status, setStatus] = useState<MobileCameraStatus>('Camera Ready');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(95);
  const [fps, setFps] = useState(30);
  const [activeRes, setActiveRes] = useState('1920x1080');

  // Debug Logging State
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rtcRef = useRef<RTCPeerConnection | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const addLog = (msg: string) => {
    const timeStr = new Date().toLocaleTimeString();
    const logLine = `[${timeStr}] ${msg}`;
    console.log(`[MobileStreamPage] ${msg}`);
    setLogs((prev) => [logLine, ...prev.slice(0, 49)]);
  };

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

  // Main Camera & Signaling Lifecycle
  useEffect(() => {
    addLog(`Initializing camera setup (facing: ${facingMode}, resolution: ${resolutionPreset})`);
    initCameraPipeline(facingMode, resolutionPreset);
    initSignaling(token);

    return () => {
      stopCamera();
      if (wsRef.current) wsRef.current.close();
      if (rtcRef.current) rtcRef.current.close();
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
    };
  }, [facingMode, resolutionPreset]);

  /**
   * Multi-Stage Robust getUserMedia Camera Initialization Pipeline.
   * Works on iOS Safari, Android Chrome, Edge, and desktop browsers.
   */
  const initCameraPipeline = async (desiredFacing: 'environment' | 'user', resPreset: '1080p' | '720p' | '480p') => {
    stopCamera();
    setStatus('Requesting Permission');
    setErrorMessage('');
    setErrorDetails('');
    addLog('Requesting camera permission from browser...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errText = 'Camera API (navigator.mediaDevices.getUserMedia) unavailable in this browser.';
      setStatus('Camera Error');
      setErrorMessage(errText);
      setErrorDetails('Please open this page in Chrome, Safari, or Edge over HTTPS or localhost.');
      addLog(`ERROR: ${errText}`);
      return;
    }

    let reqWidth = 1920;
    let reqHeight = 1080;
    if (resPreset === '720p') { reqWidth = 1280; reqHeight = 720; }
    if (resPreset === '480p') { reqWidth = 854; reqHeight = 480; }

    let stream: MediaStream | null = null;
    let actualFacing = desiredFacing;

    // Stage 1: Attempt exact/ideal facing mode with requested resolution
    try {
      addLog(`Stage 1: Attempting ${desiredFacing} camera (${reqWidth}x${reqHeight})...`);
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: desiredFacing },
          width: { ideal: reqWidth },
          height: { ideal: reqHeight },
          frameRate: { ideal: 30 },
        },
      });
    } catch (err1: any) {
      addLog(`Stage 1 notice (${err1.name}): ${err1.message}. Trying Stage 2 fallback...`);
      
      // Stage 2: Fallback to opposite camera if rear failed
      try {
        const altFacing = desiredFacing === 'environment' ? 'user' : 'environment';
        addLog(`Stage 2: Attempting fallback ${altFacing} camera...`);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: altFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        actualFacing = altFacing;
        setFacingMode(altFacing);
      } catch (err2: any) {
        addLog(`Stage 2 notice (${err2.name}): ${err2.message}. Trying Stage 3 basic video fallback...`);
        
        // Stage 3: Absolute fallback (any available camera stream)
        try {
          addLog('Stage 3: Requesting basic camera stream with default constraints...');
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (err3: any) {
          handleCameraError(err3);
          return;
        }
      }
    }

    if (!stream) {
      setStatus('Camera Error');
      setErrorMessage('Failed to obtain camera video stream.');
      return;
    }

    mediaStreamRef.current = stream;
    setStatus('Camera Connected');
    addLog(`Camera successfully opened (${actualFacing} camera active)`);

    // Attach stream to <video> element with iOS Safari compatibility attributes
    if (videoRef.current) {
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
      videoRef.current.autoplay = true;
      videoRef.current.srcObject = stream;

      try {
        await videoRef.current.play();
        setStatus('Streaming');
        addLog('Live video preview active & playing');
      } catch (playErr: any) {
        addLog(`Video element play notice: ${playErr.message}`);
        // Fallback user interaction click listener for autoplay restriction
        const forcePlay = () => {
          if (videoRef.current) videoRef.current.play().catch(() => {});
          window.removeEventListener('click', forcePlay);
          window.removeEventListener('touchstart', forcePlay);
        };
        window.addEventListener('click', forcePlay);
        window.addEventListener('touchstart', forcePlay);
      }
    }

    // Determine actual active resolution & capabilities
    const track = stream.getVideoTracks()[0];
    if (track) {
      const settings = track.getSettings ? track.getSettings() : {};
      if (settings.width && settings.height) {
        const resStr = `${settings.width}x${settings.height}`;
        setActiveRes(resStr);
        addLog(`Active camera resolution: ${resStr}`);
      }

      // Check Zoom capability
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.zoom) {
        setMaxZoom(capabilities.zoom.max || 5.0);
      }

      // Track end listener
      track.onended = () => {
        addLog('WARNING: Camera track ended unexpectedly.');
        setStatus('Camera Disconnected');
        reconnectCamera();
      };
    }

    // Attach stream to WebRTC if RTC connection exists
    if (rtcRef.current && stream) {
      attachStreamToWebRTC(stream);
    }

    // Start Fallback Canvas Frame Transmission over WebSocket
    startCanvasFrameStream();
  };

  /**
   * Comprehensive Camera Error Handler mapping DOMException names to clear user messages.
   */
  const handleCameraError = (err: any) => {
    console.error('[MobileStreamPage] Camera error:', err);
    setStatus('Camera Error');

    const errName = err.name || 'UnknownError';
    const errText = err.message || String(err);

    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      setErrorMessage('Camera Permission Denied');
      setErrorDetails('Your browser or phone blocked camera access. Please tap "Grant Camera Permission" or allow camera access in browser site settings.');
      addLog('ERROR: Permission Denied by user or OS security policy.');
    } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
      setErrorMessage('No Camera Found');
      setErrorDetails('No physical camera device was detected on your mobile phone.');
      addLog('ERROR: DevicesNotFoundError - No camera sensor detected.');
    } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
      setErrorMessage('Camera Already In Use');
      setErrorDetails('Another app (like WhatsApp, Instagram, or Camera app) or browser tab is using the camera. Please close other camera apps and retry.');
      addLog('ERROR: TrackStartError - Camera locked by another application.');
    } else if (errName === 'OverconstrainedError' || errName === 'ConstraintNotSatisfiedError') {
      setErrorMessage('Camera Resolution Unsupported');
      setErrorDetails('The requested resolution is not supported by your mobile camera sensor.');
      addLog('ERROR: OverconstrainedError - Unsupported constraints.');
    } else if (errName === 'SecurityError') {
      setErrorMessage('Security Error (HTTPS Required)');
      setErrorDetails('Mobile camera access requires HTTPS or localhost connection.');
      addLog('ERROR: SecurityError - Origin not secure.');
    } else {
      setErrorMessage(`Camera Failure: ${errName}`);
      setErrorDetails(errText || 'An unexpected error occurred while starting the camera.');
      addLog(`ERROR: ${errName} - ${errText}`);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setStatus('Camera Disconnected');
  };

  const reconnectCamera = () => {
    addLog('Attempting automatic camera reconnection in 3 seconds...');
    setTimeout(() => {
      initCameraPipeline(facingMode, resolutionPreset);
    }, 3000);
  };

  /**
   * WebRTC Signaling & Connection Setup with Auto-Reconnection.
   */
  const initSignaling = (sessionToken: string) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/mobile/ws/signal/${sessionToken}?role=mobile`;

    addLog(`Connecting to signaling server at ${wsUrl}...`);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('WebSocket signaling connection established.');
        const devName = navigator.userAgent.includes('iPhone') ? 'iPhone Camera' : 'Android Camera';
        ws.send(JSON.stringify({ type: 'device_connected', device_name: devName }));
        createWebRTCOffer();
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'answer' && rtcRef.current) {
            addLog('Received WebRTC answer from desktop.');
            await rtcRef.current.setRemoteDescription(msg.answer);
          } else if (msg.type === 'candidate' && rtcRef.current) {
            await rtcRef.current.addIceCandidate(msg.candidate);
          } else if (msg.type === 'switch_camera') {
            const nextFacing = msg.facing === 'user' ? 'user' : 'environment';
            addLog(`Remote request: Switching to ${nextFacing} camera.`);
            setFacingMode(nextFacing);
          }
        } catch (e) {
          // Ignore parse error
        }
      };

      ws.onerror = (e) => {
        addLog('WebSocket signaling error detected.');
      };

      ws.onclose = () => {
        addLog('WebSocket signaling connection closed. Retrying in 4 seconds...');
        setTimeout(() => {
          initSignaling(sessionToken);
        }, 4000);
      };

      // Telemetry Loop (every 3 seconds)
      const telemetryInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'telemetry',
            fps: fps,
            resolution: `${activeRes} (${facingMode})`,
            battery: batteryLevel,
            signal: 'EXCELLENT',
            status: status
          }));
        }
      }, 3000);

    } catch (err: any) {
      addLog(`Signaling exception: ${err.message}`);
    }
  };

  const createWebRTCOffer = async () => {
    try {
      addLog('Creating WebRTC PeerConnection...');
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      rtcRef.current = pc;

      pc.onconnectionstatechange = () => {
        addLog(`WebRTC connection state: ${pc.connectionState}`);
      };

      if (mediaStreamRef.current) {
        attachStreamToWebRTC(mediaStreamRef.current);
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        addLog('Sending WebRTC offer to desktop...');
        wsRef.current.send(JSON.stringify({ type: 'offer', offer }));
      }
    } catch (err: any) {
      addLog(`WebRTC offer creation error: ${err.message}`);
    }
  };

  const attachStreamToWebRTC = (stream: MediaStream) => {
    if (!rtcRef.current) return;
    try {
      const senders = rtcRef.current.getSenders();
      senders.forEach((s) => rtcRef.current?.removeTrack(s));
      stream.getTracks().forEach((track) => {
        rtcRef.current?.addTrack(track, stream);
      });
      addLog('Attached media tracks to WebRTC PeerConnection.');
    } catch (err: any) {
      addLog(`Attach track error: ${err.message}`);
    }
  };

  /**
   * Robust Fallback Canvas Frame Transmission over WebSocket.
   * Captures 10 FPS JPEG frames and sends over WebSocket so desktop feed never freezes!
   */
  const startCanvasFrameStream = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    frameIntervalRef.current = window.setInterval(() => {
      if (!videoRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (videoRef.current.readyState < 2) return;

      try {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 360);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          wsRef.current.send(JSON.stringify({ type: 'frame', image: dataUrl }));
        }
      } catch (e) {
        // Ignore canvas draw error
      }
    }, 100);
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
      addLog(`Flash/Torch toggled ${nextTorch ? 'ON' : 'OFF'}`);
    } catch (err: any) {
      addLog(`Torch notice: ${err.message || 'Not supported on this device'}`);
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
            <p className="text-[10px] text-cyan-400 font-mono">SESSION: {token.substring(0, 8)}...</p>
          </div>
        </div>

        {/* Dynamic Status Indicator Badge */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'Streaming' || status === 'Camera Connected'
                  ? 'bg-emerald-400 animate-ping'
                  : status === 'Requesting Permission'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-400'
              }`}
            ></span>
            <span
              className={
                status === 'Streaming'
                  ? 'text-emerald-400'
                  : status === 'Requesting Permission'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }
            >
              {status}
            </span>
          </div>

          <button
            onClick={() => setShowLogs(!showLogs)}
            title="Toggle Debug Console Logs"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
          >
            <Terminal className="w-4 h-4" />
          </button>
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

        <canvas ref={canvasRef} className="hidden" />

        {/* HUD Scanlines */}
        <div className="absolute inset-0 hud-scanline opacity-20 pointer-events-none"></div>

        {/* Reticle Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-32 h-32 border border-cyan-500/50 rounded-2xl flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
          </div>
        </div>

        {/* Error / Permission Overlay Banner */}
        {(status === 'Camera Error' || status === 'Camera Disconnected' || status === 'Requesting Permission') && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-4 z-20 backdrop-blur-md">
            {status === 'Requesting Permission' ? (
              <RefreshCw className="w-12 h-12 text-amber-400 animate-spin" />
            ) : (
              <AlertCircle className="w-12 h-12 text-red-500 animate-bounce" />
            )}
            
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white uppercase">{errorMessage || status}</h2>
              <p className="text-xs text-slate-400 max-w-xs">{errorDetails || 'Allow camera permission to start streaming live video.'}</p>
            </div>

            <button
              onClick={() => initCameraPipeline(facingMode, resolutionPreset)}
              className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-black font-bold rounded-xl text-xs uppercase font-mono shadow-lg flex items-center gap-2"
            >
              <Power className="w-4 h-4" />
              <span>Grant / Retry Camera Permission</span>
            </button>
          </div>
        )}

        {/* Live Debug Logs Overlay */}
        {showLogs && (
          <div className="absolute inset-x-2 top-2 bottom-2 bg-slate-950/90 text-emerald-400 p-3 rounded-2xl font-mono text-[10px] overflow-y-auto border border-cyan-500/50 z-30 space-y-1">
            <div className="flex justify-between border-b border-cyan-500/30 pb-1 text-white font-bold">
              <span>MOBILE CAMERA LIVE DEBUG CONSOLE</span>
              <button onClick={() => setShowLogs(false)} className="text-red-400">CLOSE [X]</button>
            </div>
            {logs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
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

        {/* Action Buttons */}
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
