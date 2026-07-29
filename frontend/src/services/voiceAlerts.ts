export type DistanceZone = 'safe' | 'caution' | 'warning' | 'critical';

export interface AlertQueueItem {
  text: string;
  key: string;
  force: boolean;
  timestamp: number;
}

class VoiceAlertService {
  private isMuted: boolean = false;
  private volume: number = 0.9;
  private lang: string = 'en-US';
  private lastAlertTime: Record<string, number> = {};
  private lastBeepTime: number = 0;
  private beepGapMs: number = 3000;
  private cooldownMs: number = 5000;
  private queue: AlertQueueItem[] = [];
  private isSpeaking: boolean = false;
  private audioCtx: AudioContext | null = null;

  constructor() {
    const mutedPref = localStorage.getItem('nv_voice_muted');
    if (mutedPref) this.isMuted = mutedPref === 'true';

    const volPref = localStorage.getItem('nv_voice_volume');
    if (volPref) this.volume = parseFloat(volPref);

    const langPref = localStorage.getItem('nv_voice_lang');
    if (langPref) this.lang = langPref;

    this.initAudioPermissionsRecovery();
  }

  /**
   * Automatically recovers audio playback if locked by browser autoplay policies.
   */
  private initAudioPermissionsRecovery() {
    if (typeof window === 'undefined') return;

    const unlockAudio = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass && !this.audioCtx) {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        if ('speechSynthesis' in window && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.warn('[VoiceAlerts] Audio recovery error:', err);
      }
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('nv_voice_muted', String(muted));
    if (muted) {
      this.clearQueue();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('nv_voice_volume', String(this.volume));
  }

  public getVolume(): number {
    return this.volume;
  }

  public setLanguage(lang: string) {
    this.lang = lang;
    localStorage.setItem('nv_voice_lang', lang);
  }

  public getLanguage(): string {
    return this.lang;
  }

  public clearQueue() {
    this.queue = [];
    this.isSpeaking = false;
  }

  /**
   * Plays a subtle warning beep tone.
   */
  public playSubtleBeep() {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastBeepTime < this.beepGapMs) return;
    this.lastBeepTime = now;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = this.audioCtx || new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('[VoiceAlerts] Beep audio context failed:', e);
    }
  }

  /**
   * Evaluates hazard distance for collision warning and immediate alerts.
   */
  public evaluateHazard(
    objectId: string,
    objectClass: string,
    distanceMeters: number,
    confidence: number = 0.90
  ): { zone: DistanceZone; alertTriggered: boolean; message: string; isEmergency: boolean } {
    if (confidence < 0.40) {
      return { zone: 'safe', alertTriggered: false, message: '', isEmergency: false };
    }

    let currentZone: DistanceZone = 'safe';
    if (distanceMeters < 15) {
      currentZone = 'critical';
    } else if (distanceMeters < 28) {
      currentZone = 'warning';
    } else if (distanceMeters < 45) {
      currentZone = 'caution';
    }

    const roundedDist = Math.round(distanceMeters);

    if (currentZone === 'critical') {
      const isPedestrian = ['person', 'pedestrian'].includes(objectClass.toLowerCase());
      const isAnimal = ['dog', 'cat', 'cow', 'sheep', 'goat', 'horse', 'deer', 'animal'].includes(objectClass.toLowerCase());

      let warningText = `Collision Risk Detected! Brake Immediately!`;
      if (isPedestrian) {
        warningText = `Pedestrian Ahead! Brake Immediately!`;
      } else if (isAnimal) {
        warningText = `Animal Crossing Ahead! Brake Immediately!`;
      } else {
        warningText = `Vehicle Ahead! ${objectClass} ${roundedDist} meters away!`;
      }

      const key = `${objectId}_goslow`;
      this.speak(warningText, key, true);

      return {
        zone: 'critical',
        alertTriggered: true,
        message: warningText,
        isEmergency: true,
      };
    }

    if (currentZone === 'caution' || currentZone === 'warning') {
      this.playSubtleBeep();
      const hudMsg = `${objectClass} in range: ${roundedDist}m`;
      return {
        zone: currentZone,
        alertTriggered: true,
        message: hudMsg,
        isEmergency: false,
      };
    }

    return { zone: 'safe', alertTriggered: false, message: '', isEmergency: false };
  }

  /**
   * 3-Tier Driver Monitoring System (DMS) Spoken Voice Alerts
   */
  public triggerDMSAlert(level: 1 | 2 | 3, customMessage?: string) {
    if (this.isMuted) return;

    let alertText = "";
    let alertKey = `dms_level_${level}`;
    let cooldown = 8000;
    let force = false;

    if (level === 1) {
      alertText = customMessage || "Please stay attentive.";
      cooldown = 10000;
      force = false;
    } else if (level === 2) {
      alertText = customMessage || "You appear drowsy. Please take a short break.";
      cooldown = 7000;
      force = true;
    } else if (level === 3) {
      alertText = customMessage || "Critical fatigue detected. Please stop the vehicle immediately.";
      cooldown = 4000;
      force = true;
    }

    this.speakWithCooldown(alertText, alertKey, cooldown, force);
  }

  /**
   * Enforces alert deduplication & cooldown before queuing speech.
   */
  public speakWithCooldown(text: string, key: string, cooldownMs: number, force: boolean = false) {
    if (this.isMuted) return;
    const now = Date.now();

    if (this.lastAlertTime[key] && now - this.lastAlertTime[key] < cooldownMs) {
      return;
    }

    this.lastAlertTime[key] = now;
    this.speak(text, key, force);
  }

  /**
   * Queues or forces spoken alerts into the non-overlapping speech queue.
   */
  public speak(text: string, key?: string, force: boolean = false) {
    if (this.isMuted) return;
    if (!('speechSynthesis' in window)) return;

    const alertKey = key || text;
    const now = Date.now();

    if (!force && this.lastAlertTime[alertKey] && now - this.lastAlertTime[alertKey] < this.cooldownMs) {
      return;
    }

    this.lastAlertTime[alertKey] = now;

    if (force) {
      window.speechSynthesis.cancel();
      this.clearQueue();
    }

    this.queue.push({ text, key: alertKey, force, timestamp: now });
    this.processQueue();
  }

  /**
   * Sequential non-overlapping speech queue processor.
   */
  private processQueue() {
    if (this.isSpeaking || this.queue.length === 0) return;
    if (this.isMuted) {
      this.clearQueue();
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.isSpeaking = true;

    try {
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.volume = this.volume;
      utterance.lang = this.lang;
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith(this.lang.substring(0, 2)) &&
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Microsoft'))
      ) || voices.find(v => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        this.processQueue();
      };

      utterance.onerror = (e) => {
        console.warn('[VoiceAlerts] Speech synthesis error:', e);
        this.isSpeaking = false;
        this.processQueue();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[VoiceAlerts] Speech dispatch failed:', err);
      this.isSpeaking = false;
      this.processQueue();
    }
  }

  // Pre-configured explicit safety alert helper shortcuts
  public alertPedestrianAhead() { this.speak("Pedestrian Ahead", "pedestrian_ahead", true); }
  public alertVehicleAhead() { this.speak("Vehicle Ahead", "vehicle_ahead", false); }
  public alertAnimalCrossing() { this.speak("Animal Crossing", "animal_crossing", true); }
  public alertBrakeImmediately() { this.speak("Brake Immediately", "brake_immediately", true); }
  public alertCollisionRisk() { this.speak("Collision Risk Detected", "collision_risk", true); }
  public alertDriverDrowsiness() { this.speak("Driver Drowsiness Detected", "drowsiness_detected", true); }
  public alertPleaseWakeUp() { this.speak("Please Wake Up", "please_wake_up", true); }
  public alertKeepEyesOnRoad() { this.speak("Please Keep Your Eyes On The Road", "eyes_on_road", true); }
  public alertEmergencyStop() { this.speak("Emergency Stop Recommended", "emergency_stop", true); }
  public alertLowVisibility() { this.speak("Low Visibility Ahead", "low_visibility", false); }
  public alertLaneDeparture() { this.speak("Lane Departure Detected", "lane_departure", true); }
}

export const voiceAlerts = new VoiceAlertService();
