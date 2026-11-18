// Sound, all synthesized with WebAudio: the engine, the sirens, the gunshots
// and a little bassline on the radio. No audio files anywhere.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let noiseBuffer = null;
  let radioOn = false;
  let musicStep = 0;
  let musicTimer = 0;
  let sirenPhase = 0;

  // A minor-key bassline for the radio (A1 C2 E2 G1, 112 BPM).
  const BASS = [55, 55, 65.41, 55, 82.41, 65.41, 55, 49];

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineOsc.connect(engineFilter).connect(engineGain).connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, filterFreq, vol = 0.3) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  return {
    start() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setEngine(speedRatio, throttle) {
      if (!ctx) return;
      engineOsc.frequency.value = 55 + speedRatio * 150 + throttle * 20;
      engineGain.gain.value = throttle > 0 || speedRatio > 0.05 ? 0.045 + throttle * 0.05 : 0.015;
    },
    setSiren(on, dt) {
      if (!ctx) return;
      if (!on) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenPhase += dt;
      sirenOsc.frequency.value = Math.floor(sirenPhase * 2.2) % 2 === 0 ? 715 : 950;
      sirenGain.gain.value = 0.035;
    },
    shoot() { noise(0.14, 1400, 0.5); blip(160, 0.1, 'square', 0.2); },
    punch() { blip(90, 0.16, 'sine', 0.4); noise(0.08, 500, 0.25); },
    crash() { noise(0.3, 350, 0.5); },
    pickup() { blip(880, 0.09); blip(1318, 0.12, 'sine', 0.25, 0.09); },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.16, 'sine', 0.25, i * 0.11));
    },
    busted() {
      [392, 330, 262, 196].forEach((f, i) => blip(f, 0.22, 'triangle', 0.25, i * 0.16));
    },
    toggleRadio() {
      radioOn = !radioOn;
      return radioOn;
    },
    update(dt) {
      if (!ctx || !radioOn) return;
      musicTimer += dt;
      const stepDur = 60 / 112 / 2;
      while (musicTimer >= stepDur) {
        musicTimer -= stepDur;
        const note = BASS[musicStep % BASS.length];
        blip(note, stepDur * 0.95, 'square', 0.07);
        if (musicStep % 2 === 0) noise(0.03, 6000, 0.05);
        musicStep += 1;
      }
    },
  };
}
