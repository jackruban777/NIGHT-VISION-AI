import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ShieldAlert, LogIn, UserPlus, ArrowRight, Activity, Radio, BatteryCharging } from 'lucide-react';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const openAuth = (mode: 'login' | 'register') => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      setAuthMode(mode);
      setAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-sans relative overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-background/90 backdrop-blur-xl border-b border-outline-variant px-6 md:px-12 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <Eye className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="font-display-lg text-2xl font-bold text-on-surface tracking-tight uppercase">
            NightVision AI
          </h1>
        </div>

        {/* Status Cluster */}
        <div className="hidden md:flex items-center gap-6 text-on-surface-variant font-label-caps text-xs tracking-widest uppercase">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-accent-electric" />
            <span>GPS ACTIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>LTE-V2X</span>
          </div>
          <div className="flex items-center gap-2">
            <BatteryCharging className="w-4 h-4 text-accent-electric" />
            <span>98%</span>
          </div>
        </div>

        <button
          onClick={() => openAuth('login')}
          className="bg-accent-electric text-on-primary-fixed px-6 py-2.5 rounded-xl font-label-caps text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all active:scale-95 shadow-[0_0_20px_rgba(0,229,255,0.3)]"
        >
          {isAuthenticated ? 'Enter Dashboard' : 'Driver Portal'}
        </button>
      </header>

      <main className="relative pt-20">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center overflow-hidden">
          {/* Hero Background Image with Tactical AI HUD */}
          <div className="absolute inset-0 z-0">
            <div className="w-full h-full relative">
              <img
                className="w-full h-full object-cover grayscale opacity-50 contrast-125"
                alt="Tactical NightVision Driving Cockpit"
                src="https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&q=80&w=2000"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent"></div>
              <div className="absolute inset-0 hud-overlay"></div>
              
              {/* Decorative Scanning Line */}
              <div className="scanning-line"></div>

              {/* Tactical AI Target Overlays */}
              <div className="absolute top-1/4 right-1/4 w-36 h-36 border-2 border-accent-electric/60 rounded-xl flex items-center justify-center animate-pulse">
                <div className="text-accent-electric font-data-mono text-[10px] absolute -top-7 left-0 bg-background/90 px-2 py-1 border border-accent-electric/40 rounded">
                  OBJECT: PEDESTRIAN_01 [14.2m]
                </div>
                <div className="w-4 h-4 bg-accent-electric/30 rounded-full"></div>
              </div>

              <div className="absolute bottom-1/3 right-1/3 w-48 h-24 border-2 border-cyan-glow/60 rounded-xl flex items-center justify-center">
                <div className="text-cyan-glow font-data-mono text-[10px] absolute -top-7 left-0 bg-background/90 px-2 py-1 border border-cyan-glow/40 rounded">
                  VEHICLE: EV_GT9 [45.8m] | 82 KM/H
                </div>
              </div>
            </div>
          </div>

          {/* Hero Content */}
          <div className="relative z-10 w-full px-6 md:px-12 max-w-container-max mx-auto">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-surface-container-high/70 border border-outline-variant px-4 py-1.5 rounded-full mb-8 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-accent-electric animate-pulse"></span>
                <span className="font-label-caps text-on-surface-variant text-xs tracking-[0.2em]">TACTICAL VISION SENSORS ONLINE</span>
              </div>

              <h2 className="font-display-lg text-4xl md:text-6xl font-extrabold text-on-surface mb-6 leading-tight uppercase tracking-tight">
                Drive Safer <span className="text-accent-electric">at Night</span>
              </h2>

              <p className="font-body-base text-on-surface-variant text-base md:text-xl mb-10 max-w-xl leading-relaxed">
                Precision AI-powered vision system designed to detect hazards, predict collisions, and alert drivers before accidents occur. Enhance night road awareness with real-time tactical telemetry.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button
                  onClick={() => openAuth('login')}
                  className="w-full sm:w-auto bg-on-surface text-background px-10 py-5 rounded-xl font-label-caps text-xs font-bold hover:bg-white transition-all active:scale-95 duration-100 flex items-center justify-center gap-3 ambient-glow uppercase tracking-wider"
                >
                  <span>Launch Driver Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openAuth('register')}
                  className="w-full sm:w-auto bg-transparent text-on-surface px-10 py-5 rounded-xl font-label-caps text-xs font-bold border border-outline hover:bg-surface-container-high transition-all active:scale-95 duration-100 flex items-center justify-center gap-3 uppercase tracking-wider"
                >
                  <span>Create Account</span>
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-12 flex items-center gap-6">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-on-surface-variant font-label-caps text-xs hover:text-accent-electric transition-colors flex items-center gap-2 group uppercase tracking-wider"
                >
                  <span>Explore Demo Features</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Bento Grid */}
        <section className="py-24 px-6 md:px-12 bg-surface border-t border-outline-variant">
          <div className="max-w-container-max mx-auto space-y-12">
            <div className="text-center max-w-xl mx-auto space-y-3">
              <span className="font-label-caps text-accent-electric text-xs tracking-widest uppercase">ENGINEERING SPECIFICATIONS</span>
              <h3 className="text-3xl font-bold text-white uppercase tracking-tight">Tactical AI Core Architecture</h3>
              <p className="text-sm text-on-surface-variant">Designed to mirror high-end automotive ADAS cockpits with zero-latency computer vision.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Tech Specs Card */}
              <div className="md:col-span-8 card-premium p-8 rounded-2xl flex flex-col justify-between group">
                <div>
                  <span className="font-label-caps text-accent-electric text-xs block mb-3 uppercase tracking-wider">NEURAL ENGINE</span>
                  <h4 className="font-headline-md text-2xl font-bold text-on-surface mb-3">Tactical Neural Core V4.2</h4>
                  <p className="font-body-base text-on-surface-variant max-w-lg leading-relaxed text-sm">
                    Processes over 1,200 telemetry data points per millisecond. Enhances low-light video feeds using CLAHE histogram filters while running YOLO object detection and Time-To-Collision (TTC) calculations concurrently.
                  </p>
                </div>

                <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-outline-variant/40">
                  <div>
                    <div className="text-on-surface font-data-mono text-2xl font-bold">0.05s</div>
                    <div className="text-on-surface-variant font-label-caps text-[10px] uppercase tracking-wider">REACTION TIME</div>
                  </div>
                  <div>
                    <div className="text-on-surface font-data-mono text-2xl font-bold">4K UHD</div>
                    <div className="text-on-surface-variant font-label-caps text-[10px] uppercase tracking-wider">CAMERA INPUT</div>
                  </div>
                  <div>
                    <div className="text-on-surface font-data-mono text-2xl font-bold">16+</div>
                    <div className="text-on-surface-variant font-label-caps text-[10px] uppercase tracking-wider">HAZARD CLASSES</div>
                  </div>
                  <div>
                    <div className="text-on-surface font-data-mono text-2xl font-bold">EAR 0.2</div>
                    <div className="text-on-surface-variant font-label-caps text-[10px] uppercase tracking-wider">DROWSINESS CHECK</div>
                  </div>
                </div>
              </div>

              {/* Thermal Vision Sample Card */}
              <div className="md:col-span-4 card-premium p-0 rounded-2xl overflow-hidden relative group min-h-[300px]">
                <img
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 absolute inset-0"
                  alt="NightVision Thermal Suite"
                  src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent p-6 flex flex-col justify-end">
                  <span className="font-label-caps text-accent-electric text-[10px] tracking-wider uppercase mb-1">THERMAL SUITE</span>
                  <h4 className="font-headline-md text-xl font-bold text-on-surface">Monocular Distance & Lane Matrix</h4>
                  <p className="text-xs text-on-surface-variant mt-2">Real-time distance triangulation calculating Time-To-Collision in meters.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialMode={authMode} />
    </div>
  );
};
