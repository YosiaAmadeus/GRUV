"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Minus, Plus, RefreshCw, Power, LogIn, LogOut, ListMusic, ChevronLeft, ChevronRight, Save, Loader2, Edit3, PlusCircle, Trash2, Volume2, VolumeX, Hand } from "lucide-react";
import { MetronomeEngine } from "../../lib/audio/MetronomeEngine";
import { useSession, signIn, signOut } from "next-auth/react";
import SetlistPanel from "./SetlistPanel";
import { addTrack, getMySetlists, updateTrackSettings, deleteTrack } from "@/actions/setlist";

export default function MetronomeUI() {
  const { data: session } = useSession();
  const [isSetlistOpen, setIsSetlistOpen] = useState(false);
  
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const [subdivision, setSubdivision] = useState(1); 
  const [timeSignature, setTimeSignature] = useState(4);
  const [visualBeat, setVisualBeat] = useState(1);
  const [visualSub, setVisualSub] = useState(0);
  
  const engineRef = useRef<any>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const [activeSetlist, setActiveSetlist] = useState<any | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleteTrackModalOpen, setIsDeleteTrackModalOpen] = useState(false);
  const [isDeletingTrack, setIsDeletingTrack] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  const isDraftMode = activeSetlist && currentTrackIndex === activeSetlist.tracks?.length;
  const currentTrack = !isDraftMode && activeSetlist?.tracks ? activeSetlist.tracks[currentTrackIndex] : null;
  
  const hasSettingsChanged = currentTrack && (
    currentTrack.bpm !== bpm || 
    currentTrack.timeSignature !== timeSignature || 
    currentTrack.subdivision !== subdivision
  );

  useEffect(() => {
    engineRef.current = new MetronomeEngine();
    engineRef.current.onBeatVisual = (beat: number, sub: number) => {
      setVisualBeat(beat);
      setVisualSub(sub);
    };

    const unlockAudio = () => {
      if (engineRef.current) engineRef.current.unlock();
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });

    return () => {
      engineRef.current?.stop();
      releaseWakeLock();
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
  }, []);

  useEffect(() => { if (engineRef.current) engineRef.current.setBpm(bpm); }, [bpm]);
  useEffect(() => { if (engineRef.current) engineRef.current.setSubdivision(subdivision); }, [subdivision]);
  useEffect(() => { if (engineRef.current) engineRef.current.setBeatsPerBar(timeSignature); }, [timeSignature]);

  const requestWakeLock = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (err) {} };
  const releaseWakeLock = async () => { if (wakeLockRef.current !== null) { await wakeLockRef.current.release(); wakeLockRef.current = null; } };
  
  const togglePlay = () => { 
    if (!engineRef.current) return; 
    engineRef.current.unlock();
    if (isPlaying) { 
      engineRef.current.stop(); 
      setIsPlaying(false); 
      releaseWakeLock(); 
    } else { 
      engineRef.current.start(); 
      setIsPlaying(true); 
      requestWakeLock(); 
    } 
  };
  
  const toggleMute = () => { const newMutedState = !isMuted; setIsMuted(newMutedState); if (engineRef.current && typeof engineRef.current.setMuted === 'function') { engineRef.current.setMuted(newMutedState); } };
  const handleSync = () => { if (engineRef.current && isPlaying) engineRef.current.sync(); };
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => setBpm(Number(e.target.value));
  const adjustBpm = (amount: number) => setBpm((prev) => Math.min(Math.max(prev + amount, 30), 300));

  const handleTapTempo = () => {
    if (engineRef.current) engineRef.current.unlock();
    const now = performance.now();
    let newTimes = [...tapTimes, now];
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) newTimes = [now]; 
    if (newTimes.length > 4) newTimes.shift(); 
    setTapTimes(newTimes);

    if (newTimes.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < newTimes.length; i++) totalInterval += newTimes[i] - newTimes[i - 1];
      const avgInterval = totalInterval / (newTimes.length - 1);
      setBpm(Math.min(Math.max(Math.round(60000 / avgInterval), 30), 300));
    }
  };

  const handleSelectSetlist = (setlist: any) => { 
    setActiveSetlist(setlist); 
    if (setlist.tracks && setlist.tracks.length > 0) { 
      setCurrentTrackIndex(0); 
      setBpm(setlist.tracks[0].bpm); 
      setTimeSignature(setlist.tracks[0].timeSignature || 4);
      setSubdivision(setlist.tracks[0].subdivision || 1);
    } else { 
      setCurrentTrackIndex(0); 
    } 
  };
  
  const goNext = () => { 
    if (activeSetlist && activeSetlist.tracks && activeSetlist.tracks.length > 0) { 
      let nextIndex = currentTrackIndex + 1; 
      if (nextIndex >= activeSetlist.tracks.length) nextIndex = 0;
      setCurrentTrackIndex(nextIndex); 
      setBpm(activeSetlist.tracks[nextIndex].bpm);
      setTimeSignature(activeSetlist.tracks[nextIndex].timeSignature || 4);
      setSubdivision(activeSetlist.tracks[nextIndex].subdivision || 1);
    } 
  };
  
  const goPrev = () => { 
    if (activeSetlist && activeSetlist.tracks && activeSetlist.tracks.length > 0) { 
      let prevIndex = currentTrackIndex - 1; 
      if (prevIndex < 0) prevIndex = activeSetlist.tracks.length - 1;
      setCurrentTrackIndex(prevIndex); 
      setBpm(activeSetlist.tracks[prevIndex].bpm); 
      setTimeSignature(activeSetlist.tracks[prevIndex].timeSignature || 4);
      setSubdivision(activeSetlist.tracks[prevIndex].subdivision || 1);
    } 
  };
  
  const handleUpdateSettings = async () => { if (!currentTrack) return; setIsProcessing(true); try { await updateTrackSettings(currentTrack.id, bpm, timeSignature, subdivision); const updated = await getMySetlists(); const active = updated.find((s: any) => s.id === activeSetlist.id); if (active) setActiveSetlist(active); } catch (err) { console.error(err); } finally { setIsProcessing(false); } };
  const handleSaveNewTrack = async (e: React.FormEvent) => { e.preventDefault(); if (!activeSetlist || !newTrackTitle.trim()) return; setIsProcessing(true); try { await addTrack(activeSetlist.id, newTrackTitle, bpm, timeSignature, subdivision); const updated = await getMySetlists(); const active = updated.find((s: any) => s.id === activeSetlist.id); if (active) { setActiveSetlist(active); setCurrentTrackIndex(active.tracks.length - 1); } setIsSaveModalOpen(false); setNewTrackTitle(""); } catch (err) { console.error(err); } finally { setIsProcessing(false); } };
  const confirmDeleteTrack = async () => { if (!currentTrack || !activeSetlist) return; setIsDeletingTrack(true); try { await deleteTrack(currentTrack.id, activeSetlist.id); const updated = await getMySetlists(); const active = updated.find((s: any) => s.id === activeSetlist.id); if (active) { setActiveSetlist(active); if (active.tracks.length === 0) setCurrentTrackIndex(0); else { const newIndex = Math.min(currentTrackIndex, active.tracks.length - 1); setCurrentTrackIndex(newIndex); setBpm(active.tracks[newIndex].bpm); setTimeSignature(active.tracks[newIndex].timeSignature || 4); setSubdivision(active.tracks[newIndex].subdivision || 1); } } } catch (err) { console.error(err); } finally { setIsDeletingTrack(false); setIsDeleteTrackModalOpen(false); } };

  return (
    // PADDING KIRI KANAN DIPERKECIL (px-3) AGAR TOMBOL BISA MAKSIMAL
    <div className="fixed inset-0 sm:relative sm:inset-auto flex flex-col w-full h-[100dvh] sm:h-auto sm:min-h-[650px] max-w-md mx-auto bg-neutral-900 sm:rounded-3xl shadow-2xl sm:border border-neutral-800 overflow-hidden pt-12 pb-3 px-3 sm:px-6">
      
      {session && (
        <div className="absolute top-3 left-3 z-10">
          <button onClick={() => setIsSetlistOpen(true)} className="p-2.5 text-neutral-400 hover:text-emerald-400 bg-neutral-800/80 hover:bg-neutral-800 rounded-full border border-neutral-700 backdrop-blur-md transition-colors shadow-lg touch-manipulation">
            <ListMusic size={20} />
          </button>
        </div>
      )}
      <div className="absolute top-3 right-3 flex items-center gap-3 z-10">
        {session ? (
          <div className="flex items-center gap-2 bg-neutral-800/90 py-1.5 px-2 rounded-full border border-neutral-700 shadow-lg backdrop-blur-md">
            <img src={session.user?.image || ""} alt="Profile" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
            <span className="text-xs font-medium text-white max-w-20 truncate">{session.user?.name?.split(" ")[0]}</span>
            <button onClick={() => signOut()} className="p-1.5 text-neutral-400 hover:text-red-400 touch-manipulation"><LogOut size={14} /></button>
          </div>
        ) : (
          <button onClick={() => signIn('google')} className="flex items-center gap-2 bg-neutral-800 py-1.5 px-3 rounded-full text-xs text-white shadow-lg border border-neutral-700 touch-manipulation"><LogIn size={13} /> Sign In</button>
        )}
      </div>

      <div className="flex flex-col w-full h-full flex-1 justify-between gap-1.5">
        
        {activeSetlist && (
          <div className="w-full bg-neutral-800/40 border border-neutral-700/50 rounded-2xl p-2 flex flex-col gap-1.5 animate-in fade-in duration-200 shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex flex-col overflow-hidden pr-2">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider truncate">{activeSetlist.name}</span>
                <span className={`font-medium text-sm truncate ${isDraftMode ? 'text-neutral-400 italic' : 'text-white'}`}>
                  {isDraftMode ? "[ Ketuk simpan ]" : currentTrack?.title}
                </span>
              </div>
              <button onClick={() => setActiveSetlist(null)} className="text-neutral-500 hover:text-red-400 text-[10px] font-bold bg-neutral-800/80 px-2 py-1.5 rounded-lg transition-colors touch-manipulation">EXIT</button>
            </div>
            <div className="flex gap-2">
              {isDraftMode ? (
                <button onClick={() => setIsSaveModalOpen(true)} className="flex-1 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1 touch-manipulation"><Save size={14} /> Simpan Lagu Baru</button>
              ) : (
                <>
                  <div className="flex-1 flex gap-2">
                    {hasSettingsChanged ? (
                      <button onClick={handleUpdateSettings} disabled={isProcessing} className="flex-1 py-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1 touch-manipulation">
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <><Edit3 size={14} /> Update Setting</>}
                      </button>
                    ) : (
                      activeSetlist.tracks?.length < 15 && (
                        <button onClick={() => { setCurrentTrackIndex(activeSetlist.tracks.length); setBpm(120); setTimeSignature(4); setSubdivision(1); }} className="flex-1 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-xs font-medium flex items-center justify-center gap-1 touch-manipulation"><PlusCircle size={14} /> Tambah Lagu</button>
                      )
                    )}
                  </div>
                  <button onClick={() => setIsDeleteTrackModalOpen(true)} className="py-1.5 px-3 bg-red-500/10 text-red-500 border border-red-500/30 rounded-lg flex justify-center touch-manipulation"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between w-full flex-1 min-h-[140px] py-1">
          {/* TOMBOL PANAH KEMBALI BESAR (w-16 h-36, icon 48px) */}
          <button onClick={goPrev} disabled={!activeSetlist || isDraftMode || activeSetlist.tracks?.length <= 1} className={`w-16 h-36 shrink-0 flex items-center justify-center rounded-2xl transition-all touch-manipulation ${activeSetlist && !isDraftMode && activeSetlist.tracks?.length > 1 ? 'bg-neutral-800 hover:bg-neutral-700 text-white active:scale-95 shadow-md border border-neutral-700' : 'bg-transparent text-neutral-800 opacity-50'}`}><ChevronLeft size={48} /></button>
          
          <div className="text-center flex-1 flex flex-col items-center justify-center mx-1">
            <div className="flex justify-center items-center gap-1 w-full mb-1 h-[32px]">
              {Array.from({ length: timeSignature }).map((_, i) => {
                const beatNum = i + 1;
                const isCurrentBeat = isPlaying && visualBeat === beatNum;
                const isMain = isCurrentBeat && visualSub === 0;
                let circleClass = 'bg-neutral-800 text-neutral-600 border border-neutral-700/50'; 
                if (isCurrentBeat) {
                  if (isMain) circleClass = beatNum === 1 ? 'bg-amber-500 text-amber-950 scale-110 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 text-emerald-950 scale-110 shadow-[0_0_12px_rgba(16,185,129,0.5)]'; 
                  else circleClass = 'bg-emerald-500/30 text-emerald-200 border-emerald-500/50 scale-105';
                }
                return (
                  // VISUAL CUES KEMBALI BESAR (w-7 h-7)
                  <div key={beatNum} className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-75 ${circleClass}`}>{beatNum}</div>
                );
              })}
            </div>

            {/* TEXT TEMPO KEMBALI RAKSASA (5rem) */}
            <div className="text-[5rem] leading-[1] font-black text-white tracking-tighter select-none">{bpm}</div>
            
            {/* TAP TEMPO KEMBALI BESAR (w-48, icon 20px) */}
            <button onPointerDown={handleTapTempo} className="mt-3 w-48 py-4 shrink-0 bg-neutral-800/90 hover:bg-neutral-700 text-emerald-500 border-2 border-neutral-700 rounded-3xl flex items-center justify-center gap-2 active:scale-95 transition-all touch-manipulation shadow-md">
              <Hand size={20} /> <span className="text-base font-bold tracking-widest uppercase">TAP</span>
            </button>
          </div>

          <button onClick={goNext} disabled={!activeSetlist || isDraftMode || activeSetlist.tracks?.length <= 1} className={`w-16 h-36 shrink-0 flex items-center justify-center rounded-2xl transition-all touch-manipulation ${activeSetlist && !isDraftMode && activeSetlist.tracks?.length > 1 ? 'bg-neutral-800 hover:bg-neutral-700 text-white active:scale-95 shadow-md border border-neutral-700' : 'bg-transparent text-neutral-800 opacity-50'}`}><ChevronRight size={48} /></button>
        </div>

        <div className="flex flex-col shrink-0">
          {/* TOMBOL PLUS MINUS KEMBALI BESAR (p-4) */}
          <div className="flex items-center w-full gap-3 mb-1.5">
            <button onClick={() => adjustBpm(-1)} className="p-4 bg-neutral-800 rounded-2xl hover:bg-neutral-700 text-white touch-manipulation shrink-0"><Minus size={24} /></button>
            <input type="range" min="30" max="300" value={bpm} onChange={handleSliderChange} className="w-full h-3 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
            <button onClick={() => adjustBpm(1)} className="p-4 bg-neutral-800 rounded-2xl hover:bg-neutral-700 text-white touch-manipulation shrink-0"><Plus size={24} /></button>
          </div>

          <div className="flex w-full bg-neutral-800/60 p-1.5 rounded-2xl shadow-sm border border-neutral-700/50 mb-1">
            {[3, 4, 6, 7, 8].map(ts => (
              <button key={ts} onClick={() => setTimeSignature(ts)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all touch-manipulation ${timeSignature === ts ? 'bg-amber-500/10 text-amber-500 shadow-sm border border-amber-500/30' : 'text-neutral-400 hover:text-neutral-200 border border-transparent'}`}>
                {ts}/4
              </button>
            ))}
          </div>

          <div className="flex w-full bg-neutral-800/80 p-1.5 rounded-2xl shadow-sm border border-neutral-700/50">
            {[ { label: '1/4', val: 1 }, { label: '1/8', val: 2 }, { label: 'Trip', val: 3 }, { label: '1/16', val: 4 } ].map(item => (
              <button key={item.val} onClick={() => setSubdivision(item.val)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all touch-manipulation tracking-wider ${subdivision === item.val ? 'bg-emerald-500/10 text-emerald-500 shadow-sm border border-emerald-500/30' : 'text-neutral-400 hover:text-neutral-200 border border-transparent'}`}>
                {item.label}
              </button>
            ))}
          </div>

          {/* PERHATIKAN INI: mt-5 DITAMBAHKAN UNTUK MENJAUHKAN TOMBOL PLAY DARI PENGATURAN DI ATASNYA */}
          <div className="flex flex-col w-full gap-2 mt-5">
            {/* TOMBOL PLAY KEMBALI RAKSASA (py-8, text-3xl) */}
            <button onClick={togglePlay} className={`w-full py-7 sm:py-8 rounded-[2rem] flex items-center justify-center gap-4 text-3xl font-black transition-all duration-75 touch-manipulation shrink-0 ${isPlaying ? 'bg-red-500/10 text-red-500 border-2 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]' : 'bg-emerald-500 text-neutral-950 border-2 border-emerald-400 hover:bg-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.3)] active:scale-[0.98]'}`}>
              {isPlaying ? <><Square size={32} fill="currentColor" /> STOP</> : <><Play size={32} fill="currentColor" /> PLAY</>}
            </button>
            <div className="flex w-full gap-3">
              {/* TOMBOL SYNC & MUTE KEMBALI BESAR (py-4/py-5) */}
              <button onClick={handleSync} disabled={!isPlaying} className={`flex-1 py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-2 text-lg font-bold border-2 transition-all touch-manipulation shrink-0 ${isPlaying ? 'bg-blue-500/10 text-blue-500 border-blue-500/50 active:bg-blue-500/30' : 'bg-neutral-900 text-neutral-700 border-neutral-800'}`}>
                <RefreshCw size={22} strokeWidth={3} className={isPlaying ? "active:rotate-180 transition-transform" : ""} /> SYNC
              </button>
              <button onClick={toggleMute} className={`flex-1 py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-2 text-lg font-bold border-2 transition-all touch-manipulation shrink-0 ${isMuted ? 'bg-amber-500/10 text-amber-500 border-amber-500/50' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'}`}>
                {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />} {isMuted ? 'MUTED' : 'MUTE'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <SetlistPanel isOpen={isSetlistOpen} onClose={() => setIsSetlistOpen(false)} onSelectSetlist={handleSelectSetlist} />

      {/* Modal Simpan */}
      {isSaveModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6 rounded-3xl animate-in fade-in">
          <form onSubmit={handleSaveNewTrack} className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-white font-bold">Simpan Lagu</h3>
            <p className="text-neutral-400 text-sm">Tempo: <span className="text-emerald-500 font-bold">{bpm} BPM</span> | <span className="text-amber-500 font-bold">{timeSignature}/4</span></p>
            <input type="text" autoFocus placeholder="Judul Lagu..." value={newTrackTitle} onChange={(e) => setNewTrackTitle(e.target.value)} className="w-full bg-neutral-800 text-white px-4 py-3 rounded-xl border border-neutral-700 focus:outline-none focus:border-emerald-500 text-center" />
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-3 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700">Batal</button>
              <button type="submit" disabled={!newTrackTitle.trim() || isProcessing} className="flex-1 py-3 rounded-xl bg-emerald-500 text-neutral-950 font-bold hover:bg-emerald-400 flex justify-center">
                {isProcessing ? <Loader2 size={20} className="animate-spin" /> : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Hapus */}
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
              <button onClick={() => setIsDeleteTrackModalOpen(false)} className="flex-1 py-3 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 transition-colors">Batal</button>
              <button onClick={confirmDeleteTrack} disabled={isDeletingTrack} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 flex justify-center items-center transition-colors">
                {isDeletingTrack ? <Loader2 size={20} className="animate-spin" /> : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}