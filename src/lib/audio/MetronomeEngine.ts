export class MetronomeEngine {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private bpm: number = 120;
  private unlocked: boolean = false; // Flag khusus untuk trik unlock mobile
  
  private lookahead: number = 25; 
  private scheduleAheadTime: number = 0.1; 
  
  private nextNoteTime: number = 0.0;
  private currentBeat: number = 0;
  private timerID: NodeJS.Timeout | null = null;

  private activeOscillators: OscillatorNode[] = [];

  // FUNGSI BARU: Membuka gembok audio dengan suara bisu 
  private unlockAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Trik khusus: Mainkan suara bisu 1 milidetik agar sistem HP merestui keluarnya suara
    if (!this.unlocked) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      gain.gain.value = 0; // Volume 0 (bisu)
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.001);
      this.unlocked = true;
    }
  }

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

    this.activeOscillators.push(osc);

    osc.onended = () => {
      const index = this.activeOscillators.indexOf(osc);
      if (index > -1) {
        this.activeOscillators.splice(index, 1);
      }
    };
  }

  private scheduler() {
    // PENCEGAH ZOMBIE LOOP: Jika sudah di-stop, hentikan putaran ini!
    if (!this.audioContext || !this.isPlaying) return;

    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.playClick(this.nextNoteTime);
      this.nextNote();
    }
    
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
  }

  public start() {
    if (this.isPlaying) return;

    // 1. Eksekusi unlock secara sinkron (langsung merespons jari)
    this.unlockAudioContext();

    // 2. Bangunkan mesin jika masih tertidur
    if (this.audioContext!.state === 'suspended') {
      this.audioContext!.resume();
    }

    this.isPlaying = true;
    this.currentBeat = 0;
    
    // 3. Kasih jeda super kecil (10 milidetik) agar hardware HP bersiap
    this.nextNoteTime = this.audioContext!.currentTime + 0.01; 
    
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false; // Mematikan status agar scheduler berhenti
    
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }

    // PERBAIKAN FATAL: Bunuh semua suara yang sudah terlanjur antre!
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Abaikan jika sudah keburu mati
      }
    });
    this.activeOscillators = [];
  }

  public sync() {
    if (!this.isPlaying || !this.audioContext) return;

    if (this.timerID) {
      clearTimeout(this.timerID);
    }

    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.activeOscillators = [];

    this.currentBeat = 0;
    this.nextNoteTime = this.audioContext.currentTime;

    this.scheduler();
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.min(Math.max(newBpm, 30), 300);
  }

  public getIsPlaying() {
    return this.isPlaying;
  }
}