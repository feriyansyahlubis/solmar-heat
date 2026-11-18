// WebAudio synth: engine, siren, effects, radio bassline. All headless-safe.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenT = 0;
  let radioOn = false;
  let radioTimer = null;
  let radioStep = 0;
  const BASS = [55, 55, 65.41, 55, 82.41, 65.41, 55, 49];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch (e) {
      return false;
    }
  }

  function start() {
    if (!ensure()) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 400;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(ctx.destination);
        engineOsc.start();
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 715;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(ctx.destination);
        sirenOsc.start();
      }
    } catch (e) { /* headless-safe */ }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  function noiseBurst(dur, vol) {
    if (!ctx) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol || 0.2;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch (e) { /* ignore */ }
  }

  function setEngine(speedRatio, throttle) {
    if (!ctx || !engineOsc) return;
    try {
      const r = Math.max(0, Math.min(1, speedRatio));
      engineOsc.frequency.value = 55 + r * 150;
      engineFilter.frequency.value = 300 + r * 900;
      engineGain.gain.value = throttle > 0 || r > 0.05 ? 0.05 + r * 0.05 : 0;
    } catch (e) { /* ignore */ }
  }

  function setSiren(on, dt) {
    if (!ctx || !sirenOsc) return;
    try {
      if (on) {
        sirenGain.gain.value = 0.045;
        sirenT += dt;
        if (sirenT > 0.45) {
          sirenT = 0;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.value = sirenHigh ? 950 : 715;
        }
      } else {
        sirenGain.gain.value = 0;
      }
    } catch (e) { /* ignore */ }
  }

  function shoot() {
    noiseBurst(0.12, 0.3);
    blip(220, 0.08, 'square', 0.12, 60);
  }

  function punch() {
    noiseBurst(0.08, 0.18);
  }

  function crash() {
    noiseBurst(0.3, 0.35);
    blip(90, 0.25, 'sine', 0.2, 40);
  }

  function pickup() {
    blip(880, 0.12, 'sine', 0.15);
    setTimeout(() => blip(1318, 0.18, 'sine', 0.15), 90);
  }

  function complete() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sine', 0.16), i * 110));
  }

  function busted() {
    [392, 311, 233].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.12), i * 160));
  }

  function radioNote() {
    if (!radioOn || !ctx) return;
    const freq = BASS[radioStep % BASS.length];
    radioStep++;
    blip(freq, 0.22, 'triangle', 0.14);
    blip(freq * 2, 0.1, 'sine', 0.05);
  }

  function toggleRadio() {
    radioOn = !radioOn;
    if (radioOn) {
      start();
      if (!radioTimer) radioTimer = setInterval(radioNote, 60000 / 112 / 2);
    } else if (radioTimer) {
      clearInterval(radioTimer);
      radioTimer = null;
    }
    return radioOn;
  }

  function update() {
    // Reserved for per-frame audio work.
  }

  return { start, setEngine, setSiren, shoot, punch, crash, pickup, complete, busted, toggleRadio, update };
}
