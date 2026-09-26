export class MetronomeEngine {
  public audioContext: AudioContext | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
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
      
      // SETUP COMPRESSOR
      this.masterCompressor = this.audioContext.createDynamicsCompressor();
      this.masterCompressor.threshold.setValueAtTime(-5, this.audioContext.currentTime); // Mulai nahan lebih awal agar tidak sakit di telinga
      this.masterCompressor.knee.setValueAtTime(12, this.audioContext.currentTime); // Lekukan transisi yang sangat halus
      this.masterCompressor.ratio.setValueAtTime(20, this.audioContext.currentTime); // Tahan sekuat tembok bata
      this.masterCompressor.attack.setValueAtTime(0.001, this.audioContext.currentTime); // Tangkap sangat cepat
      this.masterCompressor.release.setValueAtTime(0.05, this.audioContext.currentTime); // Lepas cepat agar memantul
      
      this.masterCompressor.connect(this.audioContext.destination);

      this.createNoiseBuffer();
      this.loadVocalSamples();
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
      // Lewatkan unlock ke compressor juga
      if (this.masterCompressor) osc.connect(this.masterCompressor); 
      else osc.connect(this.audioContext.destination);
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
      this.isCountingIn = false;
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

// --- LOGIKA HITUNGAN 2 BAR (MENDUKUNG RHYTHM PATTERN / SUBDIVISION) ---
  private scheduleCountInBeat() {
    const totalCountBeats = this.beatsPerBar * 2; 
    const barNumber = Math.floor(this.countInBeatIndex / this.beatsPerBar) + 1; 
    const beatInBar = (this.countInBeatIndex % this.beatsPerBar) + 1; 
    
    // HANYA MAIN VOKAL & TAMPILKAN TEKS DI KETUKAN UTAMA (Subdivisi ke-0)
    if (this.currentSubdivisionNote === 0) {
      let vocalKey = '';
      let displayWord = '';

      if (barNumber === 1) {
        // RULE: BAR KE-1 (HALF-TIME LOGIC)
        switch (this.beatsPerBar) {
          case 4:
            if (beatInBar === 1) { vocalKey = 'intro'; displayWord = 'INTRO'; }
            else if (beatInBar === 3) { vocalKey = '2'; displayWord = '2'; }
            else { displayWord = '•'; } 
            break;
          case 3:
            if (beatInBar === 1) { vocalKey = 'intro'; displayWord = 'INTRO'; }
            else { displayWord = '•'; }
            break;
          case 6:
            if (beatInBar === 1) { vocalKey = 'intro'; displayWord = 'INTRO'; }
            else if (beatInBar === 4) { vocalKey = '2'; displayWord = '2'; }
            else { displayWord = '•'; }
            break;
          case 7:
            if (beatInBar === 1) { vocalKey = 'intro'; displayWord = 'INTRO'; }
            else if (beatInBar === 5) { vocalKey = '2'; displayWord = '2'; }
            else { displayWord = '•'; }
            break;
          case 8:
            if (beatInBar === 1) { vocalKey = 'intro'; displayWord = 'INTRO'; }
            else if (beatInBar === 3) { vocalKey = '2'; displayWord = '2'; }
            else if (beatInBar === 5) { vocalKey = '3'; displayWord = '3'; }
            else if (beatInBar === 7) { vocalKey = '4'; displayWord = '4'; }
            else { displayWord = '•'; }
            break;
          default:
            if (beatInBar === 1) { vocalKey = 'intro'; displayWord = 'INTRO'; }
            else { displayWord = '•'; }
            break;
        }
      } 
      else {
        // RULE: BAR KE-2 (FULL-TIME LOGIC)
        vocalKey = beatInBar.toString(); 
        displayWord = vocalKey;
      }

      // Bunyikan Click Utama (Keras) & Suara Vokal (Jika Ada)
      const isFirstBeatOfBar = (beatInBar === 1);
      this.playSoundKit(this.nextNoteTime, true, isFirstBeatOfBar);

      if (vocalKey !== '') {
        this.playVocalCount(this.nextNoteTime, vocalKey, barNumber === 1);
      }
      
      if (this.onBeatVisual) {
        this.onBeatVisual(beatInBar, 0, true, displayWord);
      }
    } 
    else {
      // JIKA INI ADALAH ANAK KETUKAN (1/8, TRIPLET, ATAU 1/16)
      // Bunyikan suara pelan (ghost notes) tanpa suara vokal
      this.playSoundKit(this.nextNoteTime, false, false);
    }

    // PERBAIKAN: Majukan waktu berdasarkan pecahan subdivision (Bukan ketukan penuh lagi)
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += (secondsPerBeat / this.subdivision);
    this.currentSubdivisionNote++;

    // Jika pecahan sudah mencapai batas (misal 1/8 punya 2 pecahan), baru maju ke ketukan utama berikutnya
    if (this.currentSubdivisionNote >= this.subdivision) {
      this.currentSubdivisionNote = 0;
      this.countInBeatIndex++;
    }

    // Jika seluruh hitungan (2 Bar) selesai, masuk ke lagu asli!
    if (this.countInBeatIndex >= totalCountBeats) {
      this.isCountingIn = false;
      this.currentBeat = 0;
      this.currentSubdivisionNote = 0;
    }
  }

private playVocalCount(time: number, vocalKey: string, isFirstBar: boolean) {
    if (!this.audioContext || this.isMuted || !this.masterCompressor) return;
    
    if (this.vocalBuffers[vocalKey]) {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.vocalBuffers[vocalKey];
      
      const boostGain = this.audioContext.createGain();
      // VOLUME RATA 5.0 untuk rekaman vokal manusia
      boostGain.gain.value = 5.0; 
      
      source.connect(boostGain).connect(this.masterCompressor);
      source.start(time);
    } else {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      // PERBAIKAN: Gunakan gelombang 'square' untuk semua bar agar volumenya RATA
      osc.type = 'square'; 
      
      // Bedakan dari Pitchnya saja
      if (vocalKey === 'intro') {
        osc.frequency.setValueAtTime(900, time); // Nada tertinggi
      } else if (isFirstBar) {
        osc.frequency.setValueAtTime(600, time); // Nada sedang
      } else {
        osc.frequency.setValueAtTime(500, time); // Nada rendah (Bar 2)
      }
      
      // VOLUME RATA 5.0
      gain.gain.setValueAtTime(5.0, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      
      osc.connect(gain).connect(this.masterCompressor);
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

// --- SINTESIS 5 INSTRUMEN TANPA LATENSI (3-TIER DYNAMICS: AKSEN 1, AKSEN 2, & GHOST NOTES) ---
  private playSoundKit(time: number, isMain: boolean, isFirst: boolean) {
    if (!this.audioContext || this.isMuted || !this.masterCompressor) return;

    // --- HIERARKI 3-TIER DYNAMICS ---
    const isTier1 = isFirst;                  // Ketukan 1 (Paling Keras & Menonjol)
    const isTier2 = isMain && !isFirst;       // Ketukan 2, 3, 4 (Menengah)
    const isTier3 = !isMain;                  // Anak Ketukan/Subdivisi (Sangat Pelan/Ghost Notes)

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    switch (this.soundType) {
      case 'woodblock':
        osc.type = 'square';
        const woodFilter = ctx.createBiquadFilter();
        woodFilter.type = 'bandpass';
        woodFilter.Q.value = 2.5; 
        
        if (isTier1) {
          woodFilter.frequency.setValueAtTime(1500, time);
          osc.frequency.setValueAtTime(1500, time);
          gain.gain.setValueAtTime(6.0, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        } else if (isTier2) {
          woodFilter.frequency.setValueAtTime(1000, time);
          osc.frequency.setValueAtTime(1000, time);
          gain.gain.setValueAtTime(3.5, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        } else { // Tier 3
          woodFilter.frequency.setValueAtTime(700, time);
          osc.frequency.setValueAtTime(700, time);
          gain.gain.setValueAtTime(1.2, time); // Volume ghost note
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.015); // Sangat pendek (Tck)
        }
        
        osc.connect(woodFilter).connect(gain).connect(this.masterCompressor);
        osc.start(time);
        osc.stop(time + 0.05);
        break;

      case 'hihat':
        if (this.noiseBuffer) {
          const noise = ctx.createBufferSource();
          noise.buffer = this.noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          
          if (isTier1) {
            filter.frequency.setValueAtTime(5000, time);
            gain.gain.setValueAtTime(5.0, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
          } else if (isTier2) {
            filter.frequency.setValueAtTime(7000, time);
            gain.gain.setValueAtTime(2.5, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
          } else {
            filter.frequency.setValueAtTime(9000, time); // Lebih tipis/kering
            gain.gain.setValueAtTime(0.8, time); // Volume ditekan
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04); // Durasi sangat rapat
          }
          
          noise.connect(filter).connect(gain).connect(this.masterCompressor);
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
          
          if (isTier1) {
            filter.frequency.setValueAtTime(3000, time);
            gain.gain.setValueAtTime(0.01, time);
            gain.gain.linearRampToValueAtTime(5.0, time + 0.02); // Attack sedikit lambat
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
          } else if (isTier2) {
            filter.frequency.setValueAtTime(4000, time);
            gain.gain.setValueAtTime(0.01, time);
            gain.gain.linearRampToValueAtTime(2.5, time + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
          } else {
            filter.frequency.setValueAtTime(5000, time);
            gain.gain.setValueAtTime(0.01, time);
            gain.gain.linearRampToValueAtTime(1.0, time + 0.01); // Cepat (Ch-ch)
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
          }
          
          noise.connect(filter).connect(gain).connect(this.masterCompressor);
          noise.start(time);
          noise.stop(time + 0.25);
        }
        break;

      case 'techno':
        if (isTier1) {
          osc.type = 'square';
          osc.frequency.setValueAtTime(800, time);
          gain.gain.setValueAtTime(5.0, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        } else if (isTier2) {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, time);
          gain.gain.setValueAtTime(2.5, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        } else {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(150, time); // Sub/Low-mid untuk ghost note
          gain.gain.setValueAtTime(1.0, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        }
        
        osc.connect(gain).connect(this.masterCompressor);
        osc.start(time);
        osc.stop(time + 0.15);
        break;

      default: // 'digital'
        osc.type = 'sine';
        if (isTier1) {
          osc.frequency.setValueAtTime(2000, time);
          gain.gain.setValueAtTime(5.0, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        } else if (isTier2) {
          osc.frequency.setValueAtTime(1000, time);
          gain.gain.setValueAtTime(2.5, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
        } else {
          osc.frequency.setValueAtTime(600, time); // Pitch lebih rendah
          gain.gain.setValueAtTime(1.0, time); // Volume pelan
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03); // Durasi pendek (Beep)
        }
        
        osc.connect(gain).connect(this.masterCompressor);
        osc.start(time);
        osc.stop(time + 0.1);
        break;
    }
  }
}