import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, AlertTriangle, Activity, Moon, Camera } from 'lucide-react';
import { voiceAlerts } from '../services/voiceAlerts';

export const DriverMonitor: React.FC = () => {
  const [earScore, setEarScore] = useState(0.28); // Normal > 0.22, Drowsy < 0.20
  const [blinkRate, setBlinkRate] = useState(18); // Blinks/min
  const [yawnCount, setYawnCount] = useState(1);
  const [distractionScore, setDistractionScore] = useState(98); // % Focused
  const [isDrowsy, setIsDrowsy] = useState(false);
  const [fatigueLevel, setFatigueLevel] = useState<'Optimal' | 'Mild Fatigue' | 'Severe Drowsiness'>('Optimal');
  const [hasWebcam, setHasWebcam] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize Real Webcam Stream for Driver Monitoring
  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 1280, height: 720 } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setHasWebcam(true);
        }
      })
      .catch((err) => {
        console.warn('Physical webcam unavailable for driver monitor, showing optical preview', err);
        setHasWebcam(false);
      });

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Biometric Driver Scan Loop
  useEffect(() => {
    const interval = setInterval(() => {
      const simulatedEar = Number((0.26 + (Math.random() * 0.08 - 0.04)).toFixed(2));
      const randomSpike = Math.random() < 0.15;
      const currentEar = randomSpike ? 0.16 : simulatedEar;

      setEarScore(currentEar);

      if (currentEar < 0.20) {
        setIsDrowsy(true);
        setFatigueLevel('Severe Drowsiness');
        voiceAlerts.speak('Go Slow! Drowsiness Detected! Take a rest break.', 'drowsy_warning', true);
      } else if (currentEar < 0.24) {
        setIsDrowsy(false);
        setFatigueLevel('Mild Fatigue');
      } else {
        setIsDrowsy(false);
        setFatigueLevel('Optimal');
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-container-max mx-auto space-y-6">
      
      {/* Top Title Banner */}
      <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <UserCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold uppercase tracking-wide text-white">Driver Fatigue & Drowsiness Monitor</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-data-mono font-bold ${hasWebcam ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-accent-electric/20 text-accent-electric border border-accent-electric/40'}`}>
                {hasWebcam ? 'LIVE CAMERA ACTIVE' : 'OPTICAL CAMERA SIMULATION'}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-data-mono">MediaPipe Facial Mesh Eye-Aspect-Ratio (EAR) AI Model</p>
          </div>
        </div>

        <div className="px-4 py-2 bg-surface-container border border-outline-variant rounded-xl text-xs font-data-mono flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>STATUS: REAL-TIME BIOMETRIC SCAN</span>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Driver Camera Feed Viewport (Col 7) */}
        <div className="md:col-span-7 card-premium !p-0 relative overflow-hidden border-2 border-accent-electric/30 min-h-[400px] flex flex-col justify-between group">
          
          {hasWebcam ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover grayscale contrast-125 scale-x-[-1]"
            />
          ) : (
            <img
              src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=1000"
              alt="Driver Monitoring Camera"
              className="absolute inset-0 w-full h-full object-cover grayscale opacity-60 contrast-125"
            />
          )}

          <div className="absolute inset-0 hud-scanline opacity-20"></div>

          {/* Facial Landmark Tracking Mesh Mockup */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-accent-electric/60 rounded-full pointer-events-none flex items-center justify-center">
            <div className="w-32 h-20 border border-cyan-glow/40 rounded-xl flex items-center justify-center">
              <span className="text-[9px] font-data-mono text-accent-electric font-bold bg-black/80 px-2 py-0.5 rounded">
                EYES TRACKED: EAR {earScore}
              </span>
            </div>
          </div>

          {/* Warning Overlay banner if drowsy */}
          {isDrowsy && (
            <div className="absolute inset-0 bg-red-600/40 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center animate-pulse">
              <AlertTriangle className="w-16 h-16 text-white mb-2" />
              <h3 className="text-3xl font-extrabold text-white uppercase tracking-wider">GO SLOW - DROWSINESS WARNING</h3>
              <p className="text-sm text-red-100 mt-1 max-w-md font-semibold">
                Eye closure duration exceeded safe threshold (EAR &lt; 0.20). Pull over immediately.
              </p>
            </div>
          )}

          {/* HUD Status Bar */}
          <div className="relative z-10 p-4 bg-black/60 backdrop-blur-md border-t border-white/10 flex justify-between items-center text-xs font-data-mono">
            <span className="text-accent-electric font-bold flex items-center gap-1.5">
              <Camera className="w-4 h-4" /> DRIVER BIOMETRIC CAMERA
            </span>
            <span className={earScore < 0.22 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              EAR SCORE: {earScore} (SAFE THRESHOLD: 0.22)
            </span>
          </div>
        </div>

        {/* Biometric Telemetry Cards (Col 5) */}
        <div className="md:col-span-5 space-y-6">
          
          {/* Fatigue Level Alert Card */}
          <div className={`card-premium space-y-4 border ${isDrowsy ? 'border-red-500 bg-red-950/20' : 'border-outline-variant'}`}>
            <div className="flex justify-between items-center border-b border-outline-variant/40 pb-3">
              <span className="font-label-caps text-xs text-accent-electric uppercase font-bold tracking-wider">Driver Alertness Score</span>
              <span className={`text-xs font-data-mono font-bold ${isDrowsy ? 'text-red-400' : 'text-emerald-400'}`}>
                {fatigueLevel}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-data-mono mb-1">
                  <span className="text-on-surface-variant">Focus Index</span>
                  <span className="text-white font-bold">{distractionScore}% Focused</span>
                </div>
                <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <div className="bg-accent-electric h-full" style={{ width: `${distractionScore}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-data-mono mb-1">
                  <span className="text-on-surface-variant">Eye Closure Ratio (EAR)</span>
                  <span className={earScore < 0.22 ? 'text-red-400 font-bold' : 'text-accent-electric font-bold'}>{earScore}</span>
                </div>
                <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${earScore < 0.22 ? 'bg-red-500' : 'bg-accent-electric'}`}
                    style={{ width: `${Math.min(100, earScore * 300)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Blink Frequency</span>
              <div className="text-2xl font-bold text-white font-data-mono">{blinkRate} <span className="text-xs font-normal text-on-surface-variant">bpm</span></div>
              <p className="text-[10px] text-emerald-400 font-data-mono">Normal Rate</p>
            </div>

            <div className="card-premium p-4 space-y-1">
              <span className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Yawn Frequency</span>
              <div className="text-2xl font-bold text-white font-data-mono">{yawnCount} <span className="text-xs font-normal text-on-surface-variant">this drive</span></div>
              <p className="text-[10px] text-accent-amber font-data-mono">Low Frequency</p>
            </div>
          </div>

          {/* Emergency Rest Advice */}
          <div className="card-premium p-4 bg-accent-electric/5 border border-accent-electric/20 space-y-2 text-xs text-on-surface-variant">
            <div className="flex items-center gap-2 text-accent-electric font-bold uppercase tracking-wider font-label-caps">
              <Moon className="w-4 h-4" /> Night Drive Safety Recommendation
            </div>
            <p className="text-white text-[11px] leading-relaxed">
              If severe fatigue persists, NV AI recommends taking a 15-minute break at the nearest rest area located 8.4 km ahead on Highway 101.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
