
import React, { useState } from 'react';

interface SettingsProps {
  isOpen: boolean;
  onToggle: () => void;
  isMotionEnabled: boolean;
  onRequestMotion: () => void;
  domeTilt: number;
  onTiltChange: (val: number) => void;
  showMotionButton: boolean;
  currentVideoUrl?: string;
  projectionMode: 'dome' | 'flat';
  onProjectionModeChange: (mode: 'dome' | 'flat') => void;
  smoothFovChange: boolean;
  onSmoothFovChangeToggle: (val: boolean) => void;
  useQuaternionRotation: boolean;
  onUseQuaternionRotationChange: (val: boolean) => void;
  ambientIntensity: number;
  onAmbientIntensityChange: (val: number) => void;
  ambientFalloff: number;
  onAmbientFalloffChange: (val: number) => void;
  restrictViewToEdge: boolean;
  onRestrictViewToEdgeChange: (val: boolean) => void;
  edgePadding: number;
  onEdgePaddingChange: (val: number) => void;
  allowCameraRoll: boolean;
  onAllowCameraRollChange: (val: boolean) => void;
  vignette: number;
  onVignetteChange: (val: number) => void;
  bloom: number;
  onBloomChange: (val: number) => void;
  edgeBlur: number;
  onEdgeBlurChange: (val: number) => void;
  edgeChokeOpacity: number;
  onEdgeChokeOpacityChange: (val: number) => void;
  antialiasing: boolean;
  onAntialiasingChange: (val: boolean) => void;
  bookmarks: { id: string, name: string, url: string }[];
  onAddBookmark: () => void;
  onRemoveBookmark: (id: string) => void;
  onSelectBookmark: (url: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  isOpen, 
  onToggle, 
  isMotionEnabled, 
  onRequestMotion, 
  domeTilt, 
  onTiltChange,
  showMotionButton,
  currentVideoUrl,
  projectionMode,
  onProjectionModeChange,
  smoothFovChange,
  onSmoothFovChangeToggle,
  useQuaternionRotation,
  onUseQuaternionRotationChange,
  ambientIntensity,
  onAmbientIntensityChange,
  ambientFalloff,
  onAmbientFalloffChange,
  restrictViewToEdge,
  onRestrictViewToEdgeChange,
  edgePadding,
  onEdgePaddingChange,
  allowCameraRoll,
  onAllowCameraRollChange,
  vignette,
  onVignetteChange,
  bloom,
  onBloomChange,
  edgeBlur,
  onEdgeBlurChange,
  edgeChokeOpacity,
  onEdgeChokeOpacityChange,
  antialiasing,
  onAntialiasingChange,
  bookmarks,
  onAddBookmark,
  onRemoveBookmark,
  onSelectBookmark
}) => {
  const [copied, setCopied] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  const generateEmbedCode = () => {
    if (!currentVideoUrl || currentVideoUrl.startsWith('blob:')) {
      return "Embed code only available for remote URLs.";
    }
    const baseUrl = window.location.origin + window.location.pathname;
    const embedUrl = `${baseUrl}?url=${encodeURIComponent(currentVideoUrl)}&tilt=${domeTilt}&autoplay=${autoplayEnabled ? '1' : '0'}`;
    return `<iframe src="${embedUrl}" width="800" height="450" frameborder="0" allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"></iframe>`;
  };

  const copyToClipboard = () => {
    const code = generateEmbedCode();
    if (code.startsWith('<iframe')) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div 
      className={`fixed bottom-40 left-0 z-[60] transition-transform duration-500 ease-in-out flex items-end ${
        isOpen ? 'translate-x-0' : '-translate-x-80'
      }`}
    >
      {/* Main Panel */}
      <div className="w-80 max-h-[70vh] p-6 bg-slate-900/95 backdrop-blur-2xl border-r border-t border-purple-500/20 shadow-2xl flex flex-col gap-6 rounded-tr-2xl overflow-y-auto pointer-events-auto">
        <h2 className="text-xs font-black tracking-[0.2em] uppercase text-white/60 border-b border-white/5 pb-2">Simulator Settings</h2>
        
        {/* Projection Mode Toggle */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Projection Mode</span>
          <div className="flex bg-slate-800 rounded-xl p-1 border border-white/5">
            <button 
              onClick={() => onProjectionModeChange('dome')}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                projectionMode === 'dome' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dome
            </button>
            <button 
              onClick={() => onProjectionModeChange('flat')}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                projectionMode === 'flat' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              Flat
            </button>
          </div>
        </div>

        {/* Smooth FOV Change Toggle */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Smooth FOV Change</span>
            <button 
              onClick={() => onSmoothFovChangeToggle(!smoothFovChange)}
              className="flex items-center gap-2 group"
            >
              <div className={`w-8 h-4 rounded-full relative transition-colors ${smoothFovChange ? 'bg-purple-600' : 'bg-slate-800'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${smoothFovChange ? 'left-4.5' : 'left-0.5'}`}></div>
              </div>
            </button>
          </div>
        </div>

        {/* Quaternion Rotation Toggle */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Quaternion Rotation</span>
            <button 
              onClick={() => onUseQuaternionRotationChange(!useQuaternionRotation)}
              className="flex items-center gap-2 group"
            >
              <div className={`w-8 h-4 rounded-full relative transition-colors ${useQuaternionRotation ? 'bg-purple-600' : 'bg-slate-800'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${useQuaternionRotation ? 'left-4.5' : 'left-0.5'}`}></div>
              </div>
            </button>
          </div>
        </div>

        {/* Restrict View to Edge Toggle */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Restrict View to Edge</span>
            <button 
              onClick={() => onRestrictViewToEdgeChange(!restrictViewToEdge)}
              className="flex items-center gap-2 group"
            >
              <div className={`w-8 h-4 rounded-full relative transition-colors ${restrictViewToEdge ? 'bg-purple-600' : 'bg-slate-800'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${restrictViewToEdge ? 'left-4.5' : 'left-0.5'}`}></div>
              </div>
            </button>
          </div>
        </div>

        {restrictViewToEdge && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Edge Padding</span>
              <span className="text-[10px] font-mono text-white/40">{edgePadding.toFixed(1)}°</span>
            </div>
            <input 
              type="range" min="0" max="30" step="0.5"
              value={edgePadding}
              onChange={(e) => onEdgePaddingChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>
        )}

        {/* Allow Camera Roll Toggle */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Allow Camera Roll</span>
            <button 
              onClick={() => onAllowCameraRollChange(!allowCameraRoll)}
              className="flex items-center gap-2 group"
            >
              <div className={`w-8 h-4 rounded-full relative transition-colors ${allowCameraRoll ? 'bg-purple-600' : 'bg-slate-800'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${allowCameraRoll ? 'left-4.5' : 'left-0.5'}`}></div>
              </div>
            </button>
          </div>
        </div>

        {/* Post Processing Effects */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Post Processing</span>
          
          <div className="flex flex-col gap-2 pl-2 border-l-2 border-purple-900/50">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vignette</span>
              <span className="text-[10px] font-bold text-slate-500">{Math.round(vignette * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="-1" max="1" step="0.01" 
              value={vignette} 
              onChange={(e) => onVignetteChange(parseFloat(e.target.value))}
              className="w-full accent-purple-500 bg-slate-800 rounded-lg appearance-none h-1.5"
            />
          </div>

          <div className="flex flex-col gap-2 pl-2 border-l-2 border-purple-900/50">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bloom</span>
              <span className="text-[10px] font-bold text-slate-500">{Math.round((bloom / 15) * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="15" step="0.1" 
              value={bloom} 
              onChange={(e) => onBloomChange(parseFloat(e.target.value))}
              className="w-full accent-purple-500 bg-slate-800 rounded-lg appearance-none h-1.5"
            />
          </div>

          <div className="flex flex-col gap-2 pl-2 border-l-2 border-purple-900/50">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Edge Blur</span>
              <span className="text-[10px] font-bold text-slate-500">{Math.round(edgeBlur * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={edgeBlur} 
              onChange={(e) => onEdgeBlurChange(parseFloat(e.target.value))}
              className="w-full accent-purple-500 bg-slate-800 rounded-lg appearance-none h-1.5"
            />
          </div>

          <div className="flex flex-col gap-2 pl-2 border-l-2 border-purple-900/50">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Edge Choke</span>
              <span className="text-[10px] font-bold text-slate-500">{Math.round(edgeChokeOpacity * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={edgeChokeOpacity} 
              onChange={(e) => onEdgeChokeOpacityChange(parseFloat(e.target.value))}
              className="w-full accent-purple-500 bg-slate-800 rounded-lg appearance-none h-1.5"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300">Antialiasing (SMAA)</span>
            <button
              onClick={() => onAntialiasingChange(!antialiasing)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${antialiasing ? 'bg-purple-500' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${antialiasing ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {showMotionButton && (
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Motion Controls</span>
            <button 
              onClick={onRequestMotion}
              className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-3 ${
                isMotionEnabled ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' : 'bg-slate-800 text-slate-400 border border-white/5'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
              {isMotionEnabled ? 'Gyroscope Active' : 'Enable Gyroscope'}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Dome Pitch (Tilt)</span>
            <span className="text-[10px] font-mono text-white/40">{domeTilt}°</span>
          </div>
          <input 
            type="range" min="-90" max="90" step="1"
            value={domeTilt}
            onChange={(e) => onTiltChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Ambient Light Spill</span>
            <span className="text-[10px] font-mono text-white/40">{Math.round(ambientIntensity * 100)}%</span>
          </div>
          <input 
            type="range" min="0" max="2" step="0.05"
            value={ambientIntensity}
            onChange={(e) => onAmbientIntensityChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Spill Falloff</span>
            <span className="text-[10px] font-mono text-white/40">{ambientFalloff.toFixed(1)}</span>
          </div>
          <input 
            type="range" min="1" max="50" step="0.5"
            value={ambientFalloff}
            onChange={(e) => onAmbientFalloffChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Bookmarks */}
        <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Bookmarks</span>
            <button 
              onClick={onAddBookmark}
              disabled={!currentVideoUrl}
              className="text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            >
              + Save Current
            </button>
          </div>
          {bookmarks.length === 0 ? (
            <p className="text-[10px] text-white/30 italic">No bookmarks saved.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="flex justify-between items-center bg-slate-800/50 rounded-lg p-2 border border-white/5 group hover:border-purple-500/30 transition-colors">
                  <button 
                    onClick={() => onSelectBookmark(bookmark.url)}
                    className="flex-1 text-left flex flex-col min-w-0 mr-2"
                  >
                    <span className="text-[11px] font-bold text-slate-200 truncate">{bookmark.name}</span>
                    <span className="text-[9px] text-slate-500 truncate">{bookmark.url.startsWith('blob:') ? 'Local File' : bookmark.url}</span>
                  </button>
                  <button 
                    onClick={() => onRemoveBookmark(bookmark.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-all shrink-0"
                    title="Remove Bookmark"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Embed Simulator */}
        <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Embed Simulator</span>
            <button 
              onClick={() => setAutoplayEnabled(!autoplayEnabled)}
              className="flex items-center gap-2 group"
            >
              <span className="text-[8px] font-black uppercase tracking-tighter text-white/30 group-hover:text-purple-400 transition-colors">Autoplay</span>
              <div className={`w-8 h-4 rounded-full relative transition-colors ${autoplayEnabled ? 'bg-purple-600' : 'bg-slate-800'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${autoplayEnabled ? 'left-4.5' : 'left-0.5'}`}></div>
              </div>
            </button>
          </div>
          <div className="bg-black/40 rounded-xl p-3 border border-white/5">
            <code className="text-[9px] text-white/40 break-all leading-tight">
              {generateEmbedCode()}
            </code>
          </div>
          <button 
            onClick={copyToClipboard}
            disabled={!currentVideoUrl || currentVideoUrl.startsWith('blob:')}
            className={`w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              copied ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            } disabled:opacity-20`}
          >
            {copied ? 'Copied!' : 'Copy Embed Code'}
          </button>
          {!currentVideoUrl?.startsWith('http') && (
            <p className="text-[8px] text-white/20 italic">Note: Remote video required for embedding.</p>
          )}
        </div>
      </div>

      {/* Tab Handle */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="w-12 h-12 bg-slate-900/95 border-r border-t border-b border-purple-500/30 backdrop-blur-xl rounded-r-2xl flex items-center justify-center hover:bg-slate-800 transition-colors shadow-[4px_0_15px_rgba(0,0,0,0.5)] group pointer-events-auto"
        aria-label="Toggle Settings"
      >
        <div className={`transition-all duration-500 ${isOpen ? 'rotate-180 opacity-40 scale-75' : 'rotate-0 opacity-100 scale-100'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:text-purple-300">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </div>
      </button>
    </div>
  );
};

export default Settings;
