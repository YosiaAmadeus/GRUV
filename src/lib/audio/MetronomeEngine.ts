export class MetronomeEngine {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private bpm: number = 120;
  
  private lookahead: number = 25; 
  private scheduleAheadTime: number = 0.1; 
  
  private nextNoteTime: number = 0.0;
  private currentBeat: number = 0;
  private timerID: NodeJS.Timeout | null = null;

  // Menyimpan daftar suara yang sedang antre agar bisa dibatalkan saat Sync
  private activeOscillators: OscillatorNode[] = [];

  private nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat++;
    
    if (this.currentBeat === 4) {
      this.currentBeat = 0;
    }
  }

  private playClick(time: number) {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    osc.frequency.value = (this.currentBeat === 0) ? 1000 : 800;

    envelope.gain.value = 1;
    envelope.gain.setValueAtTime(1, time);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

    osc.connect(envelope);
    envelope.connect(this.audioContext.destination);

    osc.start(time);
    osc.stop(time + 0.03);

    // Masukkan ke daftar antrean
    this.activeOscillators.push(osc);

    // Hapus dari daftar jika sudah selesai berbunyi
    osc.onended = () => {
      const index = this.activeOscillators.indexOf(osc);
      if (index > -1) {
        this.activeOscillators.splice(index, 1);
      }
    };
  }

  private scheduler() {
    if (!this.audioContext) return;

    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.playClick(this.nextNoteTime);
      this.nextNote();
    }
    
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
  }

  public start() {
    if (this.isPlaying) return;

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.isPlaying = true;
    this.currentBeat = 0;
    // Langsung eksekusi tanpa delay
    this.nextNoteTime = this.audioContext.currentTime; 
    
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  // FITUR BARU: Reset to 1 seketika
  public sync() {
    if (!this.isPlaying || !this.audioContext) return;

    // 1. Hentikan loop yang sedang berjalan
    if (this.timerID) {
      clearTimeout(this.timerID);
    }

    // 2. Bunuh secara paksa semua suara yang sudah terlanjur antre di memori
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Abaikan jika oscillator sudah keburu mati
      }
    });
    this.activeOscillators = [];

    // 3. Reset ketukan kembali ke 0 (Hitungan 1) dan set waktu ke SAAT INI JUGA
    this.currentBeat = 0;
    this.nextNoteTime = this.audioContext.currentTime;

    // 4. Jalankan ulang schedulernya
    this.scheduler();
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.min(Math.max(newBpm, 30), 300);
  }

  public getIsPlaying() {
    return this.isPlaying;
  }
}