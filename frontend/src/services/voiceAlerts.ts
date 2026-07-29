export type DistanceZone = 'safe' | 'caution' | 'warning' | 'critical';

class VoiceAlertService {
  private isMuted: boolean = false;
  private volume: number = 0.9;
  private lang: string = 'en-US';
  private lastAlertTime: Record<string, number> = {};
  private lastBeepTime: number = 0;
  private beepGapMs: number = 4000; // 4-second gap between beeps to avoid immediate noise
  private cooldownMs: number = 5000;

  constructor() {
    const mutedPref = localStorage.getItem('nv_voice_muted');
    if (mutedPref) this.isMuted = mutedPref === 'true';

    const volPref = localStorage.getItem('nv_voice_volume');
    if (volPref) this.volume = parseFloat(volPref);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('nv_voice_muted', String(muted));
    if (muted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
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

  /**
   * Plays a small, subtle audio beep tone with a guaranteed gap between beeps.
   */
  public playSubtleBeep() {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastBeepTime < this.beepGapMs) return;
    this.lastBeepTime = now;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
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
      // AudioContext fallback
    }
  }

  /**
   * Evaluates hazard distance for collision warning.
   */
  public evaluateHazard(
    objectId: string,
    objectClass: string,
    distanceMeters: number,
    confidence: number = 0.90
  ): { zone: DistanceZone; alertTriggered: boolean; message: string; isEmergency: boolean } {
    if (confidence < 0.80) {
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
      const isPedestrianOrAnimal = ['pedestrian', 'person', 'stray animal', 'animal', 'deer', 'dog'].includes(objectClass.toLowerCase());
      const warningText = isPedestrianOrAnimal
        ? `Go Slow! ${objectClass} crossing ahead, ${roundedDist} meters away!`
        : `Go Slow! ${objectClass} ahead, ${roundedDist} meters!`;
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
    let cooldown = 10000; // default 10s cooldown
    let force = false;

    if (level === 1) {
      alertText = customMessage || "Please stay attentive.";
      cooldown = 12000;
      force = false;
    } else if (level === 2) {
      alertText = customMessage || "You appear drowsy. Please take a break.";
      cooldown = 8000;
      force = true;
    } else if (level === 3) {
      alertText = customMessage || "Critical fatigue detected. Stop driving immediately.";
      cooldown = 5000;
      force = true;
    }

    this.speakWithCooldown(alertText, alertKey, cooldown, force);
  }

  public speakWithCooldown(text: string, key: string, cooldownMs: number, force: boolean = false) {
    if (this.isMuted) return;
    const now = Date.now();

    if (this.lastAlertTime[key] && now - this.lastAlertTime[key] < cooldownMs) {
      return;
    }

    this.lastAlertTime[key] = now;
    this.speak(text, key, force);
  }

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
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.volume;
    utterance.lang = this.lang;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  }
}

export const voiceAlerts = new VoiceAlertService();
