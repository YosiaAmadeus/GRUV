"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Minus, Plus, RefreshCw } from "lucide-react";
import { MetronomeEngine } from "../../lib/audio/MetronomeEngine";

export default function MetronomeUI() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const engineRef = useRef<MetronomeEngine | null>(null);
  // Ref untuk menahan status Wake Lock
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Inisialisasi Engine
  useEffect(() => {
    engineRef.current = new MetronomeEngine();
    
    // --- TAMBAHKAN KODE INI ---
    const handleFirstTouch = () => {
      if (engineRef.current) {
        engineRef.current.unlock(); // Panaskan mesin saat layar disentuh!
      }
      // Hapus listener agar tidak memberatkan browser
      document.removeEventListener('pointerdown', handleFirstTouch);
    };
    document.addEventListener('pointerdown', handleFirstTouch);
    // -------------------------

    return () => {
      engineRef.current?.stop();
      releaseWakeLock();
      document.removeEventListener('pointerdown', handleFirstTouch); // Jangan lupa di-cleanup
    };
  }, []);

  // Sinkronisasi BPM
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setBpm(bpm);
    }
  }, [bpm]);

  // Manajemen Layar (Wake Lock API)
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Screen Wake Lock aktif: Layar tidak akan mati.');
      }
    } catch (err: any) {
      console.error(`${err.name}, ${err.message}`);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('Screen Wake Lock dilepas.');
    }
  };

  // Listener: Jika user meminimalkan browser lalu membukanya lagi saat Play
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible' && isPlaying) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying]);

  // Kontrol Play/Stop
  const togglePlay = () => {
    if (!engineRef.current) return;
    
    if (isPlaying) {
      engineRef.current.stop();
      setIsPlaying(false);
      releaseWakeLock(); // Biarkan layar mati normal jika distop
    } else {
      engineRef.current.start();
      setIsPlaying(true);
      requestWakeLock(); // Kunci layar agar tetap nyala saat Play
    }
  };

  const handleSync = () => {
    if (!engineRef.current || !isPlaying) return;
    engineRef.current.sync();
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBpm(Number(e.target.value));
  };

  const adjustBpm = (amount: number) => {
    setBpm((prev) => Math.min(Math.max(prev + amount, 30), 300));
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-12 p-8 bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-md border border-neutral-800">
      
      <div className="text-center space-y-2">
        <h2 className="text-neutral-400 text-sm font-semibold tracking-widest uppercase">Tempo</h2>
        <div className="text-7xl font-black text-white tracking-tighter select-none">
          {bpm} <span className="text-2xl text-neutral-500 font-medium tracking-normal">BPM</span>
        </div>
      </div>

      <div className="flex items-center w-full gap-4">
        <button 
          onPointerDown={() => adjustBpm(-1)}
          className="p-4 bg-neutral-800 rounded-full hover:bg-neutral-700 active:bg-neutral-600 transition-colors text-white touch-manipulation"
        >
          <Minus size={24} />
        </button>
        
        <input 
          type="range" 
          min="30" 
          max="300" 
          value={bpm} 
          onChange={handleSliderChange}
          className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        
        <button 
          onPointerDown={() => adjustBpm(1)}
          className="p-4 bg-neutral-800 rounded-full hover:bg-neutral-700 active:bg-neutral-600 transition-colors text-white touch-manipulation"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="flex w-full gap-4">
        <button 
          onPointerDown={togglePlay}
          className={`flex-1 py-6 rounded-2xl flex items-center justify-center gap-3 text-2xl font-bold transition-all duration-100 touch-manipulation ${
            isPlaying 
              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50' 
              : 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]'
          }`}
        >
          {isPlaying ? (
            <><Square size={28} fill="currentColor" /> Stop</>
          ) : (
            <><Play size={28} fill="currentColor" /> Play</>
          )}
        </button>

        <button
          onPointerDown={handleSync}
          disabled={!isPlaying}
          className={`py-6 px-6 rounded-2xl flex items-center justify-center transition-all duration-100 touch-manipulation border ${
            isPlaying
              ? 'bg-blue-500/10 text-blue-500 border-blue-500/50 hover:bg-blue-500/20 active:bg-blue-500/30 cursor-pointer'
              : 'bg-neutral-800 text-neutral-600 border-neutral-700 cursor-not-allowed'
          }`}
          title="Sync to Beat 1"
        >
          <RefreshCw size={28} strokeWidth={3} className={isPlaying ? "active:rotate-180 transition-transform" : ""} />
        </button>
      </div>
    </div>
  );
}