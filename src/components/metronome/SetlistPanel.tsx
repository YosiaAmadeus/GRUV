"use client";

import { useState, useEffect } from "react";
import { X, Plus, Music, Loader2, Trash2 } from "lucide-react";
import { getMySetlists, createSetlist, deleteSetlist } from "@/actions/setlist";

interface SetlistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSetlist: (setlist: any) => void; // Jembatan untuk mengirim Setlist ke layar utama
}

export default function SetlistPanel({ isOpen, onClose, onSelectSetlist }: SetlistPanelProps) {
  const [setlists, setSetlists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [setlistToDelete, setSetlistToDelete] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSetlists();
    } else {
      setSetlistToDelete(null);
    }
  }, [isOpen]);

  const loadSetlists = async () => {
    setIsLoading(true);
    try {
      const data = await getMySetlists();
      setSetlists(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetName.trim()) return;
    setIsCreating(true);
    try {
      await createSetlist(newSetName);
      setNewSetName("");
      await loadSetlists();
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!setlistToDelete) return;
    setIsDeleting(setlistToDelete.id);
    try {
      await deleteSetlist(setlistToDelete.id);
      await loadSetlists();
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(null);
      setSetlistToDelete(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex bg-neutral-900/95 backdrop-blur-md rounded-3xl overflow-hidden animate-in fade-in duration-200">
      <div className="w-full flex flex-col p-6 h-full relative">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Music size={18} className="text-emerald-500" /> Select Setlist
          </h3>
          <button onPointerDown={onClose} className="p-2 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex gap-2 mb-6">
          <input 
            type="text"
            placeholder={setlists.length >= 5 ? "Maximum of 5 setlists reached." : "Enter a new setlist name"}
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            disabled={setlists.length >= 5}
            className="flex-1 bg-neutral-800 text-sm text-white px-4 py-2.5 rounded-xl border border-neutral-700 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button type="submit" disabled={isCreating || !newSetName.trim() || setlists.length >= 5} className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-700 text-white p-2.5 rounded-xl flex items-center justify-center min-w-11">
            {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          </button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center py-8 text-neutral-500"><Loader2 size={24} className="animate-spin" /></div>
          ) : setlists.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-sm">Belum ada setlist.</div>
          ) : (
            setlists.map((set) => (
              <div key={set.id} 
                onPointerDown={() => {
                  onSelectSetlist(set); // KIRIM DATA SETLIST KE METRONOM UTAMA
                  onClose(); // TUTUP PANEL
                }}
                className="bg-neutral-800/50 hover:bg-emerald-500/10 border border-neutral-700/50 hover:border-emerald-500/30 p-4 rounded-xl cursor-pointer transition-colors group flex justify-between items-center"
              >
                <div>
                  <h4 className="text-white font-medium text-sm">{set.name}</h4>
                  <p className="text-neutral-500 text-xs mt-1">{set.tracks?.length || 0} / 15 tracks</p>
                </div>
                <button
                  onPointerDown={(e) => { e.stopPropagation(); setSetlistToDelete({ id: set.id, name: set.name }); }}
                  className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-700 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Hapus */}
      {setlistToDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full text-center space-y-4">
            <Trash2 className="text-red-500 mx-auto mb-2" size={24} />
            <h3 className="text-white font-bold">Hapus Setlist?</h3>
            <div className="flex gap-3 pt-2">
              <button onPointerDown={() => setSetlistToDelete(null)} className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700">Cancel</button>
              <button onPointerDown={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}