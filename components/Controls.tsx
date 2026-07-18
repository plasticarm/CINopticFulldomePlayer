
import React, { useRef, useState, useEffect } from 'react';

interface ControlsProps {
  isPlaying: boolean;
  isBuffering?: boolean;
  onTogglePlay: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlSelect: () => void;
  onGoHome: () => void;
  videoName: string;
  progress: number;
  currentTime: number;
  duration: number;
  onToggleFullscreen: () => void;
  onResetCamera: () => void;
  onSeek: (percentage: number) => void;
}

const Controls: React.FC<ControlsProps> = ({ 
  isPlaying, 
  isBuffering,
  onTogglePlay,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  isMuted,
  onToggleMute,
  onFileSelect, 
  onUrlSelect, 
  onGoHome,
  videoName, 
  progress,
  currentTime,
  duration,
  onToggleFullscreen,
  onResetCamera,
  onSeek
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Helper to format time
  const formatTime = (timeInSeconds: number) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return '00:00';
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Helper to calculate percentage from pointer event
  const calculateProgress = (clientX: number) => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    return Math.max(0, Math.min(percentage, 100)); // Clamp between 0 and 100
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    const newProgress = calculateProgress(e.clientX);
    onSeek(newProgress);
  };

  // Add global listeners when dragging starts so interactions continue even if mouse leaves the bar
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMove = (e: PointerEvent) => {
        const newProgress = calculateProgress(e.clientX);
        onSeek(newProgress);
      };

      const handleGlobalUp = () => {
        setIsDragging(false);
      };

      window.addEventListener('pointermove', handleGlobalMove);
      window.addEventListener('pointerup', handleGlobalUp);

      return () => {
        window.removeEventListener('pointermove', handleGlobalMove);
        window.removeEventListener('pointerup', handleGlobalUp);
      };
    }
  }, [isDragging, onSeek]);

  return (
    <div className="fixed bottom-2 sm:bottom-6 left-1/2 -translate-x-1/2 w-[95%] sm:w-[90%] max-w-2xl bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 shadow-2xl z-50 hover:bg-slate-900/80 transition-colors transform scale-75 sm:scale-100 origin-bottom">
      <div className="flex items-center justify-between gap-2 sm:gap-6">
        <div className="flex items-center gap-2 sm:gap-5 flex-1 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2">
            {hasPrev && (
              <button 
                onClick={onPrev}
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg sm:rounded-xl border border-white/5 transition-all active:scale-95 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
            )}
            
            <button 
              onClick={onTogglePlay}
              className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center bg-white text-slate-950 rounded-xl sm:rounded-2xl hover:bg-blue-50 transition-all active:scale-90 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative shrink-0"
            >
              {isBuffering ? (
                <svg className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="sm:w-7 sm:h-7"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="sm:w-7 sm:h-7"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            
            {hasNext && (
              <button 
                onClick={onNext}
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg sm:rounded-xl border border-white/5 transition-all active:scale-95 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
            )}
          </div>
          
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <span className="text-[8px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Now Projecting</span>
            <span className="text-xs sm:text-sm font-bold text-white/90 truncate tracking-tight max-w-[100px] sm:max-w-none">{videoName || 'No Video Selected'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
           {/* Home Button */}
           <button 
            onClick={onGoHome}
            className="bg-slate-800/80 hover:bg-slate-700 text-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/5 transition-all active:scale-95"
            title="Return to Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
           {/* Mute Button */}
           <button 
            onClick={onToggleMute}
            className="bg-slate-800/80 hover:bg-slate-700 text-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/5 transition-all active:scale-95"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
            )}
          </button>
           {/* Reset Camera Button */}
           <button 
            onClick={onResetCamera}
            className="bg-slate-800/80 hover:bg-slate-700 text-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/5 transition-all active:scale-95"
            title="Reset View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          {/* Fullscreen Button */}
          <button 
            onClick={onToggleFullscreen}
            className="bg-slate-800/80 hover:bg-slate-700 text-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/5 transition-all active:scale-95 hidden sm:block"
            title="Immersive Mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>
          <button 
            onClick={onUrlSelect}
            className="bg-slate-800/80 hover:bg-slate-700 text-white px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest border border-white/5 transition-all active:scale-95"
          >
            URL
          </button>
          <label className="cursor-pointer bg-slate-800/80 hover:bg-slate-700 text-white px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest border border-white/5 transition-all active:scale-95">
            File
            <input type="file" accept="video/*" onChange={onFileSelect} className="hidden" />
          </label>
        </div>
      </div>

      {/* Interactive Timeline */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-mono text-slate-400 w-12 text-right">{formatTime(currentTime)}</span>
        <div 
          ref={progressBarRef}
          className="relative flex-1 h-4 group cursor-pointer flex items-center"
          onPointerDown={handlePointerDown}
        >
          {/* Background Track */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-1.5 bg-white/10 rounded-full overflow-hidden group-hover:h-2 transition-all duration-300"></div>
          
          {/* Active Progress */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 left-0 h-1.5 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full pointer-events-none group-hover:h-2 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />

          {/* Draggable Handle */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] cursor-grab active:cursor-grabbing hover:scale-125 transition-transform duration-100"
            style={{ 
              left: `${progress}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>
        <span className="text-xs font-mono text-slate-400 w-12">{formatTime(duration)}</span>
      </div>
    </div>
  );
};

export default Controls;
