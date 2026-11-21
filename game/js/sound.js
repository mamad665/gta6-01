// Tiny WebAudio synth SFX — no audio files, everything generated.

export function createSound() {
  let ctx = null;
  let muted = false;
  let sirenNodes = null;

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, vol) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = vol || 0.2;
    s.connect(g); g.connect(c.destination); s.start();
  }
  return {
    unlock() { ac(); },
    toggleMute() { muted = !muted; if (muted) this.siren(false); return muted; },
    get muted() { return muted; },
    shoot() { noise(0.12, 0.25); tone(180, 0.1, 'square', 0.1, 60); },
    punch() { noise(0.08, 0.18); },
    pickup() { tone(660, 0.1, 'sine', 0.14); setTimeout(() => tone(880, 0.14, 'sine', 0.14), 90); },
    cash() { tone(523, 0.09, 'triangle', 0.16); setTimeout(() => tone(659, 0.09, 'triangle', 0.16), 80); setTimeout(() => tone(784, 0.16, 'triangle', 0.16), 160); },
    crash() { noise(0.25, 0.3); tone(90, 0.25, 'sawtooth', 0.14, 40); },
    busted() { tone(392, 0.2, 'square', 0.14); setTimeout(() => tone(311, 0.3, 'square', 0.14), 200); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.16), i * 110)); },
    siren(on) {
      if (on && !sirenNodes) {
        const c = ac(); if (!c) return;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = 700; g.gain.value = 0.03;
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = 0.8; lg.gain.value = 220;
        lfo.connect(lg); lg.connect(o.frequency);
        o.connect(g); g.connect(c.destination);
        o.start(); lfo.start();
        sirenNodes = { o, lfo, g };
      } else if (!on && sirenNodes) {
        try { sirenNodes.o.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
        sirenNodes = null;
      }
    },
  };
}
