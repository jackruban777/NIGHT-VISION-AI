export type DistanceZone = 'safe' | 'caution' | 'warning' | 'critical';

export interface AlertQueueItem {
  text: string;
  key: string;
  force: boolean;
  timestamp: number;
}

class VoiceAlertService {
  private isMuted: boolean = false;
  private volume: number = 1.0; // Default full volume
  private lang: string = 'en-US';
  private lastAlertTime: Record<string, number> = {};
  private lastBeepTime: number = 0;
  private beepGapMs: number = 2500;
  private cooldownMs: number = 4000;
  private queue: AlertQueueItem[] = [];
  private isSpeaking: boolean = false;
  private audioCtx: AudioContext | null = null;
  private isAudioUnlocked: boolean = false;

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
   * Initializes and unlocks AudioContext & SpeechSynthesis on any user gesture.
   */
  private initAudioPermissionsRecovery() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.unlockAudioContext();
    };

    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('mousedown', unlock);
  }

  public unlockAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass && !this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      if ('speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        // Force-load voices
        window.speechSynthesis.getVoices();
      }
      this.isAudioUnlocked = true;
    } catch (err) {
      console.warn('[VoiceAlerts] Audio unlock notice:', err);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('nv_voice_muted', String(muted));
    if (muted) {
      this.clearQueue();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      this.unlockAudioContext();
      this.playChime('beep');
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
   * Guaranteed Web Audio API Harmonic Chime Generator.
   * Plays audible warning tones independently of SpeechSynthesis.
   */
  private lastChimeTime: Record<string, number> = {};

  /**
   * Guaranteed Web Audio API Single-Tone Generator.
   * Plays a single short audible tone ONCE per alert trigger (no continuous looping).
   */
  public playChime(type: 'beep' | 'warning' | 'drowsy' | 'critical' | 'emergency') {
    if (this.isMuted) return;
    const nowMs = Date.now();

    // Prevent continuous ring tones (4s minimum gap per chime type)
    if (this.lastChimeTime[type] && nowMs - this.lastChimeTime[type] < 4000) {
      return;
    }
    this.lastChimeTime[type] = nowMs;

    this.unlockAudioContext();

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = this.audioCtx || new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.2 * this.volume, now);
      masterGain.connect(ctx.destination);

      // Single short 0.15s tone per alert
      const freqMap = {
        beep: 880,
        warning: 659.25,
        drowsy: 783.99,
        critical: 1046.50,
        emergency: 1318.51,
      };

      const osc = ctx.createOscillator();
      osc.type = type === 'critical' || type === 'emergency' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freqMap[type] || 880, now);
      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (err) {
      console.warn('[VoiceAlerts] Web Audio chime playback notice:', err);
    }
  }

  public playSubtleBeep() {
    const now = Date.now();
    if (now - this.lastBeepTime < this.beepGapMs) return;
    this.lastBeepTime = now;
    this.playChime('beep');
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
      this.playChime('emergency');
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
    let cooldown = 6000;
    let force = false;

    if (level === 1) {
      alertText = customMessage || "Please stay attentive.";
      cooldown = 8000;
      force = false;
      this.playChime('warning');
    } else if (level === 2) {
      alertText = customMessage || "You appear drowsy. Please take a short break.";
      cooldown = 5000;
      force = true;
      this.playChime('drowsy');
    } else if (level === 3) {
      alertText = customMessage || "Critical fatigue detected. Please stop the vehicle immediately.";
      cooldown = 3000;
      force = true;
      this.playChime('critical');
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
   * Triggers an immediate audio test chime + text to speech confirmation.
   */
  public testAudio() {
    this.setMuted(false);
    this.unlockAudioContext();
    this.playChime('critical');
    this.speak("NightVision AI Voice Alert System Operational", "test_audio_key", true);
  }

  /**
   * Queues or forces spoken alerts into the non-overlapping speech queue.
   */
  public speak(text: string, key?: string, force: boolean = false) {
    if (this.isMuted) return;
    this.unlockAudioContext();

    const alertKey = key || text;
    const now = Date.now();

    if (!force && this.lastAlertTime[alertKey] && now - this.lastAlertTime[alertKey] < this.cooldownMs) {
      return;
    }

    this.lastAlertTime[alertKey] = now;

    if (force) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
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

    if (!('speechSynthesis' in window)) {
      console.warn('[VoiceAlerts] Speech synthesis API unavailable in this browser.');
      this.clearQueue();
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.isSpeaking = true;

    try {
      // Resume speech synthesis if browser paused it
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.volume = this.volume;
      utterance.lang = this.lang;
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith(this.lang.substring(0, 2)) &&
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Microsoft') || v.name.includes('Zira') || v.name.includes('David'))
      ) || voices.find(v => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        this.processQueue();
      };

      utterance.onerror = (e) => {
        console.warn('[VoiceAlerts] Speech synthesis utterance error:', e);
        this.isSpeaking = false;
        this.processQueue();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[VoiceAlerts] Speech dispatch error:', err);
      this.isSpeaking = false;
      this.processQueue();
    }
  }

  // Pre-configured explicit safety alert helper shortcuts
  public alertPedestrianAhead() { this.playChime('emergency'); this.speak("Pedestrian Ahead", "pedestrian_ahead", true); }
  public alertVehicleAhead() { this.playChime('warning'); this.speak("Vehicle Ahead", "vehicle_ahead", false); }
  public alertAnimalCrossing() { this.playChime('emergency'); this.speak("Animal Crossing", "animal_crossing", true); }
  public alertBrakeImmediately() { this.playChime('emergency'); this.speak("Brake Immediately", "brake_immediately", true); }
  public alertCollisionRisk() { this.playChime('emergency'); this.speak("Collision Risk Detected", "collision_risk", true); }
  public alertDriverDrowsiness() { this.playChime('drowsy'); this.speak("Driver Drowsiness Detected", "drowsiness_detected", true); }
  public alertPleaseWakeUp() { this.playChime('critical'); this.speak("Please Wake Up", "please_wake_up", true); }
  public alertKeepEyesOnRoad() { this.playChime('warning'); this.speak("Please Keep Your Eyes On The Road", "eyes_on_road", true); }
  public alertEmergencyStop() { this.playChime('critical'); this.speak("Emergency Stop Recommended", "emergency_stop", true); }
  public alertLowVisibility() { this.playChime('warning'); this.speak("Low Visibility Ahead", "low_visibility", false); }
  public alertLaneDeparture() { this.playChime('warning'); this.speak("Lane Departure Detected", "lane_departure", true); }
}

export const voiceAlerts = new VoiceAlertService();
