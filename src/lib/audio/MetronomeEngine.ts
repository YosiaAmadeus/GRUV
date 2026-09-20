export class MetronomeEngine {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private bpm: number = 120;
  private isMuted: boolean = false;
  
  private subdivision: number = 1; 
  private beatsPerBar: number = 4; // Default Time Signature (4/4)
  
  private lookahead: number = 25; 
  private scheduleAheadTime: number = 0.1; 
  private nextNoteTime: number = 0.0;
  private currentSubdivisionNote: number = 0; 
  private timerID: NodeJS.Timeout | null = null;
  private activeOscillators: OscillatorNode[] = [];

  // Callback untuk sinkronisasi ke UI React
  public onBeatVisual?: (beat: number, sub: number) => void;

  public unlock() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
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
    this.nextNoteTime += secondsPerBeat / this.subdivision;
    this.currentSubdivisionNote++;
    
    // Gunakan beatsPerBar dinamis, bukan fix angka 4
    if (this.currentSubdivisionNote >= this.beatsPerBar * this.subdivision) {
      this.currentSubdivisionNote = 0;
    }
  }

  private playClick(time: number) {
    if (!this.audioContext) return;

    // Kalkulasi posisi ketukan untuk Visual UI
    const currentBeat = Math.floor(this.currentSubdivisionNote / this.subdivision) + 1;
    const currentSub = this.currentSubdivisionNote % this.subdivision;
    const delay = Math.max(0, time - this.audioContext.currentTime);

    // Kirim sinyal ke UI tepat saat nada dijadwalkan berbunyi
    setTimeout(() => {
      if (this.onBeatVisual && this.isPlaying) {
        this.onBeatVisual(currentBeat, currentSub);
      }
    }, delay * 1000);

    if (this.isMuted) return;

    const osc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    const isDownbeat = this.currentSubdivisionNote === 0;
    const isMainBeat = this.currentSubdivisionNote % this.subdivision === 0;

    if (isDownbeat) {
      osc.frequency.value = 1000; 
      envelope.gain.value = 1;
    } else if (isMainBeat) {
      osc.frequency.value = 800; 
      envelope.gain.value = 1;
    } else {
      osc.frequency.value = 600; 
      envelope.gain.value = 0.3; 
    }

    envelope.gain.setValueAtTime(envelope.gain.value, time);
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

    if (!this.audioContext) this.unlock();
    if (this.audioContext && this.audioContext.state === 'suspended') this.audioContext.resume();

    this.currentSubdivisionNote = 0;
    
    // HACK: Tambahkan buffer 0.05 detik (50ms) pada nada pertama. 
    // Ini memberi waktu chip audio HP untuk "bernapas" agar ketukan pertama tidak lag/tercekat.
    this.nextNoteTime = this.audioContext!.currentTime + 0.05; 
    
    this.scheduler();
  }
  public stop() {
    this.isPlaying = false; 
    if (this.timerID) { clearTimeout(this.timerID); this.timerID = null; }
    this.activeOscillators.forEach(osc => { try { osc.stop(); osc.disconnect(); } catch (e) {} });
    this.activeOscillators = [];
    
    // Reset visual ke 1 saat berhenti
    if (this.onBeatVisual) this.onBeatVisual(1, 0);
  }

  public sync() {
    if (!this.isPlaying || !this.audioContext) return;
    if (this.timerID) clearTimeout(this.timerID);
    this.activeOscillators.forEach(osc => { try { osc.stop(); osc.disconnect(); } catch (e) {} });
    this.activeOscillators = [];
    this.currentSubdivisionNote = 0;
    this.nextNoteTime = this.audioContext.currentTime; 
    this.scheduler();
  }

  public setBpm(newBpm: number) { this.bpm = Math.min(Math.max(newBpm, 30), 300); }
  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.activeOscillators.forEach(osc => { try { osc.stop(); osc.disconnect(); } catch (e) {} });
      this.activeOscillators = [];
    }
  }

  public setBeatsPerBar(beats: number) {
    if (this.beatsPerBar === beats) return;
    this.beatsPerBar = beats;
    if (this.isPlaying && this.currentSubdivisionNote >= this.beatsPerBar * this.subdivision) {
       this.sync(); 
    }
  }

  public setSubdivision(newSubdivision: number) {
    if (this.subdivision === newSubdivision) return;
    
    if (!this.audioContext || !this.isPlaying) {
      this.subdivision = newSubdivision;
      return;
    }

    const secondsPerBeat = 60.0 / this.bpm;
    const oldPositionBeats = this.currentSubdivisionNote / this.subdivision;
    let measureStartTime = this.nextNoteTime - (oldPositionBeats * secondsPerBeat);
    const timeNow = this.audioContext.currentTime;

    let found = false;
    let newIndex = 0;
    let newNextNoteTime = measureStartTime;

    for (let i = 0; i < this.beatsPerBar * newSubdivision; i++) {
      const testTime = measureStartTime + (i / newSubdivision) * secondsPerBeat;
      if (testTime > timeNow) {
        newIndex = i;
        newNextNoteTime = testTime;
        found = true;
        break;
      }
    }

    if (!found) {
      measureStartTime += this.beatsPerBar * secondsPerBeat; 
      newIndex = 0;
      newNextNoteTime = measureStartTime;
    }

    this.currentSubdivisionNote = newIndex;
    this.nextNoteTime = newNextNoteTime;
    this.subdivision = newSubdivision;
  }
}