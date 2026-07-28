import React from 'react';
import { useEmergency } from '../context/EmergencyContext';
import { AlertTriangle, Phone, MapPin, X, ShieldAlert, CheckCircle } from 'lucide-react';

export const EmergencyModal: React.FC = () => {
  const { isSOSActive, sosCountdown, cancelSOS, contacts, currentLocation } = useEmergency();

  if (!isSOSActive && sosCountdown === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg card-premium border-2 border-red-500/80 shadow-[0_0_50px_rgba(255,82,82,0.4)] p-6 md:p-8">
        
        {sosCountdown !== null ? (
          /* Countdown State */
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-wider text-red-400">Emergency SOS Initiated</h2>
              <p className="text-sm text-on-surface-variant mt-1">Automatic emergency call & location broadcast will execute in</p>
            </div>

            <div className="text-6xl font-bold font-data-mono text-white my-4 animate-bounce">
              00:0{sosCountdown}
            </div>

            <p className="text-xs text-on-surface-variant">Press CANCEL below if this is a false alarm.</p>

            <button
              onClick={cancelSOS}
              className="w-full py-4 bg-surface-container-high hover:bg-surface-bright text-white font-bold rounded-xl font-label-caps text-sm uppercase tracking-wider transition-all border border-outline"
            >
              Cancel SOS Dispatch
            </button>
          </div>
        ) : (
          /* Active SOS Broadcast State */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-outline-variant pb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 pip-active"></div>
                <h2 className="text-xl font-bold uppercase tracking-wide text-red-500 flex items-center gap-2">
                  <ShieldAlert className="w-6 h-6" /> SOS BROADCAST ACTIVE
                </h2>
              </div>
              <button onClick={cancelSOS} className="p-2 text-on-surface-variant hover:text-white rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs text-red-300 font-data-mono">
                <span>STATUS: INCIDENT TRANSMITTING</span>
                <span>LTE-V2X ENCRYPTED</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-white">
                <MapPin className="w-5 h-5 text-accent-electric shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">{currentLocation.address}</div>
                  <div className="text-xs font-data-mono text-on-surface-variant">
                    Coordinates: {currentLocation.lat}° N, {currentLocation.lng}° W
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase text-accent-electric tracking-wider mb-3">Notified Emergency Contacts</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant/30 text-xs">
                    <div>
                      <div className="font-semibold text-white">{contact.name} ({contact.relationship})</div>
                      <div className="text-on-surface-variant font-data-mono">{contact.phone}</div>
                    </div>
                    <span className="flex items-center gap-1 text-emerald-400 font-data-mono text-[10px]">
                      <CheckCircle className="w-3.5 h-3.5" /> ALERTED
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => alert("Connecting direct voice line to Emergency Dispatch (911)...")}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" /> Call 911 Direct
              </button>
              <button
                onClick={cancelSOS}
                className="px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold rounded-xl text-xs uppercase tracking-wider border border-outline-variant"
              >
                Deactivate
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
