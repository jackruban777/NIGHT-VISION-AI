import React from 'react';
import { BarChart3, TrendingUp, ShieldCheck, Download, AlertTriangle, Eye, Calendar, Award } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';

const RISK_TREND_DATA = [
  { time: '22:00', riskScore: 18, detections: 42 },
  { time: '22:30', riskScore: 32, detections: 68 },
  { time: '23:00', riskScore: 64, detections: 112 },
  { time: '23:30', riskScore: 45, detections: 85 },
  { time: '00:00', riskScore: 78, detections: 140 },
  { time: '00:30', riskScore: 28, detections: 50 },
  { time: '01:00', riskScore: 22, detections: 34 },
];

const HAZARD_BREAKDOWN_DATA = [
  { name: 'Vehicles', count: 842, color: '#00E5FF' },
  { name: 'Pedestrians', count: 214, color: '#FFB300' },
  { name: 'Stray Animals', count: 86, color: '#FF5252' },
  { name: 'Potholes / Road Blocks', count: 64, color: '#C8C6C8' },
  { name: 'Traffic Cones', count: 42, color: '#958EA0' },
];

export const Analytics: React.FC = () => {
  const exportReport = () => {
    alert('Exporting Comprehensive NV AI Night Drive Safety Report (PDF)... File generated and saved.');
  };

  return (
    <div className="p-6 md:p-8 max-w-container-max mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <BarChart3 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-white">Drive Safety & Hazard Analytics</h2>
            <p className="text-xs text-on-surface-variant font-data-mono font-bold text-accent-electric">PEAK OBSTACLE WINDOW: 10:00 PM – 12:30 AM (Pedestrians & Animals)</p>
          </div>
        </div>

        <button
          onClick={exportReport}
          className="px-5 py-2.5 bg-accent-electric text-on-primary-fixed font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.25)]"
        >
          <Download className="w-4 h-4" /> Export PDF Report
        </button>
      </div>

      {/* Safety & Time Window Guidance Card */}
      <div className="p-4 bg-accent-amber/10 border border-accent-amber/30 rounded-xl flex items-start gap-3 text-xs text-on-surface-variant">
        <AlertTriangle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-accent-amber uppercase font-label-caps tracking-wider block mb-0.5">Telemetry Data Safety Analysis</span>
          <p className="text-white text-[11px] leading-relaxed">
            Telemetry data confirms <strong>68% of road obstacles</strong> (stray animals & unlit pedestrians) occur between <strong>10:00 PM and 12:30 AM</strong>. Drivers are strongly advised to keep Night CLAHE Vision Enhancement ON during these peak night windows.
          </p>
        </div>
      </div>

      {/* Safety Score Header Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="card-premium p-5 space-y-2 border-l-4 border-emerald-400">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-label-caps uppercase">
            <span>Overall Safety Score</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-data-mono">92 / 100</div>
          <p className="text-[11px] text-emerald-400 font-data-mono">Top 5% Safe Driver Index</p>
        </div>

        <div className="card-premium p-5 space-y-2 border-l-4 border-accent-electric">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-label-caps uppercase">
            <span>Total Detections</span>
            <Eye className="w-4 h-4 text-accent-electric" />
          </div>
          <div className="text-3xl font-extrabold text-white font-data-mono">1,248</div>
          <p className="text-[11px] text-on-surface-variant font-data-mono">Across 3 Night Trips</p>
        </div>

        <div className="card-premium p-5 space-y-2 border-l-4 border-accent-amber">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-label-caps uppercase">
            <span>Critical Warnings</span>
            <AlertTriangle className="w-4 h-4 text-accent-amber" />
          </div>
          <div className="text-3xl font-extrabold text-white font-data-mono">4 Alerts</div>
          <p className="text-[11px] text-accent-amber font-data-mono">100% Collision Avoided</p>
        </div>

        <div className="card-premium p-5 space-y-2 border-l-4 border-purple-400">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-label-caps uppercase">
            <span>Average Night Speed</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-data-mono">76.4 <span className="text-xs font-normal text-on-surface-variant">km/h</span></div>
          <p className="text-[11px] text-on-surface-variant font-data-mono">Optimal Speed Margin</p>
        </div>

      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Risk Trend Area Chart (Col 8) */}
        <div className="lg:col-span-8 card-premium space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/40 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent-electric">Collision Risk Trend Over Time</h3>
            <span className="text-[10px] font-data-mono text-on-surface-variant">24-Hour Telemetry</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={RISK_TREND_DATA}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00E5FF" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#202124" />
                <XAxis dataKey="time" stroke="#8e9192" fontSize={11} tickLine={false} />
                <YAxis stroke="#8e9192" fontSize={11} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1B1B1D', borderColor: '#202124', borderRadius: '12px', color: '#fff' }}
                  labelStyle={{ color: '#00E5FF', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="riskScore" stroke="#00E5FF" strokeWidth={3} fillOpacity={1} fill="url(#riskGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hazard Breakdown Bar Chart (Col 4) */}
        <div className="lg:col-span-4 card-premium space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/40 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Hazard Categories</h3>
            <span className="text-[10px] font-data-mono text-on-surface-variant">Class Frequency</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HAZARD_BREAKDOWN_DATA} layout="vertical">
                <XAxis type="number" stroke="#8e9192" fontSize={10} hide />
                <YAxis dataKey="name" type="category" stroke="#e5e2e1" fontSize={10} width={110} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1B1B1D', borderColor: '#202124', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#00E5FF" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
