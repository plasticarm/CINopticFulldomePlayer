
import React from 'react';

interface ControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlSelect: () => void;
  videoName: string;
  progress: number;
  onToggleFullscreen: () => void;
  onResetCamera: () => void;
}

const Controls: React.FC<ControlsProps> = ({ 
  isPlaying, 
  onTogglePlay,
  isMuted,
  onToggleMute,
  onFileSelect, 
  onUrlSelect, 
  videoName, 
  progress,
  onToggleFullscreen,
  onResetCamera
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 flex flex-col gap-4 shadow-2xl z-50 hover:bg-slate-900/80 transition-colors">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-5 flex-1">
          <button 
            onClick={onTogglePlay}
            className="w-14 h-14 flex items-center justify-center bg-white text-slate-950 rounded-2xl hover:bg-blue-50 transition-all active:scale-90 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Now Projecting</span>
            <span className="text-sm font-bold text-white/90 truncate tracking-tight">{videoName || 'No Video Selected'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {/* Mute Button */}
           <button 
            onClick={onToggleMute}
            className="bg-slate-800/80 hover:bg-slate-700 text-white p-2.5 rounded-xl border border-white/5 transition-all active:scale-95"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
            )}
          </button>

           {/* Reset Camera Button */}
           <button 
            onClick={onResetCamera}
            className="bg-slate-800/80 hover:bg-slate-700 text-white p-2.5 rounded-xl border border-white/5 transition-all active:scale-95"
            title="Reset View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>

          {/* Fullscreen Button */}
          <button 
            onClick={onToggleFullscreen}
            className="bg-slate-800/80 hover:bg-slate-700 text-white p-2.5 rounded-xl border border-white/5 transition-all active:scale-95"
            title="Immersive Mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>

          <button 
            onClick={onUrlSelect}
            className="bg-slate-800/80 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-white/5 transition-all active:scale-95"
          >
            URL
          </button>
          <label className="cursor-pointer bg-slate-800/80 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-white/5 transition-all active:scale-95">
            File
            <input type="file" accept="video/*" onChange={onFileSelect} className="hidden" />
          </label>
        </div>
      </div>

      <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default Controls;
