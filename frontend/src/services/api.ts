const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface DetectionResult {
  fps: number;
  night_enhance_applied: boolean;
  overall_risk: 'Low' | 'Medium' | 'High' | 'Critical';
  detections: {
    id: string;
    class: string;
    confidence: number;
    bbox: [number, number, number, number];
    distance_m: number;
    risk: {
      distance_m: number;
      ttc_seconds: number;
      risk_level: string;
      collision_probability: number;
    };
  }[];
}

export const apiService = {
  // Auth Endpoints
  login: async (email: string, pass: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      return await res.json();
    } catch (e) {
      console.warn('Backend offline, using local auth fallback', e);
      return null;
    }
  },

  register: async (name: string, email: string, pass: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pass }),
      });
      return await res.json();
    } catch (e) {
      console.warn('Backend offline, using local auth fallback', e);
      return null;
    }
  },

  // AI Detection Endpoint
  analyzeFrame: async (imageBlob: Blob, nightEnhance: boolean = true): Promise<DetectionResult | null> => {
    try {
      const formData = new FormData();
      formData.append('file', imageBlob, 'frame.jpg');
      const res = await fetch(`${API_BASE_URL}/ai/detect?night_enhance=${nightEnhance}`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Trips Endpoint
  fetchTrips: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/trips/`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },
};
