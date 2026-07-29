import React, { useState } from 'react';
import { useEmergency } from '../../context/EmergencyContext';
import { voiceAlerts } from '../../services/voiceAlerts';
import { Volume2, VolumeX, Radio, BatteryCharging, AlertTriangle, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { triggerSOS } = useEmergency();
  const [isMuted, setIsMuted] = useState(voiceAlerts.getIsMuted());

  const toggleAudio = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    voiceAlerts.setMuted(nextMuted);
  };

  return (
    <header className="flex justify-between items-center w-full px-8 py-4 bg-background/90 border-b border-outline-variant z-40 backdrop-blur-xl sticky top-0">
      {/* Page Title & Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full border border-outline-variant/60">
          <span className="w-2 h-2 rounded-full bg-accent-electric pip-active"></span>
          <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-widest font-bold">AI READY</span>
        </div>
        <h2 className="font-display-lg text-2xl font-bold text-on-surface tracking-tight uppercase">
          {title}
        </h2>
      </div>

      {/* Right Controls & SOS Emergency */}
      <div className="flex items-center gap-5">
        {/* Voice Alert Toggle */}
        <button
          onClick={toggleAudio}
          title={isMuted ? 'Unmute Voice Hazard Warnings' : 'Mute Voice Hazard Warnings'}
          className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-label-caps uppercase ${
            isMuted
              ? 'bg-surface-container text-on-surface-variant border-outline-variant hover:text-white'
              : 'bg-accent-electric/10 text-accent-electric border-accent-electric/30 hover:bg-accent-electric/20'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-pulse" />}
          <span className="hidden sm:inline">{isMuted ? 'Voice Off' : 'Voice Active'}</span>
        </button>

        {/* Test Audio Button */}
        <button
          onClick={() => voiceAlerts.testAudio()}
          title="Test Voice Alert & Audio Chime"
          className="px-3 py-2.5 rounded-xl border border-accent-electric/40 bg-accent-electric/10 hover:bg-accent-electric hover:text-black text-accent-electric font-label-caps text-xs uppercase font-bold transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,229,255,0.15)]"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Test Audio</span>
        </button>

        {/* System Telemetry Icons */}
        <div className="hidden lg:flex items-center gap-4 text-on-surface-variant font-data-mono text-xs border-r border-outline-variant pr-5">
          <div className="flex items-center gap-1.5 hover:text-accent-electric transition-colors" title="GPS Navigation Sync">
            <Radio className="w-4 h-4 text-accent-electric" />
            <span>GPS READY</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-accent-electric transition-colors" title="LTE Connected">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ONLINE</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-accent-electric transition-colors" title="Battery Power">
            <BatteryCharging className="w-4 h-4 text-accent-electric" />
            <span>100%</span>
          </div>
        </div>

        {/* SOS Emergency Button */}
        <button
          onClick={triggerSOS}
          className="px-5 py-2.5 bg-error-container/40 text-error hover:bg-error hover:text-white font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all border border-error/50 flex items-center gap-2 active:scale-95 shadow-[0_0_15px_rgba(255,82,82,0.2)]"
        >
          <AlertTriangle className="w-4 h-4" /> SOS EMERGENCY
        </button>
      </div>
    </header>
  );
};
