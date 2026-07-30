export type DistanceZone = 'safe' | 'caution' | 'warning' | 'critical';

export interface AlertQueueItem {
  text: string;
  key: string;
  force: boolean;
  timestamp: number;
}

class VoiceAlertService {
  private isMuted: boolean = false;
  private volume: number = 1.0;
  private lang: string = 'en-US';
  private lastAlertTime: Record<string, number> = {};
  private cooldownMs: number = 6000; // 6s global cooldown per unique key

  // Speech queue
  private queue: AlertQueueItem[] = [];
  private isSpeaking: boolean = false;

  // Audio context (only for DMS alerts, NOT for object detections)
  private audioCtx: AudioContext | null = null;
  private isAudioUnlocked: boolean = false;

  // Chime cooldown (4s per type) — only used for DMS alerts
  private lastChimeTime: Record<string, number> = {};

  constructor() {
    const mutedPref = localStorage.getItem('nv_voice_muted');
    if (mutedPref) this.isMuted = mutedPref === 'true';

    const volPref = localStorage.getItem('nv_voice_volume');
    if (volPref) this.volume = parseFloat(volPref);

    const langPref = localStorage.getItem('nv_voice_lang');
    if (langPref) this.lang = langPref;

    this.initAudioPermissionsRecovery();
  }

