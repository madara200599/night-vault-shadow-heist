// All sound is synthesized with WebAudio — no audio files. Soft footstep taps (the
// player's, and guards' when they are close, so your ears tell you where a watchman
// is), a coin's clink, a rising blip when a guard grows suspicious, a sting at full
// alarm, a chime for a lifted relic and a low vault hum underneath it all.

export function createAudio() {
  let context = null;
  let master = null;
  let humNodes = null;

  function ensure() {
    if (context !== null) return true;
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      context = null;
      return false;
    }
    return true;
  }

  function tone(freqFrom, freqTo, seconds, type, volume, when = 0) {
    if (!ensure()) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  function noiseTap(volume, seconds, filterFreq) {
    if (!ensure()) return;
    const t0 = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(master);
    source.start(t0);
  }

  return {
    unlock() { if (ensure() && context.state === 'suspended') context.resume(); },
    startHum() {
      if (!ensure() || humNodes !== null) return;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55;
      gain.gain.value = 0.035;
      osc.connect(gain).connect(context.destination);
      osc.start();
      humNodes = { osc, gain };
    },
    playerStep(crouched) { noiseTap(crouched ? 0.05 : 0.11, 0.07, crouched ? 500 : 800); },
    guardStep(strength) { noiseTap(0.02 + strength * 0.13, 0.08, 420); },
    coinToss() { tone(1900, 1500, 0.09, 'sine', 0.12); tone(2500, 2100, 0.12, 'sine', 0.1, 0.1); },
    coinLand() { tone(2700, 2300, 0.1, 'triangle', 0.16); tone(3400, 2900, 0.14, 'sine', 0.1, 0.05); },
    suspicious() { tone(620, 880, 0.14, 'triangle', 0.12); },
    spotted() { tone(220, 110, 0.35, 'sawtooth', 0.16); tone(440, 220, 0.3, 'square', 0.07, 0.02); },
    relic() { tone(880, 880, 0.1, 'sine', 0.14); tone(1320, 1320, 0.16, 'sine', 0.12, 0.08); },
    exitOpen() { tone(523, 523, 0.12, 'triangle', 0.12); tone(784, 784, 0.2, 'triangle', 0.12, 0.1); },
    caught() { tone(320, 60, 0.6, 'sawtooth', 0.2); noiseTap(0.2, 0.3, 300); },
    win() { tone(523, 523, 0.14, 'triangle', 0.13); tone(659, 659, 0.14, 'triangle', 0.13, 0.12); tone(784, 784, 0.26, 'triangle', 0.14, 0.24); },
    click() { tone(1200, 900, 0.05, 'sine', 0.07); },
  };
}
