import MetronomeUI from "../components/metronome/MetronomeUI";

export default function Home() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="mb-10 text-center select-none">
        <h1 className="text-5xl font-black text-white tracking-tight">
          GRUV<span className="text-emerald-500">.</span>
        </h1>
        <p className="text-neutral-500 font-medium tracking-wide mt-1">
          Stage-Ready Sequencer
        </p>
      </div>
      
      <MetronomeUI />
    </main>
  );
}