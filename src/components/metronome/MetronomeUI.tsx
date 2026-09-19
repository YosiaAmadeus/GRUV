"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Minus, Plus, RefreshCw, Power, LogIn, LogOut, ListMusic, ChevronLeft, ChevronRight, Save, Loader2, Edit3, PlusCircle, Trash2, Volume2, VolumeX, Hand } from "lucide-react";
import { MetronomeEngine } from "../../lib/audio/MetronomeEngine";
import { useSession, signIn, signOut } from "next-auth/react";
import SetlistPanel from "./SetlistPanel";
import { addTrack, getMySetlists, updateTrackBpm, deleteTrack } from "@/actions/setlist";

export default function MetronomeUI() {
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isSetlistOpen, setIsSetlistOpen] = useState(false);
  const { data: session } = useSession();
  
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const engineRef = useRef<any>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // --- STATE LIVE SETLIST MODE ---
  const [activeSetlist, setActiveSetlist] = useState<any | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleteTrackModalOpen, setIsDeleteTrackModalOpen] = useState(false);
  const [isDeletingTrack, setIsDeletingTrack] = useState(false);

  // --- STATE TAP TEMPO ---
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  const isDraftMode = activeSetlist && currentTrackIndex === activeSetlist.tracks?.length;
  const currentTrack = !isDraftMode && activeSetlist?.tracks ? activeSetlist.tracks[currentTrackIndex] : null;
  const hasBpmChanged = currentTrack && currentTrack.bpm !== bpm;

  useEffect(() => {
    engineRef.current = new MetronomeEngine();
    return () => {
      engineRef.current?.stop();
      releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setBpm(bpm);
  }, [bpm]);

  const requestWakeLock = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (err) {} };
  const releaseWakeLock = async () => { if (wakeLockRef.current !== null) { await wakeLockRef.current.release(); wakeLockRef.current = null; } };

  const handleInitialize = () => {
    if (engineRef.current) engineRef.current.unlock();
    setIsEngineReady(true);
  };

  const togglePlay = () => {
    if (!engineRef.current) return;
    if (isPlaying) { engineRef.current.stop(); setIsPlaying(false); releaseWakeLock(); } 
    else { engineRef.current.start(); setIsPlaying(true); requestWakeLock(); }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (engineRef.current && typeof engineRef.current.setMuted === 'function') {
      engineRef.current.setMuted(newMutedState);
    }
  };

  const handleSync = () => { if (engineRef.current && isPlaying) engineRef.current.sync(); };
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => setBpm(Number(e.target.value));
  const adjustBpm = (amount: number) => setBpm((prev) => Math.min(Math.max(prev + amount, 30), 300));

  // --- LOGIKA BARU: TAP TEMPO (TANPA SUARA & AUTO-PLAY) ---
  const handleTapTempo = () => {
    const now = performance.now();
    
    let newTimes = [...tapTimes, now];
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) {
      newTimes = [now]; // Reset jika jeda antar ketukan lebih dari 2 detik
    }
    if (newTimes.length > 4) newTimes.shift(); // Hanya simpan 4 ketukan terakhir
    
    setTapTimes(newTimes);

    if (newTimes.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < newTimes.length; i++) {
        totalInterval += newTimes[i] - newTimes[i - 1];
      }
      const avgInterval = totalInterval / (newTimes.length - 1);
      const calculatedBpm = Math.round(60000 / avgInterval);
      const finalBpm = Math.min(Math.max(calculatedBpm, 30), 300);
      
      setBpm(finalBpm);
      // Nilai BPM otomatis dikirim ke mesin audio melalui useEffect
    }
  };

  const handleSelectSetlist = (setlist: any) => {
    setActiveSetlist(setlist);
    if (setlist.tracks && setlist.tracks.length > 0) { setCurrentTrackIndex(0); setBpm(setlist.tracks[0].bpm); } 
    else { setCurrentTrackIndex(0); }
  };

  const goNext = () => {
    if (activeSetlist && currentTrackIndex < activeSetlist.tracks.length) {
      const nextIndex = currentTrackIndex + 1;
      setCurrentTrackIndex(nextIndex);
      if (nextIndex < activeSetlist.tracks.length) setBpm(activeSetlist.tracks[nextIndex].bpm);
    }
  };

  const goPrev = () => {
    if (activeSetlist && currentTrackIndex > 0) {
      const prevIndex = currentTrackIndex - 1;
      setCurrentTrackIndex(prevIndex);
      setBpm(activeSetlist.tracks[prevIndex].bpm);
    }
  };

  const handleUpdateBpm = async () => {
    if (!currentTrack) return; setIsProcessing(true);
    try {
      await updateTrackBpm(currentTrack.id, bpm);
      const updated = await getMySetlists();
      const active = updated.find((s: any) => s.id === activeSetlist.id);
      if (active) setActiveSetlist(active);
    } catch (err) { console.error(err); } finally { setIsProcessing(false); }
  };

  const handleSaveNewTrack = async (e: React.FormEvent) => {
    e.preventDefault(); if (!activeSetlist || !newTrackTitle.trim()) return; setIsProcessing(true);
    try {
      await addTrack(activeSetlist.id, newTrackTitle, bpm);
      const updated = await getMySetlists();
      const active = updated.find((s: any) => s.id === activeSetlist.id);
      if (active) { setActiveSetlist(active); setCurrentTrackIndex(active.tracks.length - 1); }
      setIsSaveModalOpen(false); setNewTrackTitle("");
    } catch (err) { console.error(err); } finally { setIsProcessing(false); }
  };

  const confirmDeleteTrack = async () => {
    if (!currentTrack || !activeSetlist) return; setIsDeletingTrack(true);
    try {
      await deleteTrack(currentTrack.id, activeSetlist.id);
      const updated = await getMySetlists();
      const active = updated.find((s: any) => s.id === activeSetlist.id);
      if (active) {
        setActiveSetlist(active);
        if (active.tracks.length === 0) setCurrentTrackIndex(0);
        else { const newIndex = Math.min(currentTrackIndex, active.tracks.length - 1); setCurrentTrackIndex(newIndex); setBpm(active.tracks[newIndex].bpm); }
      }
    } catch (err) { console.error(err); } finally { setIsDeletingTrack(false); setIsDeleteTrackModalOpen(false); }
  };

  if (!isEngineReady) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-md border border-neutral-800 space-y-8 min-h-[500px]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Power className="text-emerald-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Audio Engine</h2>
          <p className="text-neutral-400 text-sm px-4">Membutuhkan interaksi untuk menginisialisasi modul audio bebas latensi.</p>
        </div>
        <button onPointerDown={handleInitialize} className="w-full py-5 rounded-2xl bg-emerald-500 text-neutral-950 font-bold text-lg hover:bg-emerald-400 active:scale-95 transition-all">
          Let's Start
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full max-w-md bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-800 min-h-[550px] overflow-hidden pt-20 pb-6 px-5 sm:px-6">
      
      {session && (
        <div className="absolute top-5 left-5 z-10">
          <button onPointerDown={() => setIsSetlistOpen(true)} className="p-2.5 text-neutral-400 hover:text-emerald-400 bg-neutral-800/80 hover:bg-neutral-800 rounded-full border border-neutral-700 backdrop-blur-md transition-colors shadow-lg touch-manipulation">
            <ListMusic size={20} />
          </button>
        </div>
      )}
      <div className="absolute top-5 right-5 flex items-center gap-3 z-10">
        {session ? (
          <div className="flex items-center gap-2 bg-neutral-800/90 py-1.5 px-2 rounded-full border border-neutral-700 shadow-lg backdrop-blur-md">
            <img src={session.user?.image || ""} alt="Profile" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
            <span className="text-xs font-medium text-white max-w-20 truncate">{session.user?.name?.split(" ")[0]}</span>
            <button onPointerDown={() => signOut()} className="p-1.5 text-neutral-400 hover:text-red-400 touch-manipulation"><LogOut size={14} /></button>
          </div>
        ) : (
          <button onPointerDown={() => signIn('google')} className="flex items-center gap-2 bg-neutral-800 py-1.5 px-3 rounded-full text-xs text-white shadow-lg border border-neutral-700 touch-manipulation">
            <LogIn size={13} /> Sign In
          </button>
        )}
      </div>

      <div className="flex flex-col w-full flex-1 gap-6">
        
        {activeSetlist && (
          <div className="w-full bg-neutral-800/40 border border-neutral-700/50 rounded-2xl p-3 flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <div className="flex flex-col overflow-hidden pr-2">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider truncate">{activeSetlist.name}</span>
                <span className={`font-medium text-base truncate ${isDraftMode ? 'text-neutral-400 italic' : 'text-white'}`}>
                  {isDraftMode ? "[ Ketuk simpan untuk nama lagu ]" : currentTrack?.title}
                </span>
              </div>
              <button onPointerDown={() => setActiveSetlist(null)} className="text-neutral-500 hover:text-red-400 text-xs font-bold bg-neutral-800/80 px-3 py-2 rounded-lg transition-colors touch-manipulation">
                EXIT
              </button>
            </div>

            <div className="flex gap-2">
              {isDraftMode ? (
                <button onPointerDown={() => setIsSaveModalOpen(true)} className="flex-1 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1 touch-manipulation">
                  <Save size={14} /> Simpan Lagu Baru
                </button>
              ) : (
                <>
                  <div className="flex-1 flex gap-2">
                    {hasBpmChanged ? (
                      <button onPointerDown={handleUpdateBpm} disabled={isProcessing} className="flex-1 py-2 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1 touch-manipulation">
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <><Edit3 size={14} /> Update BPM</>}
                      </button>
                    ) : (
                      activeSetlist.tracks?.length < 15 && (
                        <button onPointerDown={() => setCurrentTrackIndex(activeSetlist.tracks.length)} className="flex-1 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-xs font-medium flex items-center justify-center gap-1 touch-manipulation">
                          <PlusCircle size={14} /> Tambah Lagu
                        </button>
                      )
                    )}
                  </div>
                  <button onPointerDown={() => setIsDeleteTrackModalOpen(true)} className="py-2 px-3 bg-red-500/10 text-red-500 border border-red-500/30 rounded-lg flex justify-center touch-manipulation">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between w-full mt-2">
          <button 
            onPointerDown={goPrev} 
            disabled={!activeSetlist || currentTrackIndex === 0} 
            className={`w-16 h-36 flex items-center justify-center rounded-2xl transition-all touch-manipulation ${activeSetlist && currentTrackIndex > 0 ? 'bg-neutral-800 hover:bg-neutral-700 text-white active:scale-95 shadow-md border border-neutral-700' : 'bg-transparent text-neutral-800 opacity-50'}`}
          >
            <ChevronLeft size={48} />
          </button>
          
          <div className="text-center flex-1 flex flex-col items-center justify-center">
            <h2 className="text-neutral-500 text-xs font-bold tracking-widest uppercase mb-1">Tempo</h2>
            
            <div className="text-[5.5rem] leading-[1.1] font-black text-white tracking-tighter select-none">
              {bpm}
            </div>
            
            {/* KONTROL TAP BARU: Diperbesar dan Murni untuk Hitung (Tanpa Suara) */}
            <button 
              onPointerDown={handleTapTempo}
              className="mt-3 w-48 py-4 bg-neutral-800/90 hover:bg-neutral-700 text-emerald-500 border-2 border-neutral-700 rounded-3xl flex items-center justify-center gap-3 active:scale-95 active:bg-emerald-500/20 transition-all touch-manipulation shadow-md"
            >
              <Hand size={20} />
              <span className="text-base font-bold tracking-widest uppercase">TAP TEMPO</span>
            </button>
          </div>

          <button 
            onPointerDown={goNext} 
            disabled={!activeSetlist || isDraftMode || activeSetlist.tracks?.length >= 15} 
            className={`w-16 h-36 flex items-center justify-center rounded-2xl transition-all touch-manipulation ${activeSetlist && !isDraftMode ? 'bg-neutral-800 hover:bg-neutral-700 text-white active:scale-95 shadow-md border border-neutral-700' : 'bg-transparent text-neutral-800 opacity-50'}`}
          >
            <ChevronRight size={48} />
          </button>
        </div>

        <div className="flex items-center w-full gap-3 mt-1">
          <button onPointerDown={() => adjustBpm(-1)} className="p-4 bg-neutral-800 rounded-2xl hover:bg-neutral-700 text-white touch-manipulation"><Minus size={24} /></button>
          <input type="range" min="30" max="300" value={bpm} onChange={handleSliderChange} className="w-full h-3 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
          <button onPointerDown={() => adjustBpm(1)} className="p-4 bg-neutral-800 rounded-2xl hover:bg-neutral-700 text-white touch-manipulation"><Plus size={24} /></button>
        </div>

        <div className="flex flex-col w-full gap-3 mt-1">
          <button 
            onPointerDown={togglePlay} 
            className={`w-full py-8 rounded-[2rem] flex items-center justify-center gap-4 text-3xl font-black transition-all duration-75 touch-manipulation ${
              isPlaying 
                ? 'bg-red-500/10 text-red-500 border-2 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]' 
                : 'bg-emerald-500 text-neutral-950 border-2 border-emerald-400 hover:bg-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.3)] active:scale-[0.98]'
            }`}
          >
            {isPlaying ? <><Square size={32} fill="currentColor" /> STOP</> : <><Play size={32} fill="currentColor" /> PLAY</>}
          </button>

          <div className="flex w-full gap-3">
            <button 
              onPointerDown={handleSync} 
              disabled={!isPlaying} 
              className={`flex-1 py-5 rounded-2xl flex items-center justify-center gap-2 text-lg font-bold border-2 transition-all touch-manipulation ${
                isPlaying ? 'bg-blue-500/10 text-blue-500 border-blue-500/50 active:bg-blue-500/30' : 'bg-neutral-900 text-neutral-700 border-neutral-800'
              }`}
            >
              <RefreshCw size={22} strokeWidth={3} className={isPlaying ? "active:rotate-180 transition-transform" : ""} />
              SYNC
            </button>

            <button 
              onPointerDown={toggleMute} 
              className={`flex-1 py-5 rounded-2xl flex items-center justify-center gap-2 text-lg font-bold border-2 transition-all touch-manipulation ${
                isMuted ? 'bg-amber-500/10 text-amber-500 border-amber-500/50' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'
              }`}
            >
              {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
              {isMuted ? 'MUTED' : 'MUTE'}
            </button>
          </div>
        </div>
      </div>

      <SetlistPanel isOpen={isSetlistOpen} onClose={() => setIsSetlistOpen(false)} onSelectSetlist={handleSelectSetlist} />

      {isSaveModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6 rounded-3xl animate-in fade-in">
          <form onSubmit={handleSaveNewTrack} className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-white font-bold">Simpan Lagu</h3>
            <p className="text-neutral-400 text-sm">Tempo: <span className="text-emerald-500 font-bold">{bpm} BPM</span></p>
            <input type="text" autoFocus placeholder="Judul Lagu..." value={newTrackTitle} onChange={(e) => setNewTrackTitle(e.target.value)} className="w-full bg-neutral-800 text-white px-4 py-3 rounded-xl border border-neutral-700 focus:outline-none focus:border-emerald-500 text-center" />
            <div className="flex gap-3 pt-2">
              <button type="button" onPointerDown={() => setIsSaveModalOpen(false)} className="flex-1 py-3 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700">Batal</button>
              <button type="submit" disabled={!newTrackTitle.trim() || isProcessing} className="flex-1 py-3 rounded-xl bg-emerald-500 text-neutral-950 font-bold hover:bg-emerald-400 flex justify-center">
                {isProcessing ? <Loader2 size={20} className="animate-spin" /> : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isDeleteTrackModalOpen && currentTrack && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6 rounded-3xl animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full text-center space-y-4 shadow-2xl">
            <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
              <Trash2 className="text-red-500" size={24} />
            </div>
            <h3 className="text-white font-bold">Hapus Lagu?</h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Lagu "<span className="text-white font-medium">{currentTrack.title}</span>" akan dihapus permanen.
            </p>
            <div className="flex gap-3 pt-2">
              <button onPointerDown={() => setIsDeleteTrackModalOpen(false)} className="flex-1 py-3 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 transition-colors">Batal</button>
              <button onPointerDown={confirmDeleteTrack} disabled={isDeletingTrack} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 flex justify-center items-center transition-colors">
                {isDeletingTrack ? <Loader2 size={20} className="animate-spin" /> : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}