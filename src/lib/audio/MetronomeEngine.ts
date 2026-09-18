export class MetronomeEngine {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private bpm: number = 120;
  
  private lookahead: number = 25; 
  private scheduleAheadTime: number = 0.1; 
  
  private nextNoteTime: number = 0.0;
  private currentBeat: number = 0;
  private timerID: NodeJS.Timeout | null = null;
  private activeOscillators: OscillatorNode[] = [];

  // FUNGSI BARU: Bisa dipanggil kapan saja dari UI untuk pemanasan
  public unlock() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
      // Tembakkan suara bisu untuk membuka gembok hardware
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.001);
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
      if (index > -1) this.activeOscillators.splice(index, 1);
    };
  }

  private scheduler() {
    if (!this.audioContext || !this.isPlaying) return;

    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.playClick(this.nextNoteTime);
      this.nextNote();
    }
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
  }

  public start() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Mesin sudah dipastikan unlock dari layar "Let's Start"
    if (!this.audioContext) {
      this.unlock();
    } 
    
    // Gunakan tanda '!' atau pengecekan if untuk menenangkan TypeScript
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.currentBeat = 0;
    
    // Tambahkan tanda '!' sebelum .currentTime
    this.nextNoteTime = this.audioContext!.currentTime; 

    this.scheduler();
  }

  public stop() {
    this.isPlaying = false; 
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.activeOscillators = [];
  }

  public sync() {
    if (!this.isPlaying || !this.audioContext) return;
    if (this.timerID) clearTimeout(this.timerID);
    
    this.activeOscillators.forEach(osc => {
      try { osc.stop(); osc.disconnect(); } catch (e) {}
    });
    this.activeOscillators = [];

    this.currentBeat = 0;
    this.nextNoteTime = this.audioContext.currentTime; // 0 DELAY
    this.scheduler();
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.min(Math.max(newBpm, 30), 300);
  }
}