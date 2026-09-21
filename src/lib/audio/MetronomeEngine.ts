export class MetronomeEngine {
  public audioContext: AudioContext | null = null;
  private nextNoteTime: number = 0;
  private timerID: number | null = null;
  
  private bpm: number = 120;
  private beatsPerBar: number = 4;
  private subdivision: number = 1;
  
  public isPlaying: boolean = false;
  private currentBeat: number = 0;
  private currentSubdivisionNote: number = 0;
  private isMuted: boolean = false;

  // SOUND KITS & COUNT-IN STATE
  public soundType: 'digital' | 'woodblock' | 'hihat' | 'shaker' | 'techno' = 'digital';
  public countInEnabled: boolean = false;
  public isCountingIn: boolean = false;
  private countInBeatIndex: number = 0;

  private noiseBuffer: AudioBuffer | null = null;
  private vocalBuffers: Record<string, AudioBuffer> = {};

  public onBeatVisual?: (beat: number, sub: number, isCountIn?: boolean, countText?: string) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.createNoiseBuffer();
      this.loadVocalSamples(); // Coba muat suara manusia jika ada
    }
  }

  // Generate White Noise untuk Shaker & Hi-hat
  private createNoiseBuffer() {
    if (!this.audioContext) return;
    const bufferSize = this.audioContext.sampleRate * 2; 
    this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  // Memuat file suara Vocal dari folder public/sounds/
  private async loadVocalSamples() {
    if (!this.audioContext) return;
    const files = ['intro', '1', '2', '3', '4', '5', '6', '7', '8'];
    for (const file of files) {
      try {
        const response = await fetch(`/sounds/vocal-${file}.wav`);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          this.vocalBuffers[file] = await this.audioContext.decodeAudioData(arrayBuffer);
        }
      } catch (e) {
        // Abaikan jika file tidak ada, mesin akan otomatis menggunakan nada fallback
      }
    }
  }

  public unlock() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
      const osc = this.audioContext.createOscillator();
      osc.connect(this.audioContext.destination);
      osc.start();
      osc.stop();
    }
  }

  public setBpm(bpm: number) { this.bpm = bpm; }
  public setBeatsPerBar(beats: number) { this.beatsPerBar = beats; }
  public setSubdivision(sub: number) { this.subdivision = sub; }
  public setMuted(muted: boolean) { this.isMuted = muted; }
  public setSoundType(type: 'digital' | 'woodblock' | 'hihat' | 'shaker' | 'techno') { this.soundType = type; }
  public setCountIn(enabled: boolean) { this.countInEnabled = enabled; }

  public start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    if (!this.audioContext) this.unlock();
    if (this.audioContext && this.audioContext.state === 'suspended') this.audioContext.resume();

    this.currentBeat = 0;
    this.currentSubdivisionNote = 0;
    this.nextNoteTime = this.audioContext!.currentTime;
    
    // Setup Count-in
    if (this.countInEnabled) {
      this.isCountingIn = true;
      this.countInBeatIndex = 0;
    } else {
      this.isCountingIn = false;
    }

    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    this.isCountingIn = false;
    if (this.timerID !== null) window.clearTimeout(this.timerID);
  }

  public sync() {
    this.currentBeat = 0;
    this.currentSubdivisionNote = 0;
    if (this.countInEnabled) {
      this.isCountingIn = true;
      this.countInBeatIndex = 0;
    }
    if (this.audioContext) this.nextNoteTime = this.audioContext.currentTime;
  }

  private scheduler() {
    while (this.audioContext && this.nextNoteTime < this.audioContext.currentTime + 0.1) {
      
      if (this.isCountingIn) {
        this.scheduleCountInBeat();
      } else {
        this.scheduleRegularBeat();
      }
    }
    if (this.isPlaying) {
      this.timerID = window.setTimeout(() => this.scheduler(), 25);
    }
  }

  // --- LOGIKA HITUNGAN 2 BAR (COUNT-IN) ---
  private scheduleCountInBeat() {
    const totalCountBeats = this.beatsPerBar * 2; // 2 Bar
    const barNumber = Math.floor(this.countInBeatIndex / this.beatsPerBar) + 1; // 1 atau 2
    const beatInBar = (this.countInBeatIndex % this.beatsPerBar) + 1; // 1, 2, 3...
    
    // Tentukan kata apa yang diucapkan
    let vocalKey = beatInBar.toString();
    let displayWord = beatInBar.toString();
    
    if (barNumber === 1 && beatInBar === 1) {
      vocalKey = 'intro';
      displayWord = 'INTRO';
    }

    // Jalankan audio & UI
    this.playVocalCount(this.nextNoteTime, vocalKey, barNumber === 1);
    
    if (this.onBeatVisual) {
      this.onBeatVisual(beatInBar, 0, true, displayWord);
    }

    // Majukan waktu 1 ketuk penuh (tanpa subdivisi)
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.countInBeatIndex++;

    // Cek apakah count-in selesai
    if (this.countInBeatIndex >= totalCountBeats) {
      this.isCountingIn = false;
      this.currentBeat = 0;
      this.currentSubdivisionNote = 0;
    }
  }

  private playVocalCount(time: number, vocalKey: string, isFirstBar: boolean) {
    if (!this.audioContext || this.isMuted) return;
    
    if (this.vocalBuffers[vocalKey]) {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.vocalBuffers[vocalKey];
      
      // GAIN NODE BARU UNTUK MEM-BOOST SUARA FILE ASLI (2.5x LIPAT)
      const boostGain = this.audioContext.createGain();
      boostGain.gain.value = 2.5; 
      
      source.connect(boostGain).connect(this.audioContext.destination);
      source.start(time);
    } else {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = isFirstBar ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(vocalKey === 'intro' || vocalKey === '1' ? 600 : 400, time);
      
      // BOOST SYNTH CUE DARI 0.5 MENJADI 1.5
      gain.gain.setValueAtTime(1.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      
      osc.connect(gain).connect(this.audioContext.destination);
      osc.start(time);
      osc.stop(time + 0.1);
    }
  }

  // --- LOGIKA METRONOME REGULER ---
  private scheduleRegularBeat() {
    const isMainBeat = this.currentSubdivisionNote === 0;
    const isFirstBeatOfBar = isMainBeat && this.currentBeat === 0;

    if (!this.isMuted) {
      this.playSoundKit(this.nextNoteTime, isMainBeat, isFirstBeatOfBar);
    }

    if (this.onBeatVisual) {
      this.onBeatVisual(this.currentBeat + 1, this.currentSubdivisionNote, false);
    }

    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat / this.subdivision;
    this.currentSubdivisionNote++;

    if (this.currentSubdivisionNote >= this.subdivision) {
      this.currentSubdivisionNote = 0;
      this.currentBeat++;
      if (this.currentBeat >= this.beatsPerBar) {
        this.currentBeat = 0;
      }
    }
  }

// --- SINTESIS 5 INSTRUMEN TANPA LATENSI (BOOSTED VOLUME) ---
  private playSoundKit(time: number, isMain: boolean, isFirst: boolean) {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    switch (this.soundType) {
      case 'woodblock':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isFirst ? 1200 : (isMain ? 800 : 600), time);
        gain.gain.setValueAtTime(isFirst ? 2.5 : (isMain ? 1.5 : 0.8), time); // BOOST
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.05);
        break;

      case 'hihat':
        if (this.noiseBuffer) {
          const noise = ctx.createBufferSource();
          noise.buffer = this.noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = isFirst ? 5000 : 7000; 
          
          gain.gain.setValueAtTime(isFirst ? 2.5 : (isMain ? 1.0 : 0.4), time); // BOOST
          gain.gain.exponentialRampToValueAtTime(0.001, time + (isFirst ? 0.25 : 0.05));
          
          noise.connect(filter).connect(gain).connect(ctx.destination);
          noise.start(time);
          noise.stop(time + 0.3);
        }
        break;

      case 'shaker':
        if (this.noiseBuffer) {
          const noise = ctx.createBufferSource();
          noise.buffer = this.noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = isFirst ? 3000 : 4000;
          
          gain.gain.setValueAtTime(0.01, time);
          gain.gain.linearRampToValueAtTime(isFirst ? 2.5 : (isMain ? 0.8 : 0.2), time + 0.02); // BOOST
          gain.gain.exponentialRampToValueAtTime(0.001, time + (isFirst ? 0.2 : 0.08));
          
          noise.connect(filter).connect(gain).connect(ctx.destination);
          noise.start(time);
          noise.stop(time + 0.25);
        }
        break;

      case 'techno':
        osc.type = isFirst ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(isFirst ? 600 : (isMain ? 400 : 300), time);
        
        gain.gain.setValueAtTime(isFirst ? 2.0 : (isMain ? 1.2 : 0.6), time); // BOOST
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        osc.connect(gain).connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.1);
        break;

      default: // 'digital'
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isFirst ? 1000 : (isMain ? 800 : 400), time);
        gain.gain.setValueAtTime(isFirst ? 2.5 : (isMain ? 1.5 : 0.8), time); // BOOST
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.connect(gain).connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.1);
        break;
    }
  }
}