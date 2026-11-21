// audio.js — synthesized sound effects with WebAudio. No audio files:
// every sound is an oscillator / noise burst made at runtime.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopEngine();
    return this.muted;
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol || 0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch (e) {}
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = vol || 0.15;
      let node = src;
      if (lowpass) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpass;
        src.connect(filter);
        node = filter;
      }
      node.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t);
    } catch (e) {}
  }

  gunshot() {
    this.noise(0.12, 0.22, 1800);
    this.blip(160, 0.08, 'square', 0.1);
  }

  punch() {
    this.noise(0.08, 0.18, 700);
  }

  crash() {
    this.noise(0.25, 0.25, 500);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.1);
    setTimeout(() => this.blip(880, 0.12, 'sine', 0.1), 70);
  }

  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.12), i * 110));
  }

  wantedUp() {
    this.blip(220, 0.12, 'sawtooth', 0.09);
    setTimeout(() => this.blip(175, 0.18, 'sawtooth', 0.09), 100);
  }

  startEngine(driving) {
    if (!this.ctx || this.muted || !driving) {
      this.stopEngine();
      return;
    }
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 60;
        this.engineGain.gain.value = 0.0;
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
      }
    } catch (e) {}
  }

  setEngine(speedRatio) {
    if (this.engineOsc && this.engineGain) {
      this.engineOsc.frequency.value = 55 + speedRatio * 140;
      this.engineGain.gain.value = this.muted ? 0 : 0.02 + speedRatio * 0.035;
    }
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
      } catch (e) {}
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  siren(active, dt) {
    if (!this.ctx || this.muted || !active) {
      if (this.sirenOsc) {
        try {
          this.sirenOsc.stop();
        } catch (e) {}
        this.sirenOsc = null;
        this.sirenGain = null;
      }
      return;
    }
    try {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'sine';
        this.sirenGain.gain.value = 0.035;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.ctx.destination);
        this.sirenOsc.start();
        this.sirenTimer = 0;
      }
      this.sirenTimer += dt;
      const phase = Math.floor(this.sirenTimer / 0.45) % 2;
      this.sirenOsc.frequency.value = phase === 0 ? 720 : 960;
    } catch (e) {}
  }
}
