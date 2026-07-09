export type AmbientId = 'rain' | 'forest' | 'ocean' | 'library' | 'wind' | 'piano' | 'white' | 'brown' | 'pink' | 'river' | 'meditation';

export const AMBIENT_TRACKS: { id: AmbientId; label: string; emoji: string; desc: string }[] = [
  { id: 'piano',      label: 'Soft Piano',  emoji: '🎹', desc: 'Warm classical loops' },
  { id: 'rain',       label: 'Gentle Rain',  emoji: '🌧️', desc: 'Micro droplets' },
  { id: 'meditation', label: 'Zen Ambient',  emoji: '🧘', desc: 'Warm cinematic pads' },
  { id: 'forest',     label: 'Forest',      emoji: '🌲', desc: 'Subtle woods & birds' },
  { id: 'ocean',      label: 'Ocean Waves', emoji: '🌊', desc: 'Rhythmic sea swells' },
  { id: 'river',      label: 'Flowing River',emoji: '💧', desc: 'Mineral stream bubbles' },
  { id: 'wind',       label: 'Soft Wind',   emoji: '🍃', desc: 'Mellow air drafts' },
  { id: 'library',    label: 'Library',     emoji: '📚', desc: 'Acoustic room tone' },
  { id: 'white',      label: 'White Noise', emoji: '🤍', desc: 'Clean focus static' },
  { id: 'brown',      label: 'Brown Noise', emoji: '🤎', desc: 'Deep warm rumblings' },
  { id: 'pink',       label: 'Pink Noise',  emoji: '💗', desc: 'Natural soft waterfall' },
];

