import React, { useState } from 'react';
import { Navigation, Calendar, Clock, Download, MapPin, Eye, Search, ShieldCheck } from 'lucide-react';

interface TripLog {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  distance: string;
  duration: string;
  avgSpeed: string;
  maxSpeed: string;
  hazards: number;
  score: number;
  route: string;
  weather: string;
}

const SAMPLE_TRIPS: TripLog[] = [
  {
    id: 'trp_101',
    date: '2026-07-28',
    startTime: '21:30',
    endTime: '23:42',
    distance: '184.2 km',
    duration: '2h 12m',
    avgSpeed: '83.7 km/h',
    maxSpeed: '118.0 km/h',
    hazards: 42,
    score: 94,
    route: 'Highway 101 North → Bay Area Expressway',
    weather: 'Clear / Dry Road',
  },
  {
    id: 'trp_102',
    date: '2026-07-27',
    startTime: '22:15',
    endTime: '23:30',
    distance: '92.4 km',
    duration: '1h 15m',
    avgSpeed: '73.9 km/h',
    maxSpeed: '102.5 km/h',
    hazards: 28,
    score: 90,
    route: 'Suburban Highway Corridor 4',
    weather: 'Light Mist / Damp',
  },
  {
    id: 'trp_103',
    date: '2026-07-25',
    startTime: '20:00',
    endTime: '22:10',
    distance: '142.8 km',
    duration: '2h 10m',
    avgSpeed: '65.9 km/h',
    maxSpeed: '94.2 km/h',
    hazards: 68,
    score: 88,
    route: 'Mountain Pass Route 12',
    weather: 'Dense Fog / Wet Asphalt',
  },
];

export const TripHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<TripLog | null>(null);

  const filteredTrips = SAMPLE_TRIPS.filter(
    (t) => t.route.toLowerCase().includes(searchTerm.toLowerCase()) || t.date.includes(searchTerm)
  );

  const exportCSV = () => {
    alert('Exporting Trip History Data (CSV format)... Download complete.');
  };

  return (
    <div className="p-6 md:p-8 max-w-container-max mx-auto space-y-6">
      
      {/* Top Banner */}
      <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <Navigation className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-white">Trip Logs & Route Telemetry</h2>
            <p className="text-xs text-on-surface-variant font-data-mono">Recorded Night Drive Sessions & Safety Metrics</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search route or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface-container border border-outline-variant rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-accent-electric"
            />
          </div>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-white font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-accent-electric" /> Export CSV
          </button>
        </div>
      </div>

      {/* Trips Table Card */}
      <div className="card-premium p-0 overflow-hidden border border-outline-variant">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-surface-container-low border-b border-outline-variant font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="p-4">Date & Time</th>
                <th className="p-4">Route Path</th>
                <th className="p-4">Distance / Duration</th>
                <th className="p-4">Avg / Max Speed</th>
                <th className="p-4">Hazards</th>
                <th className="p-4">Safety Score</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-white">
              {filteredTrips.map((trip) => (
                <tr key={trip.id} className="hover:bg-surface-container-high/40 transition-colors">
                  <td className="p-4 font-data-mono">
                    <div className="font-bold">{trip.date}</div>
                    <div className="text-on-surface-variant text-[11px]">{trip.startTime} - {trip.endTime}</div>
                  </td>
                  <td className="p-4 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-accent-electric shrink-0" />
                      <span>{trip.route}</span>
                    </div>
                    <div className="text-[10px] text-on-surface-variant font-data-mono">{trip.weather}</div>
                  </td>
                  <td className="p-4 font-data-mono">
                    <div>{trip.distance}</div>
                    <div className="text-on-surface-variant text-[11px]">{trip.duration}</div>
                  </td>
                  <td className="p-4 font-data-mono">
                    <div>{trip.avgSpeed}</div>
                    <div className="text-on-surface-variant text-[11px]">Max: {trip.maxSpeed}</div>
                  </td>
                  <td className="p-4 font-data-mono font-bold text-accent-electric">
                    {trip.hazards} Detected
                  </td>
                  <td className="p-4 font-data-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">
                      {trip.score} / 100
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedTrip(trip)}
                      className="px-3 py-1.5 bg-accent-electric/10 hover:bg-accent-electric/20 text-accent-electric border border-accent-electric/30 rounded-lg text-xs font-label-caps uppercase"
                    >
                      Audit Log
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trip Audit Modal */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg card-premium p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <h3 className="text-lg font-bold text-white uppercase">{selectedTrip.route}</h3>
              <button onClick={() => setSelectedTrip(null)} className="text-on-surface-variant hover:text-white font-bold">✕</button>
            </div>
            <div className="space-y-2 text-xs font-data-mono">
              <div className="flex justify-between p-2 bg-surface-container rounded-lg">
                <span className="text-on-surface-variant">Date:</span>
                <span className="text-white font-bold">{selectedTrip.date}</span>
              </div>
              <div className="flex justify-between p-2 bg-surface-container rounded-lg">
                <span className="text-on-surface-variant">Distance & Duration:</span>
                <span className="text-white font-bold">{selectedTrip.distance} ({selectedTrip.duration})</span>
              </div>
              <div className="flex justify-between p-2 bg-surface-container rounded-lg">
                <span className="text-on-surface-variant">Hazards Flagged:</span>
                <span className="text-accent-electric font-bold">{selectedTrip.hazards} Objects</span>
              </div>
              <div className="flex justify-between p-2 bg-surface-container rounded-lg">
                <span className="text-on-surface-variant">Safety Evaluation:</span>
                <span className="text-emerald-400 font-bold">{selectedTrip.score}% Score</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedTrip(null)}
              className="w-full py-3 bg-accent-electric text-black font-bold rounded-xl font-label-caps text-xs uppercase"
            >
              Close Telemetry Audit
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
