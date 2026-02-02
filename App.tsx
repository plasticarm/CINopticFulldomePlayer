
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore } from '@react-three/xr';
import Scene from './components/Scene';
import Controls from './components/Controls';
import AIAssistant from './components/AIAssistant';
import Settings from './components/Settings';
import { VideoData } from './types';

const App: React.FC = () => {
  const [video, setVideo] = useState<VideoData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMotionEnabled, setIsMotionEnabled] = useState(false);
  const [showMotionButton, setShowMotionButton] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [domeTilt, setDomeTilt] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // New State for Fullscreen and Projection Mode
  const [isImmersive, setIsImmersive] = useState(false);
  const [projectionMode, setProjectionMode] = useState<'dome' | 'flat'>('dome');
  
  // Camera Reset Trigger
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsTimerRef = useRef<number | null>(null);

  // Handle Fullscreen changes (e.g. user presses ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsImmersive(isFs);
      // Ensure controls are visible when exiting fullscreen
      if (!isFs) setShowControls(true);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleImmersiveMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const loadVideoFromUrl = useCallback((url: string, autoPlay: boolean = true) => {
    if (!videoRef.current || !url) return;
    
    setErrorMsg(null); // Clear previous errors
    let finalUrl = url.trim();
    
    // --- LINK PARSERS ---

    // 1. Google Drive
    if (finalUrl.includes('google.com') && (finalUrl.includes('drive') || finalUrl.includes('docs'))) {
      const idMatch = finalUrl.match(/(?:\/d\/|\/file\/d\/|id=)([-\w]+)/);
      if (idMatch && idMatch[1]) {
        finalUrl = `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
      }
    }
    // 2. Dropbox (Convert dl=0 to dl=1)
    else if (finalUrl.includes('dropbox.com')) {
      finalUrl = finalUrl.replace('dl=0', 'dl=1');
    }
    // 3. OneDrive (Convert embed to download)
    else if (finalUrl.includes('onedrive.live.com')) {
      finalUrl = finalUrl.replace('/embed', '/download');
    }

    setVideo({
      url: finalUrl,
      name: finalUrl.split('/').pop()?.split('?')[0] || 'Remote Stream',
      type: 'video/mp4'
    });
    
    videoRef.current.src = finalUrl;
    videoRef.current.load(); // Ensure load is triggered
    
    if (autoPlay) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.warn("Autoplay blocked or failed:", err);
          setIsPlaying(false);
        });
      }
    } else {
      setIsPlaying(false);
    }
    
    setIsUrlModalOpen(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    const tiltParam = params.get('tilt');
    const autoParam = params.get('autoplay');
    
    // Default autoplay to true unless explicitly set to '0' or 'false'
    const shouldAutoPlay = autoParam !== '0' && autoParam !== 'false';
    
    if (urlParam) {
      loadVideoFromUrl(decodeURIComponent(urlParam), shouldAutoPlay);
    }
    if (tiltParam) {
      setDomeTilt(parseInt(tiltParam) || 0);
    }
  }, [loadVideoFromUrl]);

  const resetControlsTimer = useCallback(() => {
    if (isImmersive) return; // Do not show controls in immersive mode on interaction
    
    setShowControls(true);
    if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => {
      if (!isUrlModalOpen && !isSettingsOpen && !errorMsg) {
        setShowControls(false);
      }
    }, 3000);
  }, [isUrlModalOpen, isSettingsOpen, isImmersive, errorMsg]);

  useEffect(() => {
    const events = ['mousemove', 'touchstart', 'mousedown', 'keydown'];
    events.forEach(e => window.addEventListener(e, resetControlsTimer));
    resetControlsTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetControlsTimer));
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    };
  }, [resetControlsTimer]);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setShowMotionButton(isMobile);
  }, []);

  const requestMotionPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission();
        if (state === 'granted') setIsMotionEnabled(true);
      } catch (e) { console.error(e); }
    } else {
      setIsMotionEnabled(!isMotionEnabled);
    }
  };

  const store = useMemo(() => createXRStore({ depthSensing: true, handTracking: true }), []);

  useEffect(() => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; // Critical for WebGL textures
    v.loop = true;
    v.playsInline = true;
    
    const updateProgress = () => { if (v.duration) setProgress((v.currentTime / v.duration) * 100); };
    
    const handleError = (e: Event) => {
      const error = v.error;
      let msg = "Unknown playback error";
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED: msg = "Fetch aborted."; break;
          case error.MEDIA_ERR_NETWORK: msg = "Network error."; break;
          case error.MEDIA_ERR_DECODE: msg = "Decode error."; break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = "Source not supported or file too large (CORS)."; break;
        }
      }
      console.error("Video Error Details:", error);
      setErrorMsg(`Failed to play video: ${msg} If using Drive, file must be <100MB.`);
      setIsPlaying(false);
    };

    v.addEventListener('timeupdate', updateProgress);
    v.addEventListener('error', handleError);
    
    videoRef.current = v;
    
    return () => {
      v.pause();
      v.removeEventListener('timeupdate', updateProgress);
      v.removeEventListener('error', handleError);
      v.src = '';
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (file && videoRef.current) {
      const url = URL.createObjectURL(file);
      setVideo({ url, name: file.name, type: file.type });
      videoRef.current.src = url;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error("File play error", e));
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current || !video) return;
    if (isPlaying) videoRef.current.pause(); else videoRef.current.play();
    setIsPlaying(!isPlaying);
  }, [isPlaying, video]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  return (
    <div className="w-full h-screen relative bg-black select-none overflow-hidden">
      {/* VR Button - Hidden in Immersive Mode */}
      {!isImmersive && (
        <div className="fixed top-6 right-6 z-[100] transition-opacity duration-300">
          <button onClick={() => store.enterVR()} className="bg-blue-600 px-6 py-3 rounded-full text-white font-bold shadow-xl hover:bg-blue-500 transition-all active:scale-95 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4Z"/><path d="M10 16v-2a2 2 0 0 1 4 0v2"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/></svg>
            Enter VR
          </button>
        </div>
      )}

      {/* Error Toast */}
      {errorMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-lg">
           <div className="bg-red-500/90 text-white px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-4 animate-in slide-in-from-top-4 duration-300 border border-white/10">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             <div className="flex-1">
               <h3 className="font-bold text-sm uppercase tracking-wider mb-1">Playback Error</h3>
               <p className="text-sm opacity-90 leading-relaxed">{errorMsg}</p>
             </div>
             <button onClick={() => setErrorMsg(null)} className="opacity-60 hover:opacity-100">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
             </button>
           </div>
        </div>
      )}

      <div className="absolute inset-0 z-0">
        <Canvas flat>
          <XR store={store}>
            <Scene 
              videoElement={videoRef.current} 
              isPlaying={isPlaying} 
              hasVideo={!!video && !errorMsg}
              isMotionEnabled={isMotionEnabled} 
              domeTilt={domeTilt} 
              projectionMode={projectionMode}
              resetTrigger={resetCameraTrigger}
            />
          </XR>
        </Canvas>
      </div>

      {/* UI Components - Hidden in Immersive Mode */}
      {!isImmersive && (
        <>
          <Settings 
            isOpen={isSettingsOpen} 
            onToggle={() => setIsSettingsOpen(!isSettingsOpen)} 
            isMotionEnabled={isMotionEnabled} 
            onRequestMotion={requestMotionPermission} 
            domeTilt={domeTilt} 
            onTiltChange={setDomeTilt} 
            showMotionButton={showMotionButton}
            currentVideoUrl={video?.url || ''}
            projectionMode={projectionMode}
            onProjectionModeChange={setProjectionMode}
          />
          
          {video && <AIAssistant currentVideoName={video.name} />}

          {isUrlModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
              <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-300">
                <h3 className="text-xl font-black text-white mb-2">Remote Source</h3>
                <p className="text-slate-400 text-sm mb-4">Launch a direct video stream.</p>
                
                <div className="space-y-4 mb-6">
                  {/* Instructions Box */}
                  <div className="p-4 bg-slate-800/80 border border-blue-500/20 rounded-xl space-y-3">
                    <div>
                      <h4 className="text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">Google Drive</h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        • Limited to files &lt;100MB.<br/>
                        • Must be set to "Anyone with the link".
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-green-400 font-bold text-xs uppercase tracking-wider mb-1">Large Files ({'>'}100MB)</h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Use <span className="text-white font-bold">Dropbox</span> or <span className="text-white font-bold">OneDrive</span> links. <br/>
                        Or use "Select Local File" (Zero limits, no upload needed).
                      </p>
                    </div>

                    <div>
                      <h4 className="text-purple-400 font-bold text-xs uppercase tracking-wider mb-1">Supported Formats</h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Dropbox (dl=0), OneDrive (Embed), or Direct MP4/WebM.
                      </p>
                    </div>
                  </div>

                  <input 
                    type="text" 
                    value={remoteUrl} 
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    placeholder="Paste Drive, Dropbox, or OneDrive link..." 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-white/20 font-mono text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setIsUrlModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold hover:text-white transition-colors">Cancel</button>
                  <button onClick={() => loadVideoFromUrl(remoteUrl)} className="flex-1 bg-blue-600 py-3 rounded-xl text-white font-bold hover:bg-blue-500 shadow-lg shadow-blue-600/20">Launch Journey</button>
                </div>
              </div>
            </div>
          )}

          {!video && !isUrlModalOpen && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <div className="p-8 bg-slate-900/80 backdrop-blur-md rounded-3xl border border-white/10 text-center max-w-md shadow-2xl pointer-events-auto">
                <img 
                  src="https://github.com/plasticarm/CINopticFulldomePlayer/blob/main/images/Cinoptic_logo1@0.25x.png?raw=true" 
                  alt="CINoptic Logo" 
                  className="mx-auto mb-6 w-full max-w-[200px] object-contain"
                />
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-4 tracking-tighter">CINoptic FULL DOME</h1>
                <p className="text-slate-300 mb-8 text-sm leading-relaxed">Experience immersive <b>Dome Master</b> media. Upload locally or provide a remote stream.</p>
                <div className="flex flex-col gap-3">
                  <label className="bg-white text-slate-900 px-8 py-4 rounded-xl font-bold cursor-pointer hover:bg-blue-50 transition-all shadow-lg active:scale-95 text-center">
                    Select Local File
                    <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                  </label>
                  <button onClick={() => setIsUrlModalOpen(true)} className="text-blue-400 font-bold py-2 hover:text-blue-300 transition-colors">Stream Remote URL</button>
                </div>
              </div>
            </div>
          )}

          {video && (
            <div className={`transition-opacity duration-700 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Controls 
                isPlaying={isPlaying} 
                onTogglePlay={togglePlay} 
                isMuted={isMuted}
                onToggleMute={toggleMute}
                onFileSelect={handleFileChange} 
                onUrlSelect={() => setIsUrlModalOpen(true)} 
                videoName={video.name} 
                progress={progress} 
                onToggleFullscreen={toggleImmersiveMode}
                onResetCamera={() => setResetCameraTrigger(p => p + 1)}
              />
            </div>
          )}

          <div className={`fixed top-6 left-12 pointer-events-none z-50 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-20'}`}>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-white/30 tracking-[0.2em] uppercase">Status Check</span>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${errorMsg ? 'bg-red-500' : (isPlaying ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-amber-500')}`}></div>
                <span className="text-white/80 text-[10px] font-bold tracking-widest uppercase">{errorMsg ? 'Error' : (isPlaying ? 'Active Stream' : 'Systems Standby')}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
