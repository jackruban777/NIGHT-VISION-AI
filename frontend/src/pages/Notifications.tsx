import React, { useState } from 'react';
import { Bell, AlertTriangle, ShieldAlert, Info, Trash2, CheckCircle } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'critical' | 'warning' | 'info';
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    title: 'CRITICAL: Pedestrian Crossing Ahead',
    message: 'Pedestrian detected in low-light zone at 14.2m distance. Automated collision warning issued.',
    time: '12:04:22 PM',
    type: 'critical',
    read: false,
  },
  {
    id: 'n2',
    title: 'WARNING: Driver Drowsiness Detected',
    message: 'Eye aspect ratio dropped below 0.20 threshold. Auditory wake-up alert dispatched.',
    time: '11:45:10 PM',
    type: 'warning',
    read: false,
  },
  {
    id: 'n3',
    title: 'INFO: Night CLAHE Enhancement Activated',
    message: 'Optical sensors transitioned to high contrast night mode due to reduced ambient illumination.',
    time: '10:15:00 PM',
    type: 'info',
    read: true,
  },
  {
    id: 'n4',
    title: 'WARNING: Stray Animal near Roadway',
    message: 'Unidentified animal detected near right shoulder at 28.4m.',
    time: '09:50:18 PM',
    type: 'warning',
    read: true,
  },
];

export const NotificationsPage: React.FC = () => {
  const [items, setItems] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const filtered = items.filter((item) => (filter === 'all' ? true : item.type === filter));

  const markAllAsRead = () => {
    setItems(items.map((i) => ({ ...i, read: true })));
  };

  const clearAll = () => {
    setItems([]);
  };

  return (
    <div className="p-6 md:p-8 max-w-container-max mx-auto space-y-6">
      
      {/* Page Title Header */}
      <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <Bell className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-white">Hazard Alert & Notification Center</h2>
            <p className="text-xs text-on-surface-variant font-data-mono">Tactical Log of AI Detections & System Warnings</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-xs text-white font-bold rounded-xl font-label-caps uppercase flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" /> Mark All Read
          </button>
          <button
            onClick={clearAll}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs text-red-400 font-bold rounded-xl font-label-caps uppercase flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Clear Audit Log
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-3">
        {(['all', 'critical', 'warning', 'info'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-2 rounded-xl text-xs font-label-caps uppercase tracking-wider transition-all ${
              filter === t
                ? 'bg-accent-electric text-black font-bold'
                : 'bg-surface-container text-on-surface-variant hover:text-white border border-outline-variant/40'
            }`}
          >
            {t} Notifications
          </button>
        ))}
      </div>

      {/* Notification Cards List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card-premium text-center py-12 text-on-surface-variant text-sm italic">
            No notifications matching the selected filter.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`card-premium p-4 flex items-start gap-4 transition-all ${
                !item.read ? 'border-l-4 border-l-accent-electric bg-surface-container/60' : 'opacity-80'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  item.type === 'critical'
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : item.type === 'warning'
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    : 'bg-accent-electric/20 text-accent-electric border-accent-electric/40'
                }`}
              >
                {item.type === 'critical' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : item.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white uppercase">{item.title}</h3>
                  <span className="text-[11px] font-data-mono text-on-surface-variant">{item.time}</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">{item.message}</p>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
