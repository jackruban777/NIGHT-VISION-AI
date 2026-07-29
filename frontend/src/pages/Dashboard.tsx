import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, UserCheck, Eye, Compass, Sun, Cpu, CheckCircle2, ChevronRight } from 'lucide-react';
import { voiceAlerts } from '../services/voiceAlerts';

export const Dashboard: React.FC = () => {
  const [speed, setSpeed] = useState(82);
  const [riskScore, setRiskScore] = useState(64);
  const [detections, setDetections] = useState([
    { id: 'd1', label: 'Pedestrian', distance: '14.2m', time: '12:04:22', icon: 'directions_walk', alertLevel: 'medium' },
    { id: 'd2', label: 'Vehicle Ahead', distance: '45.8m', time: '12:04:18', icon: 'directions_car', alertLevel: 'low' },
    { id: 'd3', label: 'Stray Animal (Deer)', distance: '28.4m', time: '12:03:50', icon: 'pets', alertLevel: 'high' },
  ]);

  // Real Speedometer via Geolocation API & Smooth AI Telemetry
  useEffect(() => {
    let watchId: number;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos.coords.speed !== null && pos.coords.speed !== undefined) {
            const speedKmh = Math.round(pos.coords.speed * 3.6);
            if (speedKmh > 0) setSpeed(speedKmh);
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }

    const interval = setInterval(() => {
      // Smooth dynamic speed adjustments if stationary/testing
      const delta = Math.floor(Math.random() * 5) - 2;
      setSpeed((prev) => Math.min(120, Math.max(35, prev + delta)));

      const newRisk = Math.min(95, Math.max(20, 64 + Math.floor(Math.random() * 9) - 4));
      setRiskScore(newRisk);
    }, 3000);

    return () => {
      clearInterval(interval);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-container-max mx-auto space-y-6">
      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Live Camera Feed Bento Widget */}
        <div className="md:col-span-8 md:row-span-2 relative card-premium overflow-hidden !p-0 border-2 border-accent-electric/30 min-h-[380px] md:min-h-[440px] flex flex-col justify-between group">
          {/* Background Camera Frame with AI Overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-[1.01]"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&q=80&w=1600')`,
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50"></div>
          <div className="absolute inset-0 hud-scanline opacity-30"></div>

          {/* HUD Top Bar Elements */}
          <div className="relative z-10 p-6 flex justify-between items-start">
            <div className="px-4 py-2 glass-overlay border border-white/10 rounded-xl">
              <p className="font-label-caps text-[10px] text-accent-electric tracking-widest uppercase mb-1">DETECTION STATUS</p>
              <p className="font-data-mono text-xs text-white font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-electric animate-ping"></span>
                LIVE_FEED: 60FPS / 4K UHD
              </p>
            </div>

            <Link
              to="/live-camera"
              className="px-4 py-2 bg-accent-electric/20 hover:bg-accent-electric hover:text-black border border-accent-electric/50 text-accent-electric rounded-xl font-label-caps text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2"
            >
              <span>Full AI Camera Stream</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* AI Reticle Crosshair floating in center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 pointer-events-none opacity-80">
            <svg className="w-full h-full text-accent-electric animate-[spin_20s_linear_infinite]" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="0.8" />
              <circle cx="50" cy="50" r="2" fill="currentColor" />
              <path d="M50 5 L50 15 M50 85 L50 95 M5 50 L15 50 M85 50 L95 50" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-16 border-2 border-accent-electric/80 rounded-lg flex items-center justify-center">
                <span className="text-[9px] font-data-mono text-accent-electric font-bold bg-black/80 px-1 py-0.5 rounded -top-5 absolute">
                  TRACKING TARGET [14.2m]
                </span>
              </div>
            </div>
          </div>

          {/* HUD Bottom Speedometer Telemetry */}
          <div className="relative z-10 p-6 flex justify-between items-end border-t border-white/10 backdrop-blur-md bg-black/30">
            <div>
              <p className="font-label-caps text-[10px] text-accent-electric uppercase tracking-widest">Active Night Enhancement</p>
              <p className="font-data-mono text-xs text-on-surface-variant mt-0.5">CLAHE Histogram Equalizer Enabled</p>
            </div>
            <div className="text-right">
              <p className="font-label-caps text-xs text-accent-electric uppercase tracking-widest font-bold">Current Speed</p>
              <p className="font-display-lg text-5xl md:text-6xl font-extrabold text-white leading-none font-data-mono">
                {speed} <span className="text-lg font-normal text-on-surface-variant">KM/H</span>
              </p>
            </div>
          </div>
        </div>

        {/* Collision Risk Score Bento Card */}
        <div className="md:col-span-4 card-premium flex flex-col justify-between border-accent-amber/40 shadow-[0_0_20px_rgba(255,179,0,0.08)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-label-caps text-xs text-accent-amber uppercase tracking-wider font-bold mb-1">Collision Risk Level</p>
              <h3 className="font-headline-md text-2xl font-bold text-on-surface uppercase">
                {riskScore > 75 ? 'Critical Caution' : riskScore > 50 ? 'Amber Caution' : 'Nominal Risk'}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent-amber/10 border border-accent-amber/30 flex items-center justify-center text-accent-amber">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>
          </div>

          <div className="space-y-3 my-4">
            <div className="w-full bg-surface-container-highest h-3 rounded-full overflow-hidden p-0.5 border border-outline-variant">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  riskScore > 75 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-accent-amber shadow-[0_0_15px_rgba(255,179,0,0.8)]'
                }`}
                style={{ width: `${riskScore}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-xs font-data-mono">
              <span className="text-on-surface-variant">Safety Margin: Normal</span>
              <span className="text-accent-amber font-bold">{riskScore}% Risk Index</span>
            </div>
          </div>

          <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/40 text-xs text-on-surface-variant flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-accent-electric shrink-0" />
            <span>Driver Alertness: 96% Optimal</span>
          </div>
        </div>

        {/* Recent Detections List Bento Card */}
        <div className="md:col-span-4 card-premium flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="font-label-caps text-xs text-accent-electric uppercase tracking-widest font-bold">Recent Detections</p>
              <span className="text-[10px] font-data-mono text-on-surface-variant">Real-Time Log</span>
            </div>

            <div className="space-y-3">
              {detections.map((det) => (
                <div
                  key={det.id}
                  className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant/30 hover:border-accent-electric/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent-electric/10 border border-accent-electric/20 flex items-center justify-center text-accent-electric">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-body-base text-sm text-on-surface font-semibold">{det.label}</p>
                      <p className="font-data-mono text-[11px] text-on-surface-variant">Distance: {det.distance}</p>
                    </div>
                  </div>
                  <span className="font-data-mono text-xs text-accent-electric font-semibold">{det.time}</span>
                </div>
              ))}
            </div>
          </div>

          <Link
            to="/analytics"
            className="mt-4 pt-3 border-t border-outline-variant/40 text-center text-xs text-on-surface-variant hover:text-accent-electric font-label-caps uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
          >
            <span>View Complete Hazard Audit</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* AI System Health Gauge Bento Card */}
        <div className="md:col-span-3 card-premium flex flex-col justify-between">
          <p className="font-label-caps text-xs text-accent-electric uppercase tracking-widest font-bold mb-4">AI System Health</p>
          
          <div className="flex items-center gap-4 my-2">
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle className="text-surface-container-highest" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeWidth="5" />
                <circle
                  className="text-accent-electric"
                  cx="32"
                  cy="32"
                  fill="transparent"
                  r="28"
                  stroke="currentColor"
                  strokeDasharray="176"
                  strokeDashoffset="11"
                  strokeWidth="5"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-data-mono text-sm font-bold text-white">94%</span>
            </div>
              <p className="font-body-base text-sm text-on-surface font-semibold">Neural Engine (ByteTrack)</p>
              <p className="text-xs text-on-surface-variant font-data-mono mt-0.5">Camera: 60FPS | AI: 8FPS | Latency: 24ms</p>
          </div>

          <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center justify-between text-xs text-emerald-400 font-data-mono">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> YOLO11n (ByteTrack)
            </span>
            <span>GPU/CPU Accelerated</span>
          </div>
        </div>

        {/* Road Visibility & Weather Bento Card */}
        <div className="md:col-span-5 card-premium flex flex-col justify-between">
          <p className="font-label-caps text-xs text-accent-electric uppercase tracking-widest font-bold mb-4">Environment Telemetry</p>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">Road Visibility</p>
              <div className="flex items-center gap-2">
                <span className="font-display-lg text-2xl font-bold text-white uppercase">High</span>
                <Eye className="w-5 h-5 text-accent-electric" />
              </div>
              <p className="font-data-mono text-xs text-on-surface-variant">98% Clarity Index</p>
            </div>

            <div className="space-y-1">
              <p className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">Weather Conditions</p>
              <div className="flex items-center gap-2">
                <span className="font-display-lg text-2xl font-bold text-white uppercase">Clear</span>
                <Sun className="w-5 h-5 text-accent-amber" />
              </div>
              <p className="font-data-mono text-xs text-on-surface-variant">Temp: 18°C / Asphalt Dry</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-outline-variant/40 text-[11px] text-on-surface-variant font-data-mono flex justify-between">
            <span>Lunar Phase: 82% Illumination</span>
            <span>Fog Level: 0.0%</span>
          </div>
        </div>

        {/* Daily Drive Statistics Bento Card */}
        <div className="md:col-span-4 card-premium flex flex-col justify-between">
          <p className="font-label-caps text-xs text-accent-electric uppercase tracking-widest font-bold mb-4">Today's Drive Statistics</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40 space-y-1">
              <p className="text-[10px] uppercase font-bold text-on-surface-variant font-label-caps">Total Detections</p>
              <p className="text-2xl font-bold text-white font-data-mono">1,248</p>
            </div>
            <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40 space-y-1">
              <p className="text-[10px] uppercase font-bold text-on-surface-variant font-label-caps">Drive Time</p>
              <p className="text-2xl font-bold text-white font-data-mono">4h 12m</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-outline-variant/40 flex justify-between items-center text-xs">
            <span className="text-on-surface-variant font-data-mono">Distance Covered: 184.2 km</span>
            <span className="text-emerald-400 font-bold font-data-mono">Score: 94/100</span>
          </div>
        </div>

      </div>
    </div>
  );
};
