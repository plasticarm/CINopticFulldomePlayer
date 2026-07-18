import { useLocalStorage } from "./hooks/useLocalStorage";

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
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMotionEnabled, setIsMotionEnabled] = useState(false);
  const [showMotionButton, setShowMotionButton] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [domeTilt, setDomeTilt] = useLocalStorage('cv_domeTilt', 0);
  const [showControls, setShowControls] = useState(true);
  const [postProcessingEnabled, setPostProcessingEnabled] = useLocalStorage('cv_postProcessingEnabled', true);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // New State for Fullscreen and Projection Mode
  const [isImmersive, setIsImmersive] = useState(false);
  const [projectionMode, setProjectionMode] = useLocalStorage<'dome' | 'flat'>('cv_projectionMode', 'dome');
  const [smoothFovChange, setSmoothFovChange] = useLocalStorage('cv_smoothFovChange', true);
  const [useQuaternionRotation, setUseQuaternionRotation] = useLocalStorage('cv_useQuaternionRotation', true);
  const [ambientIntensity, setAmbientIntensity] = useLocalStorage('cv_ambientIntensity', 0.1);
  const [ambientFalloff, setAmbientFalloff] = useLocalStorage('cv_ambientFalloff', 50.0);
  const [restrictViewToEdge, setRestrictViewToEdge] = useLocalStorage('cv_restrictViewToEdge', false);
  const [edgePadding, setEdgePadding] = useLocalStorage('cv_edgePadding', 2.0);
  const [allowCameraRoll, setAllowCameraRoll] = useLocalStorage('cv_allowCameraRoll', false);
  
  // Post-processing effects
  const [vignette, setVignette] = useLocalStorage('cv_vignette', -0.10);
  const [bloom, setBloom] = useLocalStorage('cv_bloom', 3.0);
  const [edgeBlur, setEdgeBlur] = useLocalStorage('cv_edgeBlur', 0.10);
  const [edgeChokeOpacity, setEdgeChokeOpacity] = useLocalStorage('cv_edgeChokeOpacity', 1.0);
  const [antialiasing, setAntialiasing] = useLocalStorage('cv_antialiasing', true);
  
  // Status check visibility
  const [showStatusCheck, setShowStatusCheck] = useState(false);
  const statusCheckTimerRef = useRef<number | null>(null);
  
  // Camera Reset Trigger
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<{ id: string, name: string, url: string }[]>(() => {
    try {
      const saved = localStorage.getItem('cinoptic_bookmarks');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const deduped: { id: string, name: string, url: string }[] = [];
      const seenNames = new Set<string>();
      const seenUrls = new Set<string>();
      for (const b of parsed) {
        if (!b || !b.url || b.url.startsWith('blob:')) continue;
        if (seenNames.has(b.name) || seenUrls.has(b.url)) continue;
        seenNames.add(b.name);
        seenUrls.add(b.url);
        deduped.push(b);
      }
      return deduped;
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cinoptic_bookmarks', JSON.stringify(bookmarks.filter(b => !b.url.startsWith('blob:'))));
  }, [bookmarks]);

  const [playlist, setPlaylist] = useState<{ id: string, name: string, url: string }[] | null>(null);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  
  const playlistRef = useRef(playlist);
  const playlistIndexRef = useRef(playlistIndex);
  
  useEffect(() => {
    playlistRef.current = playlist;
    playlistIndexRef.current = playlistIndex;
  }, [playlist, playlistIndex]);

  const addBookmark = useCallback(() => {
    if (video && video.url) {
      setBookmarks(prev => {
        // If it's a blob url, check for existing by name since blob urls change every time.
        // For remote urls, check by url.
        const isBlob = video.url.startsWith('blob:');
        const existingIndex = prev.findIndex(b => isBlob ? b.name === video.name : b.url === video.url);
        
        if (existingIndex !== -1) {
          const existing = prev[existingIndex];
          const updated = { ...existing, url: video.url }; // Update url in case it's a new blob url for same file
          const newArr = [...prev];
          newArr.splice(existingIndex, 1);
          return [updated, ...newArr];
        }
        
        return [{
          id: Date.now().toString(),
          name: video.name || 'Saved Video',
          url: video.url,
        }, ...prev];
      });
    }
  }, [video]);

  useEffect(() => {
    if (isPlaying) {
      addBookmark();
    }
  }, [isPlaying, addBookmark]);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsTimerRef = useRef<number | null>(null);

  // Status Check visibility logic
  useEffect(() => {
    // Only trigger if no file playing, file changed (video), or problem playing (errorMsg)
    if (!isPlaying || video || errorMsg) {
      setShowStatusCheck(true);
      if (statusCheckTimerRef.current) window.clearTimeout(statusCheckTimerRef.current);
      statusCheckTimerRef.current = window.setTimeout(() => {
        setShowStatusCheck(false);
      }, 3000);
    }
  }, [isPlaying, video, errorMsg]);

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

  const playNext = useCallback(() => {
    if (playlistRef.current && playlistRef.current.length > 1) {
      const nextIndex = (playlistIndexRef.current + 1) % playlistRef.current.length;
      setPlaylistIndex(nextIndex);
      loadVideoFromUrl(playlistRef.current[nextIndex].url, true);
    }
  }, [loadVideoFromUrl]);

  const playPrev = useCallback(() => {
    if (playlistRef.current && playlistRef.current.length > 1) {
      const prevIndex = (playlistIndexRef.current - 1 + playlistRef.current.length) % playlistRef.current.length;
      setPlaylistIndex(prevIndex);
      loadVideoFromUrl(playlistRef.current[prevIndex].url, true);
    }
  }, [loadVideoFromUrl]);

  const playAll = useCallback(() => {
    if (bookmarks.length === 0) return;
    setPlaylist(bookmarks);
    setPlaylistIndex(0);
    loadVideoFromUrl(bookmarks[0].url, true);
  }, [bookmarks, loadVideoFromUrl]);

  const playAllRandomized = useCallback(() => {
    if (bookmarks.length === 0) return;
    const shuffled = [...bookmarks].sort(() => Math.random() - 0.5);
    setPlaylist(shuffled);
    setPlaylistIndex(0);
    loadVideoFromUrl(shuffled[0].url, true);
  }, [bookmarks, loadVideoFromUrl]);

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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if typing in input fields
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'p') {
        setPostProcessingEnabled(prev => !prev);
      } else if (key === 's') {
        setIsSettingsOpen(prev => !prev);
      } else if (key === 'f') {
        setProjectionMode('flat');
        setResetCameraTrigger(prev => prev + 1);
      } else if (key === 'd') {
        setProjectionMode('dome');
        setResetCameraTrigger(prev => prev + 1);
      } else if (key === 'i') {
        toggleImmersiveMode();
      } else if (key === 'r') {
        setResetCameraTrigger(prev => prev + 1);
      } else if (key === ',') {
        playPrev();
      } else if (key === '.') {
        playNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDomeTilt(prev => Math.min(90, prev + 2));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDomeTilt(prev => Math.max(-90, prev - 2));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    v.playsInline = true;
    
    const updateProgress = () => { 
      if (v.duration) {
        setProgress((v.currentTime / v.duration) * 100); 
        setCurrentTime(v.currentTime);
        setDuration(v.duration);
      }
    };
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    
    const handleEnded = () => {
      if (playlistRef.current && playlistRef.current.length > 0) {
        const nextIndex = (playlistIndexRef.current + 1) % playlistRef.current.length;
        setPlaylistIndex(nextIndex);
        loadVideoFromUrl(playlistRef.current[nextIndex].url, true);
      } else {
        v.play(); // manually loop
      }
    };
    
    const handleError = (e: Event) => {
      if (!v.src || v.src === '' || v.src.endsWith('/')) return;
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
      console.error("Video Error Details:", error, v.src);
      
      if (playlistRef.current && playlistRef.current.length > 0) {
        const nextIndex = (playlistIndexRef.current + 1) % playlistRef.current.length;
        setPlaylistIndex(nextIndex);
        loadVideoFromUrl(playlistRef.current[nextIndex].url, true);
        return;
      }
      
      setErrorMsg(`Failed to play video: ${msg} If using Drive, file must be <100MB.`);
      setIsPlaying(false);
    };

    v.addEventListener('timeupdate', updateProgress);
    v.addEventListener('loadedmetadata', updateProgress);
    v.addEventListener('play', handlePlay);
    v.addEventListener('pause', handlePause);
    v.addEventListener('waiting', handleWaiting);
    v.addEventListener('playing', handlePlaying);
    v.addEventListener('error', handleError);
    v.addEventListener('ended', handleEnded);
    
    videoRef.current = v;
    
    return () => {
      v.pause();
      v.removeEventListener('timeupdate', updateProgress);
      v.removeEventListener('loadedmetadata', updateProgress);
      v.removeEventListener('play', handlePlay);
      v.removeEventListener('pause', handlePause);
      v.removeEventListener('waiting', handleWaiting);
      v.removeEventListener('playing', handlePlaying);
      v.removeEventListener('error', handleError);
      v.removeEventListener('ended', handleEnded);
      v.removeAttribute('src');
      v.load();
    };
  }, []);

  const goHome = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    setVideo(null);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setPlaylist(null);
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
    if (videoRef.current.paused) {
      videoRef.current.play().catch(e => console.error("Play error", e));
    } else {
      videoRef.current.pause();
    }
  }, [video]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleSeek = useCallback((percentage: number) => {
    if (videoRef.current && videoRef.current.duration) {
      const newTime = (percentage / 100) * videoRef.current.duration;
      // Clamp time to ensure we don't exceed duration or go below 0
      const safeTime = Math.max(0, Math.min(newTime, videoRef.current.duration));
      videoRef.current.currentTime = safeTime;
      setProgress(percentage);
    }
  }, []);

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
              smoothFovChange={smoothFovChange}
              useQuaternionRotation={useQuaternionRotation}
              ambientIntensity={ambientIntensity}
              ambientFalloff={ambientFalloff}
              restrictViewToEdge={restrictViewToEdge}
              edgePadding={edgePadding}
              allowCameraRoll={allowCameraRoll}
              vignette={vignette}
              bloom={bloom}
              edgeBlur={edgeBlur}
              edgeChokeOpacity={edgeChokeOpacity}
              antialiasing={antialiasing}
              postProcessingEnabled={postProcessingEnabled}
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
            smoothFovChange={smoothFovChange}
            onSmoothFovChangeToggle={setSmoothFovChange}
            useQuaternionRotation={useQuaternionRotation}
            onUseQuaternionRotationChange={setUseQuaternionRotation}
            ambientIntensity={ambientIntensity}
            onAmbientIntensityChange={setAmbientIntensity}
            ambientFalloff={ambientFalloff}
            onAmbientFalloffChange={setAmbientFalloff}
            restrictViewToEdge={restrictViewToEdge}
            onRestrictViewToEdgeChange={setRestrictViewToEdge}
            edgePadding={edgePadding}
            onEdgePaddingChange={setEdgePadding}
            allowCameraRoll={allowCameraRoll}
            onAllowCameraRollChange={setAllowCameraRoll}
            vignette={vignette}
            onVignetteChange={setVignette}
            bloom={bloom}
            onBloomChange={setBloom}
            edgeBlur={edgeBlur}
            onEdgeBlurChange={setEdgeBlur}
            edgeChokeOpacity={edgeChokeOpacity}
            onEdgeChokeOpacityChange={setEdgeChokeOpacity}
            antialiasing={antialiasing}
            onAntialiasingChange={setAntialiasing}
            bookmarks={bookmarks}
            onAddBookmark={addBookmark}
            onRemoveBookmark={removeBookmark}
            onSelectBookmark={(url) => loadVideoFromUrl(url)}
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
                  <button onClick={() => { setPlaylist(null); loadVideoFromUrl(remoteUrl); }} className="flex-1 bg-blue-600 py-3 rounded-xl text-white font-bold hover:bg-blue-500 shadow-lg shadow-blue-600/20">Launch Journey</button>
                </div>
              </div>
            </div>
          )}

          {!video && !isUrlModalOpen && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 p-4">
              <div className={`p-8 bg-slate-900/80 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl pointer-events-auto w-full ${bookmarks.length > 0 ? 'max-w-4xl flex gap-8 max-h-[90vh] overflow-hidden' : 'max-w-md text-center'}`}>
                <div className={`flex flex-col ${bookmarks.length > 0 ? 'w-1/3 border-r border-white/10 pr-8 justify-center' : 'w-full items-center'}`}>
                  <img 
                    src="https://github.com/plasticarm/CINopticFulldomePlayer/blob/main/images/Cinoptic_logo1@0.25x.png?raw=true" 
                    alt="CINoptic Logo" 
                    className={`mx-auto mb-6 w-full object-contain ${bookmarks.length > 0 ? 'max-w-[150px]' : 'max-w-[200px]'}`}
                  />
                  <h1 className={`font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-4 tracking-tighter ${bookmarks.length > 0 ? 'text-2xl text-center' : 'text-4xl text-center'}`}>CINoptic FULL DOME</h1>
                  <p className={`text-slate-300 text-sm leading-relaxed ${bookmarks.length > 0 ? 'mb-6 text-center' : 'mb-8 text-center'}`}>Experience immersive <b>Dome Master</b> media. Upload locally or provide a remote stream.</p>
                  <div className="flex flex-col gap-3 w-full">
                    <label className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold cursor-pointer hover:bg-blue-50 transition-all shadow-lg active:scale-95 text-center text-sm">
                      Select Local File
                      <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    <button onClick={() => setIsUrlModalOpen(true)} className="text-blue-400 font-bold py-2 hover:text-blue-300 transition-colors text-sm">Stream Remote URL</button>
                  </div>
                </div>

                {bookmarks.length > 0 && (
                  <div className="w-2/3 flex flex-col h-full max-h-[80vh]">
                    <div className="flex justify-between items-end mb-6 shrink-0 mt-2">
                      <h2 className="text-2xl font-black text-white tracking-tight">Recent Bookmarks</h2>
                      <div className="flex gap-2">
                        <button onClick={playAll} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-blue-500/30 flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                          Play All
                        </button>
                        <button onClick={playAllRandomized} className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-purple-500/30 flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
                          Shuffle
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                      {bookmarks.map((bookmark) => (
                        <div key={bookmark.id} className="group relative bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-white/20 p-4 rounded-2xl transition-all cursor-pointer flex flex-col gap-2" onClick={() => { setPlaylist(null); loadVideoFromUrl(bookmark.url, true); }}>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-white text-sm line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">{bookmark.name}</h3>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeBookmark(bookmark.id); }}
                              className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-2 -mt-2"
                              title="Remove bookmark"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-auto pt-2 border-t border-white/5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            <span className="truncate">
                              {(() => {
                                try {
                                  return new URL(bookmark.url).hostname;
                                } catch {
                                  return 'Saved Stream';
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {video && (
            <div className={`transition-opacity duration-700 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Controls 
                isPlaying={isPlaying} 
                isBuffering={isBuffering}
                onTogglePlay={togglePlay} 
                hasNext={playlist !== null && playlist.length > 1}
                hasPrev={playlist !== null && playlist.length > 1}
                onNext={playNext}
                onPrev={playPrev}
                isMuted={isMuted}
                onToggleMute={toggleMute}
                onFileSelect={handleFileChange} 
                onUrlSelect={() => setIsUrlModalOpen(true)} 
                onGoHome={goHome}
                videoName={video.name} 
                progress={progress} 
                currentTime={currentTime}
                duration={duration}
                onToggleFullscreen={toggleImmersiveMode}
                onResetCamera={() => setResetCameraTrigger(p => p + 1)}
                onSeek={handleSeek}
              />
            </div>
          )}

          <div className={`fixed top-6 left-12 pointer-events-none z-50 transition-opacity duration-1000 ${showStatusCheck ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-white/30 tracking-[0.2em] uppercase">Status Check</span>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${errorMsg ? 'bg-red-500' : (isBuffering ? 'bg-amber-500 animate-pulse' : (isPlaying ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-amber-500'))}`}></div>
                <span className="text-white/80 text-[10px] font-bold tracking-widest uppercase">{errorMsg ? 'Error' : (isBuffering ? 'Buffering...' : (isPlaying ? 'Active Stream' : 'Systems Standby'))}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
