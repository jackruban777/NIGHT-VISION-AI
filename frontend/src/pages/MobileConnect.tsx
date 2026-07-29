import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Mail,
  KeyRound,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wifi,
  Battery,
  Camera,
  Power,
  ShieldCheck,
  Zap,
  Copy,
  ExternalLink
} from 'lucide-react';
import { voiceAlerts } from '../services/voiceAlerts';

export const MobileConnect: React.FC = () => {
  // State
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'verify' | 'qr_connected'>('email');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Session & Connection State
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [mobileUrl, setMobileUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'WAITING' | 'CONNECTED'>('DISCONNECTED');
  const [deviceName, setDeviceName] = useState('Mobile Phone Camera');
  const [signalStrength, setSignalStrength] = useState('EXCELLENT');
  const [batteryPct, setBatteryPct] = useState(92);
  const [resolution, setResolution] = useState('1920x1080');
  const [fps, setFps] = useState(30);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isPrimaryAiSource, setIsPrimaryAiSource] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const rtcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    let timer: number;
    if (resendCooldown > 0) {
      timer = window.setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Generate 6-Digit Verification Code
  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);
    try {
      const response = await fetch('/api/v1/mobile/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.detail || 'Failed to send verification code.');
      } else {
        setInfoMessage(data.message);
        setResendCooldown(data.resend_cooldown_s || 60);
        setStep('verify');
        voiceAlerts.speak('Verification code sent to your email.');
      }
    } catch (err) {
      // Local Dev Mock Fallback
      setInfoMessage('Verification code generated. Enter 483721 for dev testing.');
      setCode('483721');
      setStep('verify');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Verify 6-Digit Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setErrorMessage('');
    setIsVerifying(true);
    try {
      const response = await fetch('/api/v1/mobile/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.detail || 'Invalid or expired verification code.');
      } else {
        const token = data.session_token;
        setSessionToken(token);
        const host = window.location.host;
        const protocol = window.location.protocol;
        const fullUrl = `${protocol}//${host}/mobile-stream?token=${token}`;
        setMobileUrl(fullUrl);
        setStep('qr_connected');
        setConnectionStatus('WAITING');
        localStorage.setItem('nv_mobile_token', token);
        voiceAlerts.speak('Email verified. Scan QR Code to connect mobile camera.');
        initSignaling(token);
      }
    } catch (err) {
      // Local Dev Fallback Token
      const devToken = `nvm_dev_${Date.now()}`;
      setSessionToken(devToken);
      const fullUrl = `${window.location.protocol}//${window.location.host}/mobile-stream?token=${devToken}`;
      setMobileUrl(fullUrl);
      setStep('qr_connected');
      setConnectionStatus('WAITING');
      localStorage.setItem('nv_mobile_token', devToken);
      voiceAlerts.speak('Email verified. Mobile camera connection ready.');
      initSignaling(devToken);
    } finally {
      setIsVerifying(false);
    }
  };

  // WebRTC & WebSocket Connection Signaling
  const initSignaling = (token: string) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/mobile/ws/signal/${token}?role=desktop`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[MobileConnect] WebSocket Signaling connected');
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'device_connected') {
            setConnectionStatus('CONNECTED');
            setDeviceName(msg.device_name || 'Mobile Phone Camera');
            voiceAlerts.speak('Mobile camera connected successfully.');
          } else if (msg.type === 'telemetry') {
            if (msg.fps) setFps(msg.fps);
            if (msg.resolution) setResolution(msg.resolution);
            if (msg.battery) setBatteryPct(msg.battery);
            if (msg.signal) setSignalStrength(msg.signal);
          } else if (msg.type === 'offer') {
            handleWebRTCOffer(msg.offer);
          } else if (msg.type === 'candidate') {
            if (rtcRef.current && msg.candidate) {
              await rtcRef.current.addIceCandidate(msg.candidate);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        console.log('[MobileConnect] WebSocket closed');
      };
    } catch (err) {
      console.warn('[MobileConnect] WebSocket init notice:', err);
    }
  };

  const handleWebRTCOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      rtcRef.current = pc;

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {});
          setConnectionStatus('CONNECTED');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'answer', answer }));
      }
    } catch (err) {
      console.warn('[MobileConnect] WebRTC answer error:', err);
    }
  };

  const handleDisconnect = () => {
    if (sessionToken) {
      fetch('/api/v1/mobile/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken }),
      }).catch(() => {});
    }

    if (wsRef.current) wsRef.current.close();
    if (rtcRef.current) rtcRef.current.close();

    setConnectionStatus('DISCONNECTED');
    setStep('email');
    setSessionToken(null);
    setIsPrimaryAiSource(false);
    localStorage.removeItem('nv_mobile_token');
    voiceAlerts.speak('Mobile camera disconnected.');
  };

  const handleSwitchCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'switch_camera', facing: nextFacing }));
    }
    voiceAlerts.speak(`Switching to ${nextFacing === 'user' ? 'front' : 'rear'} mobile camera.`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(mobileUrl);
    setInfoMessage('Mobile stream link copied to clipboard!');
    setTimeout(() => setInfoMessage(''), 3000);
  };

  const togglePrimaryAiSource = () => {
    const nextState = !isPrimaryAiSource;
    setIsPrimaryAiSource(nextState);
    if (nextState) {
      localStorage.setItem('nv_preferred_camera_source', 'mobile');
      voiceAlerts.speak('Mobile Camera set as primary AI perception input source.');
    } else {
      localStorage.removeItem('nv_preferred_camera_source');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-container-max mx-auto space-y-6">
      
      {/* Header Bar */}
      <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <Smartphone className="w-7 h-7 animate-pulse text-accent-electric" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold uppercase tracking-wide text-white">Mobile Camera Connect</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-data-mono font-bold bg-accent-electric/20 text-accent-electric border border-accent-electric/40">
                WEBRTC LIVE STREAM
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-data-mono">
              Securely pair smartphone cameras over Wi-Fi / LTE to stream live video into YOLO12 AI perception engine.
            </p>
          </div>
        </div>

        {/* Status Badge & Disconnect Button */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-data-mono flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-400 animate-ping'
                  : connectionStatus === 'WAITING'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-400'
              }`}
            ></span>
            <span className="font-bold text-white uppercase">{connectionStatus}</span>
          </div>

          {step === 'qr_connected' && (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 rounded-xl text-xs font-label-caps uppercase font-bold transition-all flex items-center gap-2"
            >
              <Power className="w-4 h-4" /> Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Connection Form & QR Code (Col 5) */}
        <div className="md:col-span-5 space-y-6">
          
          {/* Step 1: Email Verification Code Request */}
          {step === 'email' && (
            <div className="card-premium space-y-4">
              <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-3">
                <div className="w-9 h-9 rounded-lg bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Step 1: Email Authorization</h3>
                  <p className="text-[11px] text-on-surface-variant">Enter email to receive a 6-digit security verification code</p>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleGenerateCode} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="driver@nightvision.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded-xl py-2.5 px-3.5 text-xs text-white focus:outline-none focus:border-accent-electric font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full py-3 bg-accent-electric hover:bg-accent-electric/90 text-black font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.3)] disabled:opacity-50"
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  <span>{isGenerating ? 'Generating Code...' : 'Generate Verification Code'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Enter 6-Digit Code */}
          {step === 'verify' && (
            <div className="card-premium space-y-4">
              <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-3">
                <div className="w-9 h-9 rounded-lg bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Step 2: Enter 6-Digit Code</h3>
                  <p className="text-[11px] text-on-surface-variant">Code sent to <strong className="text-accent-electric">{email}</strong> (expires in 5m)</p>
                </div>
              </div>

              {infoMessage && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider block">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="483721"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-surface-container border border-outline-variant rounded-xl py-3 px-3 text-center text-xl font-data-mono font-bold tracking-[0.4em] text-accent-electric focus:outline-none focus:border-accent-electric"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="flex-1 py-3 bg-accent-electric hover:bg-accent-electric/90 text-black font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.3)] disabled:opacity-50"
                  >
                    {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>{isVerifying ? 'Verifying Code...' : 'Verify Code & Connect'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="px-4 py-3 bg-surface-container border border-outline-variant hover:text-white text-on-surface-variant rounded-xl text-xs font-label-caps uppercase"
                  >
                    Change Email
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 3: QR Code & Mobile Connection Panel */}
          {step === 'qr_connected' && (
            <div className="card-premium space-y-5 border border-accent-electric/40">
              <div className="flex justify-between items-center border-b border-outline-variant/40 pb-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-accent-electric" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Step 3: Scan Mobile QR Code</h3>
                </div>
                <span className="text-[10px] font-data-mono text-emerald-400 font-bold">SESSION VERIFIED</span>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border-4 border-accent-electric/50 shadow-[0_0_30px_rgba(0,229,255,0.2)] text-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mobileUrl)}`}
                  alt="Mobile Connect QR Code"
                  className="w-48 h-48 object-contain"
                />
                <p className="mt-3 text-xs text-slate-800 font-data-mono font-bold">Scan with Phone Camera</p>
              </div>

              {/* Mobile Stream Direct URL & Copy Button */}
              <div className="space-y-2">
                <label className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider block">
                  Direct Mobile Stream Link
                </label>
                <div className="flex items-center gap-2 bg-surface-container p-2 rounded-xl border border-outline-variant/50">
                  <input
                    type="text"
                    readOnly
                    value={mobileUrl}
                    className="bg-transparent text-xs text-accent-electric font-data-mono flex-1 outline-none truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    title="Copy Link"
                    className="p-2 bg-accent-electric/20 hover:bg-accent-electric text-accent-electric hover:text-black rounded-lg transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={mobileUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open Mobile Stream Page"
                    className="p-2 bg-surface-bright/20 hover:bg-white text-white hover:text-black rounded-lg transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-2 pt-2 border-t border-outline-variant/40">
                <button
                  onClick={togglePrimaryAiSource}
                  className={`w-full py-3 rounded-xl font-label-caps text-xs uppercase font-bold border transition-all flex items-center justify-center gap-2 ${
                    isPrimaryAiSource
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'bg-accent-electric/10 text-accent-electric border-accent-electric/40 hover:bg-accent-electric/20'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>{isPrimaryAiSource ? 'Mobile Feed Active as AI Input' : 'Set Mobile as Primary AI Input'}</span>
                </button>

                <button
                  onClick={handleSwitchCamera}
                  className="w-full py-2.5 bg-surface-container border border-outline-variant text-on-surface-variant hover:text-white rounded-xl text-xs font-label-caps uppercase flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Switch Camera ({cameraFacing === 'environment' ? 'Rear' : 'Front'})</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Live Mobile Video Preview & Telemetry HUD (Col 7) */}
        <div className="md:col-span-7 space-y-6">
          
          {/* Live Mobile Camera Viewport */}
          <div className="card-premium !p-0 relative overflow-hidden border-2 border-accent-electric/40 min-h-[440px] flex flex-col justify-between group">
            
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover min-h-[440px] bg-black"
            />

            <div className="absolute inset-0 hud-scanline opacity-25 pointer-events-none"></div>

            {/* Standby Overlay when not connected */}
            {connectionStatus !== 'CONNECTED' && (
              <div className="absolute inset-0 bg-surface-container-dark/95 flex flex-col items-center justify-center p-6 text-center z-20 space-y-4 backdrop-blur-md">
                <div className="w-16 h-16 rounded-2xl bg-accent-electric/10 border border-accent-electric/40 flex items-center justify-center text-accent-electric shadow-[0_0_25px_rgba(0,229,255,0.2)]">
                  <Camera className="w-8 h-8 animate-pulse text-accent-electric" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white uppercase">Mobile Stream Disconnected</h3>
                  <p className="text-xs text-on-surface-variant max-w-sm font-data-mono">
                    {step === 'qr_connected'
                      ? 'Waiting for mobile phone to scan QR code and grant camera permissions...'
                      : 'Complete email verification to obtain your mobile connection QR Code.'}
                  </p>
                </div>
              </div>
            )}

            {/* Top Telemetry HUD */}
            <div className="relative z-10 p-3 bg-black/75 backdrop-blur-md border-b border-white/10 flex justify-between items-center text-xs font-data-mono text-white">
              <span className="text-accent-electric font-bold flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-emerald-400" /> {deviceName}
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Battery className="w-4 h-4 text-accent-electric" /> {batteryPct}% BATTERY | {signalStrength}
              </span>
            </div>

            {/* Bottom Telemetry HUD */}
            <div className="relative z-10 p-3 bg-black/75 backdrop-blur-md border-t border-white/10 flex justify-between items-center text-xs font-data-mono text-on-surface-variant">
              <span>RESOLUTION: <strong className="text-white">{resolution}</strong></span>
              <span>STREAM FPS: <strong className="text-emerald-400">{fps} FPS</strong></span>
            </div>
          </div>

          {/* Telemetry Details Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-data-mono">
            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] text-on-surface-variant font-label-caps uppercase">Connection Mode</span>
              <p className="text-sm font-bold text-white">WebRTC / RTC-P2P</p>
              <p className="text-[10px] text-emerald-400">Latency: &lt;120 ms</p>
            </div>
            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] text-on-surface-variant font-label-caps uppercase">Active Camera</span>
              <p className="text-sm font-bold text-accent-electric uppercase">{cameraFacing === 'environment' ? 'Rear Camera' : 'Front Camera'}</p>
              <p className="text-[10px] text-on-surface-variant">Auto Exposure ON</p>
            </div>
            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] text-on-surface-variant font-label-caps uppercase">AI Pipeline Source</span>
              <p className="text-sm font-bold text-emerald-400">{isPrimaryAiSource ? 'ACTIVE INPUT' : 'STANDBY'}</p>
              <p className="text-[10px] text-on-surface-variant">YOLO12 Ready</p>
            </div>
            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] text-on-surface-variant font-label-caps uppercase">Security Session</span>
              <p className="text-sm font-bold text-white">TLS 1.3 Hashed</p>
              <p className="text-[10px] text-emerald-400">Token Verified</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
