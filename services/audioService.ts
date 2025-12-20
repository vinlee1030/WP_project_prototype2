
class AudioService {
  private ctx: AudioContext | null = null;
  private bgmInterval: number | null = null;
  private menuMusicInterval: number | null = null;
  private masterGain: GainNode | null = null;
  private beat = 0;
  private initialized = false;

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
      } catch (e) {
        console.warn('Audio context not available');
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Call this on any user interaction to enable audio on mobile
  unlock() {
    // Create context if not exists
    if (!this.ctx) {
      try {
        // Try webkit first for iOS
        const AudioContextClass = (window as any).webkitAudioContext || window.AudioContext;
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
      } catch (e) {
        console.warn('Audio context not available');
        return;
      }
    }
    
    // Force resume - try multiple times
    const doUnlock = () => {
      if (!this.ctx) return;
      
      // Resume the context
      this.ctx.resume().catch(() => {});
      
      // Create empty buffer and play it
      try {
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
      } catch(e) {}
      
      // Also play a very quiet beep
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.01);
      } catch(e) {}
    };
    
    // Try immediately
    doUnlock();
    
    // And try again after a short delay (helps on some browsers)
    setTimeout(doUnlock, 50);
    setTimeout(doUnlock, 150);
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', volume: number = 0.3, detune: number = 0) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  private playNoise(duration: number, volume: number = 0.1, filter?: { freq: number, type: BiquadFilterType }) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      
      if (filter) {
        const biquad = this.ctx.createBiquadFilter();
        biquad.type = filter.type;
        biquad.frequency.value = filter.freq;
        source.connect(biquad);
        biquad.connect(gain);
      } else {
        source.connect(gain);
      }
      gain.connect(this.masterGain);
      source.start();
    } catch (e) {}
  }

  // Different weapon sounds
  playShoot(weaponType?: string) {
    switch (weaponType) {
      case 'PISTOL':
        this.playTone(800, 0.04, 'square', 0.1);
        this.playTone(400, 0.03, 'sawtooth', 0.06);
        break;
      case 'SHOTGUN':
        this.playNoise(0.08, 0.2);
        this.playTone(200, 0.06, 'square', 0.15);
        this.playTone(100, 0.08, 'sine', 0.1);
        break;
      case 'RIFLE':
        this.playTone(1200, 0.03, 'square', 0.08);
        this.playTone(600, 0.04, 'sawtooth', 0.05);
        break;
      case 'MACHINE_GUN':
        this.playTone(1000, 0.02, 'square', 0.06);
        this.playNoise(0.02, 0.04);
        break;
      case 'SNIPER':
        this.playTone(1500, 0.08, 'sine', 0.12);
        this.playTone(300, 0.1, 'square', 0.08);
        this.playNoise(0.06, 0.1, { freq: 2000, type: 'highpass' });
        break;
      case 'ROCKET':
        this.playTone(100, 0.15, 'sawtooth', 0.15);
        this.playTone(50, 0.2, 'sine', 0.1);
        this.playNoise(0.1, 0.1);
        break;
      case 'GRENADE':
        this.playTone(300, 0.08, 'triangle', 0.1);
        this.playTone(150, 0.1, 'sine', 0.08);
        break;
      case 'FLAMETHROWER':
        this.playNoise(0.06, 0.08, { freq: 800, type: 'lowpass' });
        this.playTone(200, 0.05, 'sawtooth', 0.05);
        break;
      case 'LASER':
        this.playTone(2000, 0.05, 'sine', 0.1);
        this.playTone(1500, 0.06, 'triangle', 0.08);
        break;
      case 'MINIGUN':
        this.playTone(900, 0.015, 'square', 0.05);
        this.playNoise(0.01, 0.03);
        break;
      default:
        this.playTone(900, 0.04, 'square', 0.12);
        this.playTone(450, 0.04, 'sawtooth', 0.08);
    }
  }

  playExplosion() {
    this.playNoise(0.3, 0.5);
    this.playTone(60, 0.2, 'sine', 0.4);
    this.playTone(40, 0.25, 'sine', 0.3);
  }

  playHit() {
    this.playTone(300, 0.05, 'square', 0.08);
    this.playNoise(0.03, 0.06);
  }

  playZombieHit() {
    this.playTone(150, 0.08, 'sawtooth', 0.1);
    this.playNoise(0.05, 0.08, { freq: 500, type: 'lowpass' });
  }

  playZombieDeath() {
    this.playTone(100, 0.15, 'sawtooth', 0.15);
    this.playTone(50, 0.2, 'sine', 0.1);
    this.playNoise(0.1, 0.1);
  }

  playPlayerHurt() {
    this.playTone(400, 0.08, 'square', 0.1);
    this.playTone(200, 0.1, 'sawtooth', 0.08);
  }

  playPickup() {
    this.playTone(880, 0.05, 'sine', 0.1);
    setTimeout(() => this.playTone(1100, 0.05, 'sine', 0.1), 50);
  }

  playSpawn() {
    this.playTone(523, 0.06, 'sine', 0.15);
    setTimeout(() => this.playTone(659, 0.06, 'sine', 0.15), 40);
    setTimeout(() => this.playTone(784, 0.08, 'sine', 0.15), 80);
  }

  playGoal() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 0.2, 'sine', 0.15), i * 100);
    });
  }

  playWaveComplete() {
    const notes = [392, 523, 659, 784];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 0.15, 'triangle', 0.12), i * 80);
    });
  }

  startBGM() {
    this.stopMenuMusic();
    if (this.bgmInterval) return;
    
    // Heavy metal-ish game music
    const bassLine = [65, 65, 82, 73, 65, 65, 98, 87]; // E power chord progression
    const melody = [330, 392, 440, 392, 330, 294, 330, 262];
    this.beat = 0;
    
    this.bgmInterval = window.setInterval(() => {
      const bassNote = bassLine[this.beat % bassLine.length];
      const melodyNote = melody[this.beat % melody.length];
      
      // Heavy distorted bass
      this.playTone(bassNote, 0.12, 'sawtooth', 0.15, Math.random() * 10);
      this.playTone(bassNote * 2, 0.12, 'square', 0.08);
      
      // Kick drum on beats 0, 2, 4, 6
      if (this.beat % 2 === 0) {
        this.playTone(50, 0.08, 'sine', 0.2);
        this.playNoise(0.03, 0.1);
      }
      
      // Snare on beats 2, 6
      if (this.beat % 4 === 2) {
        this.playNoise(0.08, 0.15);
        this.playTone(200, 0.05, 'square', 0.1);
      }
      
      // Hi-hat
      if (this.beat % 2 === 1) {
        this.playNoise(0.02, 0.05);
      }
      
      // Melody every other beat
      if (this.beat % 2 === 0) {
        this.playTone(melodyNote, 0.1, 'square', 0.06);
      }
      
      this.beat++;
    }, 140);
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  startMenuMusic() {
    this.stopBGM();
    if (this.menuMusicInterval) return;
    
    // Chill menu music with synth vibes
    const chords = [
      [262, 330, 392], // C major
      [294, 370, 440], // D major
      [220, 277, 330], // A minor
      [196, 247, 294], // G major
    ];
    let idx = 0;
    
    this.menuMusicInterval = window.setInterval(() => {
      const chord = chords[idx % chords.length];
      chord.forEach((note, i) => {
        setTimeout(() => {
          this.playTone(note, 0.5, 'sine', 0.06);
          this.playTone(note * 0.5, 0.5, 'triangle', 0.03);
        }, i * 80);
      });
      
      // Arpeggio
      const arpNotes = [chord[0] * 2, chord[1] * 2, chord[2] * 2, chord[1] * 2];
      arpNotes.forEach((note, i) => {
        setTimeout(() => this.playTone(note, 0.15, 'sine', 0.04), 200 + i * 100);
      });
      
      idx++;
    }, 800);
  }

  stopMenuMusic() {
    if (this.menuMusicInterval) {
      clearInterval(this.menuMusicInterval);
      this.menuMusicInterval = null;
    }
  }
}

export const audioService = new AudioService();
