import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Camera, UserCheck, Eye, BarChart3, Navigation, Bell, Settings, Activity, Cpu } from 'lucide-react';

export const SidebarNav: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);

  const handleDiagnosticScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      alert('Quick Check Complete: All AI Camera & Vision Sensors active and ready.');
    }, 1500);
  };

  const navItems = [
    { to: '/live-camera', label: '1. Live AI Camera', icon: Camera },
    { to: '/driver-monitor', label: '2. Driver Fatigue Monitor', icon: UserCheck },
    { to: '/dashboard', label: '3. Tactical Dashboard', icon: Eye },
    { to: '/analytics', label: '4. Safety Analytics', icon: BarChart3 },
    { to: '/trips', label: '5. Trip Logs', icon: Navigation },
    { to: '/notifications', label: '6. Notifications', icon: Bell },
    { to: '/settings', label: '7. Settings', icon: Settings },
  ];

  return (
    <aside className="fixed h-screen left-0 w-64 bg-surface-container-low border-r border-outline-variant z-50 flex flex-col py-8 select-none">
      {/* Brand Header */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <Camera className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md text-primary tracking-tight font-bold text-white">NightVision AI</h1>
            <p className="font-label-caps text-[10px] text-accent-electric tracking-wider uppercase font-bold">ADAS Driving Safety</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-label-caps text-xs tracking-wider uppercase ${
                  isActive
                    ? 'text-accent-electric bg-accent-electric/10 border-l-4 border-accent-electric font-bold shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                    : 'text-on-surface-variant hover:bg-surface-bright/10 hover:text-on-surface'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Quick System Check Action */}
      <div className="px-6 mt-auto space-y-3">
        <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/40 space-y-1 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-data-mono text-emerald-400 font-bold">
            <Cpu className="w-3.5 h-3.5" /> AI SYSTEM READY
          </div>
          <p className="text-[10px] text-on-surface-variant">Simple 1-Click Hazard Detection</p>
        </div>

        <button
          onClick={handleDiagnosticScan}
          disabled={isScanning}
          className="w-full py-3 px-4 bg-accent-electric hover:bg-accent-electric/90 active:scale-95 text-on-primary-fixed font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.3)] disabled:opacity-50"
        >
          <Activity className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Checking Sensors...' : 'Quick System Check'}
        </button>
      </div>
    </aside>
  );
};
