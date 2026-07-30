const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://nightvision-backend.onrender.com/api/v1';
const DIRECT_BACKEND_URL = 'http://localhost:8000/api/v1';

export interface DetectionResult {
  fps: number;
  camera_fps?: number;
  ai_fps?: number;
  inference_time_ms?: number;
  tracking_time_ms?: number;
  model_name?: string;
  device?: string;
  resolution?: string;
  active_objects_count?: number;
  night_enhance_applied: boolean;
  overall_risk: 'Low' | 'Medium' | 'High' | 'Critical';
  detections: {
    id: string;
    track_id?: number | null;
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
  zero_detections_reason?: string;
  telemetry?: {
    cpu_usage_pct: number;
    ram_usage_pct: number;
    latency_ms: number;
    tracking_ms?: number;
  };
  night_vision?: {
    enhancement_model: string;
    mode: string;
    luminance: number;
    enhancement_ms: number;
    detection_fps: number;
  };
}

export const apiService = {
  // AI Detection Endpoint
  analyzeFrame: async (imageBlob: Blob, nightEnhance: boolean = true, nightVisionMode: string = 'Auto'): Promise<DetectionResult | null> => {
    try {
      const formData = new FormData();
      formData.append('file', imageBlob, 'frame.jpg');
      
      const params = new URLSearchParams({
        night_enhance: String(nightEnhance),
        night_vision_mode: nightVisionMode,
      });

      let res = await fetch(`${API_BASE_URL}/ai/detect?${params}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        // Fallback to direct backend URL if proxy returns error
        res = await fetch(`${DIRECT_BACKEND_URL}/ai/detect?${params}`, {
          method: 'POST',
          body: formData,
        });
      }

      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      try {
        const formData = new FormData();
        formData.append('file', imageBlob, 'frame.jpg');
        const params = new URLSearchParams({
          night_enhance: String(nightEnhance),
          night_vision_mode: nightVisionMode,
        });
        const res = await fetch(`${DIRECT_BACKEND_URL}/ai/detect?${params}`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) return null;
        return await res.json();
      } catch (err) {
        return null;
      }
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
