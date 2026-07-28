import React, { createContext, useContext, useState, useEffect } from 'react';
import { voiceAlerts } from '../services/voiceAlerts';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  notifyOnSOS: boolean;
}

interface EmergencyContextType {
  isSOSActive: boolean;
  sosCountdown: number | null;
  contacts: EmergencyContact[];
  triggerSOS: () => void;
  cancelSOS: () => void;
  addContact: (contact: Omit<EmergencyContact, 'id'>) => void;
  removeContact: (id: string) => void;
  currentLocation: { lat: number; lng: number; address: string };
}

const EmergencyContext = createContext<EmergencyContextType | undefined>(undefined);

const INITIAL_CONTACTS: EmergencyContact[] = [
  { id: 'c1', name: 'Sarah Mercer', relationship: 'Spouse', phone: '+1 (555) 234-5678', notifyOnSOS: true },
  { id: 'c2', name: 'Highway Patrol Emergency Dispatch', relationship: 'Service', phone: '911', notifyOnSOS: true },
  { id: 'c3', name: 'NV AI Roadside Assistance', relationship: 'Support', phone: '+1 (800) 555-NVAI', notifyOnSOS: true },
];

export const EmergencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>(INITIAL_CONTACTS);

  const currentLocation = {
    lat: 37.7749,
    lng: -122.4194,
    address: 'Highway 101 North, Mile Marker 42.8',
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (sosCountdown !== null && sosCountdown > 0) {
      voiceAlerts.speak(`Emergency SOS activated. Dispatching in ${sosCountdown} seconds.`, 'sos_count', true);
      timer = setTimeout(() => {
        setSosCountdown(sosCountdown - 1);
      }, 1000);
    } else if (sosCountdown === 0) {
      setIsSOSActive(true);
      setSosCountdown(null);
      voiceAlerts.speak('SOS Emergency alert dispatched. Emergency services and contacts notified.', 'sos_dispatched', true);
    }
    return () => clearTimeout(timer);
  }, [sosCountdown]);

  const triggerSOS = () => {
    setSosCountdown(5);
  };

  const cancelSOS = () => {
    setSosCountdown(null);
    setIsSOSActive(false);
    voiceAlerts.speak('SOS Emergency cancelled.', 'sos_cancelled', true);
  };

  const addContact = (contact: Omit<EmergencyContact, 'id'>) => {
    const newContact = { ...contact, id: `c_${Date.now()}` };
    setContacts([...contacts, newContact]);
  };

  const removeContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
  };

  return (
    <EmergencyContext.Provider
      value={{
        isSOSActive,
        sosCountdown,
        contacts,
        triggerSOS,
        cancelSOS,
        addContact,
        removeContact,
        currentLocation,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergency = () => {
  const context = useContext(EmergencyContext);
  if (!context) throw new Error('useEmergency must be used within EmergencyProvider');
  return context;
};