export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private gainNode: GainNode | null = null;
  private intervals: any[] = [];

  start(id: AmbientId, vol = 0.4) {
    this.stop(); // Stops any active sound with smooth fade-out
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume if context is suspended due to browser autoplay policies
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.gainNode = this.ctx.createGain();
      // Start at 0 gain for smooth fade-in
      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);
      
      // Fade-in to target volume smoothly over 1.5 seconds
      this.gainNode.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 1.5);

      switch (id) {
        case 'rain':      this.makeRain(); break;
        case 'forest':    this.makeForest(); break;
        case 'ocean':     this.makeOcean(); break;
        case 'library':   this.makeLibrary(); break;
        case 'wind':      this.makeWind(); break;
        case 'piano':     this.makePiano(); break;
        case 'white':     this.makeNoise('white', 6000); break;
        case 'brown':     this.makeNoise('brown', 200); break;
        case 'pink':      this.makeNoise('pink', 500); break;
        case 'river':     this.makeRiver(); break;
        case 'meditation':this.makeMeditation(); break;
      }
    } catch (e) {
      console.error("Failed to start AmbientEngine:", e);
    }
  }

  private makeNoise(type: 'white' | 'pink' | 'brown', cutoff: number) {
    if (!this.ctx || !this.gainNode) return;
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;
      } else if (type === 'brown') {
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5;
      } else {
        data[i] = white;
      }
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);

    src.connect(filter);
    filter.connect(this.gainNode);
    src.start();
    this.nodes.push(src, filter);
  }

  private makeRain() {
    if (!this.ctx || !this.gainNode) return;
    // Layer 1: Pink noise low-pass filtered at 320Hz for heavy, roaring rain background
    this.makeNoise('pink', 320);

    // Layer 2: Intermittent high fidelity raindrop splatters
    const playRaindrop = () => {
      if (!this.ctx || !this.gainNode) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      const strikeFreq = 80 + Math.random() * 80;
      osc.frequency.setValueAtTime(strikeFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(this.gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        playRaindrop();
      }
    }, 150);
    this.intervals.push(interval);
  }

  private makeOcean() {
    if (!this.ctx || !this.gainNode) return;
    
    // Create soft ocean roar using pink noise
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;
    }
    
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, this.ctx.currentTime);
    
    const waveGain = this.ctx.createGain();
    waveGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    
    src.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(this.gainNode);
    src.start();
    this.nodes.push(src, filter, waveGain);

    // LFO: Sine wave at 0.08Hz to modulate wave swell amplitude listlessly
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime);
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    
    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);
    
    lfo.start();
    this.nodes.push(lfo, lfoGain);
  }

  private makeForest() {
    if (!this.ctx || !this.gainNode) return;
    
    // Layer 1: Rustling leaves pink noise background at 600Hz cutoff
    this.makeNoise('pink', 600);

    // Layer 2: Bird calling sounds
    const playChirp = () => {
      if (!this.ctx || !this.gainNode) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      const baseFreq = 2000 + Math.random() * 800;
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1300, this.ctx.currentTime + 0.18);
      
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      
      osc.connect(gain);
      gain.connect(this.gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.5) {
        playChirp();
        setTimeout(() => playChirp(), 150 + Math.random() * 100);
      }
    }, 6000);
    this.intervals.push(interval);
  }

  private makeLibrary() {
    if (!this.ctx || !this.gainNode) return;
    // Layer 1: Muffled, warm brown noise at 100Hz filter cutoff for room tone
    this.makeNoise('brown', 100);

    // Layer 2: Distance paper sliding/page flipping sound synthesis
    const triggerPageFlip = () => {
      if (!this.ctx || !this.gainNode) return;
      
      const bufferSize = this.ctx.sampleRate * 0.4;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const flipSrc = this.ctx.createBufferSource();
      flipSrc.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      filter.Q.setValueAtTime(4, this.ctx.currentTime);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
      
      flipSrc.connect(filter);
      filter.connect(gain);
      gain.connect(this.gainNode);
      
      flipSrc.start();
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        triggerPageFlip();
      }
    }, 10000);
    this.intervals.push(interval);
  }

  private makeWind() {
    if (!this.ctx || !this.gainNode) return;
    
    // Windy noise source using modulated pink noise
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;
    }
    
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);
    
    src.connect(filter);
    filter.connect(this.gainNode);
    src.start();
    this.nodes.push(src, filter);

    // LFO: Sine wave oscillator at 0.04Hz to produce whispering wind gusts
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.04, this.ctx.currentTime);
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(180, this.ctx.currentTime);
    
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    
    lfo.start();
    this.nodes.push(lfo, lfoGain);
  }

  private makePiano() {
    if (!this.ctx || !this.gainNode) return;
    
    // Peaceful Pentatonic scale to generate random ambient keystrokes
    const pentatonic = [196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00, 493.88, 587.33];
    let lastNoteIndex = -1;

    const playNote = () => {
      if (!this.ctx || !this.gainNode) return;
      
      let idx = Math.floor(Math.random() * pentatonic.length);
      while (idx === lastNoteIndex) {
        idx = Math.floor(Math.random() * pentatonic.length);
      }
      lastNoteIndex = idx;
      const freq = pentatonic[idx];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      // Fast soft attack, very slow elegant release decrescendo
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 2.8);
      
      osc.connect(gain);
      gain.connect(this.gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + 3.0);
    };

    playNote();
    const interval = setInterval(() => {
      playNote();
    }, 4000);
    this.intervals.push(interval);
  }

  private makeRiver() {
    if (!this.ctx || !this.gainNode) return;
    // Layer 1: Pink noise water background
    this.makeNoise('pink', 450);

    // Layer 2: Fast random bubble pops
    const playBubble = () => {
      if (!this.ctx || !this.gainNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const strikeFreq = 600 + Math.random() * 1200;
      osc.frequency.setValueAtTime(strikeFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(strikeFreq + 150, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.008, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.3) {
        playBubble();
      }
    }, 100);
    this.intervals.push(interval);
  }

  private makeMeditation() {
    if (!this.ctx || !this.gainNode) return;

    // Pentatonic pad voices in C Major 9 chord
    const tones = [130.81, 196.00, 261.63, 329.63, 392.00];

    tones.forEach((freq, idx) => {
      if (!this.ctx || !this.gainNode) return;

      const osc = this.ctx.createOscillator();
      const voiceGain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const voiceFilter = this.ctx.createBiquadFilter();
      voiceFilter.type = 'lowpass';
      voiceFilter.frequency.setValueAtTime(400, this.ctx.currentTime);

      osc.connect(voiceFilter);
      voiceFilter.connect(voiceGain);
      voiceGain.connect(this.gainNode);

      const baseGain = 0.04 / tones.length;
      voiceGain.gain.setValueAtTime(0, this.ctx.currentTime);
      voiceGain.gain.linearRampToValueAtTime(baseGain, this.ctx.currentTime + 2.0);

      osc.start();
      this.nodes.push(osc, voiceFilter, voiceGain);

      // Slow non-synchronized LFO swells
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.02 + idx * 0.007, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(baseGain * 0.4, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(voiceGain.gain);

      lfo.start();
      this.nodes.push(lfo, lfoGain);
    });
  }

  setVolume(vol: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.15);
    }
  }

  stop() {
    // Clear page turn, birds & piano clock timers
    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];

    if (this.gainNode && this.ctx) {
      try {
        const currentGain = this.gainNode.gain.value;
        // Fade out smoothly over 1.2 seconds instead of closing context instantly
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.setValueAtTime(currentGain, this.ctx.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
      } catch (e) {
        console.warn("Ramp failed inside stop:", e);
      }
    }

    const oldNodes = this.nodes;
    const oldCtx = this.ctx;

    setTimeout(() => {
      try {
        oldNodes.forEach(n => {
          try {
            (n as any).stop?.();
          } catch {}
        });
        oldCtx?.close();
      } catch (e) {
        console.warn("Cleanup context warning in stop:", e);
      }
    }, 1300);

    this.nodes = [];
    this.ctx = null;
    this.gainNode = null;
  }
}

export function playChime(type: 'work' | 'break') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = type === 'work' ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
    freqs.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.25);
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.25 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 1.2);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.25);
      o.stop(ctx.currentTime + i * 0.25 + 1.3);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch {}
}

export async function sendNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg' });
  } else if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') new Notification(title, { body, icon: '/favicon.svg' });
  }
}