  private initAudioPermissionsRecovery() {
    if (typeof window === 'undefined') return;
    const unlock = () => this.unlockAudioContext();
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
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
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
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } else {
      this.unlockAudioContext();
    }
  }

  public getIsMuted(): boolean { return this.isMuted; }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('nv_voice_volume', String(this.volume));
  }

  public getVolume(): number { return this.volume; }

  public setLanguage(lang: string) {
    this.lang = lang;
    localStorage.setItem('nv_voice_lang', lang);
  }

  public getLanguage(): string { return this.lang; }

  public clearQueue() {
    this.queue = [];
    this.isSpeaking = false;
  }

  /**
   * Web Audio API Single-Tone chime.
   * ONLY used for DMS (Driver Monitoring) alerts, NOT for object detections.
   * 4-second per-type cooldown to prevent continuous ringing.
   */
  public playChime(type: 'beep' | 'warning' | 'drowsy' | 'critical' | 'emergency') {
    if (this.isMuted) return;
    const nowMs = Date.now();

    if (this.lastChimeTime[type] && nowMs - this.lastChimeTime[type] < 4000) return;
    this.lastChimeTime[type] = nowMs;

    this.unlockAudioContext();
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = this.audioCtx || new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.18 * this.volume, now);
      masterGain.connect(ctx.destination);

      const freqMap: Record<string, number> = {
        beep: 880, warning: 659.25, drowsy: 783.99, critical: 1046.50, emergency: 1318.51,
      };
      const osc = ctx.createOscillator();
      osc.type = (type === 'critical' || type === 'emergency') ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freqMap[type] || 880, now);
      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (err) {
      console.warn('[VoiceAlerts] Chime playback notice:', err);
    }
  }

  /**
   * Evaluates detected object for hazard zone and speaks:
   * "{Object} {distance} meters away" — NO beep, NO chime during detection.
   * Only speech for caution/warning/critical objects.
   * Strict per-object 10s cooldown to prevent constant re-announcements.
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
    const displayClass = objectClass.charAt(0).toUpperCase() + objectClass.slice(1).toLowerCase();

    if (currentZone === 'critical') {
      // Critical: speak immediately with 8s cooldown per object
      const key = `obj_${objectId}_critical`;
      const message = `${displayClass}, ${roundedDist} meters away`;
      this.speakWithCooldown(message, key, 8000, true);
      return { zone: 'critical', alertTriggered: true, message, isEmergency: true };
    }

    if (currentZone === 'warning') {
      // Warning: speak with 10s cooldown per object
      const key = `obj_${objectId}_warning`;
      const message = `${displayClass}, ${roundedDist} meters away`;
      this.speakWithCooldown(message, key, 10000, false);
      return { zone: 'warning', alertTriggered: true, message, isEmergency: false };
    }

    if (currentZone === 'caution') {
      // Caution: speak with 15s cooldown per object (low priority)
      const key = `obj_${objectId}_caution`;
      const message = `${displayClass}, ${roundedDist} meters away`;
      this.speakWithCooldown(message, key, 15000, false);
      return { zone: 'caution', alertTriggered: true, message, isEmergency: false };
    }

    return { zone: 'safe', alertTriggered: false, message: '', isEmergency: false };
  }

  /**
   * 3-Tier Driver Monitoring System (DMS) alerts — uses chime + speech.
   */
  public triggerDMSAlert(level: 1 | 2 | 3, customMessage?: string) {
    if (this.isMuted) return;

    let alertText = '';
    const alertKey = `dms_level_${level}`;
    let cooldown = 8000;

    if (level === 1) {
      alertText = customMessage || 'Please stay attentive.';
      cooldown = 10000;
      this.playChime('warning');
    } else if (level === 2) {
      alertText = customMessage || 'You appear drowsy. Please take a short break.';
      cooldown = 7000;
      this.playChime('drowsy');
    } else if (level === 3) {
      alertText = customMessage || 'Critical fatigue detected. Please stop the vehicle immediately.';
      cooldown = 5000;
      this.playChime('critical');
    }

    this.speakWithCooldown(alertText, alertKey, cooldown, level === 3);
  }

  public speakWithCooldown(text: string, key: string, cooldownMs: number, force: boolean = false) {
    if (this.isMuted) return;
    const now = Date.now();
    if (this.lastAlertTime[key] && now - this.lastAlertTime[key] < cooldownMs) return;
    this.lastAlertTime[key] = now;
    this.speak(text, key, force);
  }

  public testAudio() {
    this.setMuted(false);
    this.unlockAudioContext();
    this.playChime('warning');
    setTimeout(() => {
      this.speak('Night Vision AI Voice Alert System Operational.', 'test_audio_key', true);
    }, 300);
  }

  /**
   * Queues or forces spoken alerts. No beep accompanies object detection speech.
   */
  public speak(text: string, key?: string, force: boolean = false) {
    if (this.isMuted) return;
    this.unlockAudioContext();

    const alertKey = key || text;
    const now = Date.now();

    if (!force && this.lastAlertTime[alertKey] && now - this.lastAlertTime[alertKey] < this.cooldownMs) return;
    this.lastAlertTime[alertKey] = now;

    if (force) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      this.clearQueue();
    }

    // Limit queue depth to 2 items to prevent backlog
    if (this.queue.length >= 2) return;

    this.queue.push({ text, key: alertKey, force, timestamp: now });
    this.processQueue();
  }

  private processQueue() {
    if (this.isSpeaking || this.queue.length === 0) return;
    if (this.isMuted) { this.clearQueue(); return; }
    if (!('speechSynthesis' in window)) { this.clearQueue(); return; }

    const item = this.queue.shift();
    if (!item) return;

    this.isSpeaking = true;

    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.volume = this.volume;
      utterance.lang = this.lang;
      utterance.rate = 1.45; // Faster and snappier alerts
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(v =>
          v.lang.startsWith(this.lang.substring(0, 2)) &&
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') ||
           v.name.includes('Microsoft') || v.name.includes('Zira') || v.name.includes('David'))
        ) || voices.find(v => v.lang.startsWith('en'));

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = () => {
        this.isSpeaking = false;
        this.processQueue();
      };
      utterance.onerror = () => {
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

  // Safety alert helpers (no chime, only voice)
  public alertPedestrianAhead() { this.speakWithCooldown('Pedestrian ahead', 'pedestrian_ahead', 8000, true); }
  public alertVehicleAhead() { this.speakWithCooldown('Vehicle ahead', 'vehicle_ahead', 8000, false); }
  public alertAnimalCrossing() { this.speakWithCooldown('Animal crossing ahead', 'animal_crossing', 8000, true); }
  public alertBrakeImmediately() { this.speakWithCooldown('Brake immediately', 'brake_immediately', 5000, true); }
  public alertCollisionRisk() { this.speakWithCooldown('Collision risk detected', 'collision_risk', 5000, true); }
  public alertDriverDrowsiness() { this.triggerDMSAlert(2); }
  public alertPleaseWakeUp() { this.triggerDMSAlert(3); }
  public alertKeepEyesOnRoad() { this.speakWithCooldown('Please keep your eyes on the road', 'eyes_on_road', 10000, true); }
  public alertEmergencyStop() { this.speakWithCooldown('Emergency stop recommended', 'emergency_stop', 5000, true); }
  public alertLowVisibility() { this.speakWithCooldown('Low visibility ahead', 'low_visibility', 12000, false); }
  public alertLaneDeparture() { this.speakWithCooldown('Lane departure detected', 'lane_departure', 8000, true); }
  public playSubtleBeep() { /* no-op: no beeps during object detection */ }
}

export const voiceAlerts = new VoiceAlertService();
