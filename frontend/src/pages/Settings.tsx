import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Sliders, Volume2, Camera, Shield, Sun, Moon, Save } from 'lucide-react';
import { voiceAlerts } from '../services/voiceAlerts';

export const SettingsPage: React.FC = () => {
  const [sensitivity, setSensitivity] = useState('High');
  const [detectionDistance, setDetectionDistance] = useState(50);
  const [volume, setVolume] = useState(voiceAlerts.getVolume() * 100);
  const [cameraRes, setCameraRes] = useState('4k');
  const [nightAlgorithm, setNightAlgorithm] = useState('CLAHE Histogram');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nv_theme') as 'dark' | 'light') || 'dark';
  });
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    localStorage.setItem('nv_theme', newTheme);
  };

  const handleSave = () => {
    voiceAlerts.setVolume(volume / 100);
    setSavedMsg('System Configuration & Preferences Saved.');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  return (
    <div className="p-6 md:p-8 max-w-container-max mx-auto space-y-6">
      
      {/* Page Banner */}
      <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <SettingsIcon className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-white">Sensors & System Settings</h2>
            <p className="text-xs text-on-surface-variant font-data-mono">Calibrate AI Perception, Theme & Telemetry</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-accent-electric text-on-primary-fixed font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.25)]"
        >
          <Save className="w-4 h-4" /> Save Preferences
        </button>
      </div>

      {savedMsg && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-400 font-data-mono text-center animate-in fade-in">
          {savedMsg}
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Visual Theme Changer Card (Dark / Light Mode) */}
        <div className="card-premium space-y-5">
          <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-3">
            <Sun className="w-5 h-5 text-accent-electric" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Visual Interface Theme</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider block mb-2">
                Color Mode: <span className="text-accent-electric font-bold">{theme.toUpperCase()} MODE</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => toggleTheme('dark')}
                  className={`py-3 px-4 rounded-xl text-xs font-label-caps uppercase transition-all flex items-center justify-center gap-2 ${
                    theme === 'dark'
                      ? 'bg-accent-electric text-black font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                      : 'bg-surface-container text-on-surface-variant hover:text-white border border-outline-variant/40'
                  }`}
                >
                  <Moon className="w-4 h-4" /> Dark Mode
                </button>
                <button
                  onClick={() => toggleTheme('light')}
                  className={`py-3 px-4 rounded-xl text-xs font-label-caps uppercase transition-all flex items-center justify-center gap-2 ${
                    theme === 'light'
                      ? 'bg-accent-electric text-black font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                      : 'bg-surface-container text-on-surface-variant hover:text-white border border-outline-variant/40'
                  }`}
                >
                  <Sun className="w-4 h-4" /> Light Mode
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Perception Sensitivity Card */}
        <div className="card-premium space-y-5">
          <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-3">
            <Sliders className="w-5 h-5 text-accent-electric" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">AI Detection Sensitivity</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider block mb-2">
                Sensitivity Mode: <span className="text-accent-electric font-bold">{sensitivity}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Normal', 'High', 'Tactical Ultra'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSensitivity(mode)}
                    className={`py-2 rounded-xl text-xs font-label-caps uppercase transition-all ${
                      sensitivity === mode
                        ? 'bg-accent-electric text-black font-bold'
                        : 'bg-surface-container text-on-surface-variant hover:text-white border border-outline-variant/40'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-data-mono mb-2">
                <span className="text-on-surface-variant">Maximum Detection Distance</span>
                <span className="text-accent-electric font-bold">{detectionDistance} meters</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={detectionDistance}
                onChange={(e) => setDetectionDistance(Number(e.target.value))}
                className="w-full accent-accent-electric bg-surface-container h-2 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Voice Alert & Audio Card */}
        <div className="card-premium space-y-5">
          <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-3">
            <Volume2 className="w-5 h-5 text-accent-electric" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Voice Alerts & Audio</h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-data-mono mb-2">
                <span className="text-on-surface-variant">Speech Warning Volume</span>
                <span className="text-accent-electric font-bold">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-accent-electric bg-surface-container h-2 rounded-lg cursor-pointer"
              />
            </div>

            <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/40 text-xs text-on-surface-variant space-y-1">
              <span className="font-bold text-white font-label-caps uppercase">Audio Alert Mode</span>
              <p className="text-[11px] leading-relaxed">
                Subtle beep sound with 4-second gap for approaching hazards; "Go Slow" voice alert for crossing emergency hazards.
              </p>
            </div>
          </div>
        </div>

        {/* Camera & Hardware */}
        <div className="card-premium space-y-5">
          <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-3">
            <Camera className="w-5 h-5 text-accent-electric" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Camera & Optical Hardware</h3>
          </div>

          <div className="space-y-4 text-xs font-data-mono">
            <div>
              <label className="text-on-surface-variant block mb-1">Target Stream Resolution</label>
              <select
                value={cameraRes}
                onChange={(e) => setCameraRes(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-white focus:outline-none focus:border-accent-electric font-sans"
              >
                <option value="4k">4K UHD @ 60 FPS (Tactical Standard)</option>
                <option value="1080p">1080p FHD @ 60 FPS</option>
                <option value="720p">720p HD @ 30 FPS (Low Latency)</option>
              </select>
            </div>

            <div>
              <label className="text-on-surface-variant block mb-1">Night Vision AI Enhancement Mode</label>
              <select
                value={nightAlgorithm}
                onChange={(e) => {
                  setNightAlgorithm(e.target.value);
                  localStorage.setItem('nv_night_vision_mode', e.target.value);
                }}
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-white focus:outline-none focus:border-accent-electric font-sans"
              >
                <option value="Auto">Auto (Dynamic Scene Luminance Detection)</option>
                <option value="Day">Day (Pass-Through / Enhancement Disabled)</option>
                <option value="Evening">Evening (Lightweight Curve Adjustment)</option>
                <option value="Night">Night (Zero-DCE++ Deep Curve AI)</option>
                <option value="Extreme Dark">Extreme Dark (Maximum Curve AI + Edge Denoising)</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
