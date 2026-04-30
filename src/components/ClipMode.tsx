import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Upload, Video as VideoIcon } from 'lucide-react';

import JSZip from 'jszip';

export function ClipMode() {
  const store = useWorkspaceStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeScrub, setActiveScrub] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (store.clipUploadedFile) {

      const url = URL.createObjectURL(store.clipUploadedFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setVideoUrl(null);
    }
  }, [store.clipUploadedFile]);

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      store.setClipDuration(videoRef.current.duration);
      store.setClipEndTime(Math.min(10, videoRef.current.duration)); // Default 10s or max
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      store.setClipCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.currentTime > store.clipEndTime) {
        videoRef.current.pause();
        videoRef.current.currentTime = store.clipStartTime;
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      store.setClipUploadedFile(file);
    }
  };

  const calculatePosition = (time: number) => {
    if (store.clipDuration === 0) return 0;
    return (time / store.clipDuration) * 100;
  };

  const handleExportClip = async () => {
    if (!store.clipUploadedFile) return;

    alert("Notice: Full video encoding is restricted in the preview environment. The exported ZIP will contain your original video and a metadata file indicating your trim times (Start: " + store.clipStartTime.toFixed(2) + "s, End: " + store.clipEndTime.toFixed(2) + "s) so you can use it in your editor.");

    const zip = new JSZip();

    zip.file(`original_video.${store.clipUploadedFile.name.split('.').pop() || 'mp4'}`, store.clipUploadedFile);
    
    // We get the wav blob and vtt from standard mode's store state essentially
    const wavReq = await fetch(store.wavUrl || '');
    if (wavReq.ok) {
       zip.file('synced_audio.mp3', await wavReq.blob());
    }

    if (store.vttContent) {
       zip.file('captions.vtt', store.vttContent);
    }

    zip.file('clip_metadata.txt', `Trim Start: ${store.clipStartTime.toFixed(2)}s\nTrim End: ${store.clipEndTime.toFixed(2)}s\nDuration: ${(store.clipEndTime - store.clipStartTime).toFixed(2)}s\n\nNOTE: Full browser-based video encoding is restricted in this preview. So the original video is included instead of the trimmed one. Please use these raw files with your editor of choice.`);

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enunciate_clip_project_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      <div className="glass rounded-2xl p-6 flex-1 flex flex-col relative">
        <div className="absolute top-6 right-6 flex gap-2">
          {videoUrl && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">VIDEO READY</span>}
        </div>

        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 self-start border-b border-slate-800 pb-2 w-full">
           <VideoIcon className="text-emerald-500 w-4 h-4"/> Clip Studio Mode
        </h2>

        {!videoUrl ? (
          <div className="flex-1 border border-dashed border-slate-700/50 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-4 bg-slate-900/30 transition-colors hover:bg-slate-900/50">
             <Upload className="w-10 h-10 text-slate-500" />
             <p className="text-sm">Upload a video clip to sync captions and audio</p>
             <label className="px-6 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg cursor-pointer hover:bg-emerald-500/20 transition-colors text-xs font-bold uppercase tracking-widest">
                Choose Video
                <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleFileChange} />
             </label>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1">
              <div className="relative flex-1 bg-slate-950 rounded-xl overflow-hidden group border border-slate-800 shadow-inner">
               <video 
                 ref={videoRef}
                 src={videoUrl}
                 className="absolute inset-0 w-full h-full object-contain"
                 onLoadedMetadata={handleVideoLoaded}
                 onTimeUpdate={handleTimeUpdate}
                 onPlay={() => setIsPlaying(true)}
                 onPause={() => setIsPlaying(false)}
                 onEnded={() => setIsPlaying(false)}
                 controls={false}
               >
                 {store.vttContent && (
                   <track 
                     kind="captions" 
                     src={URL.createObjectURL(new Blob([store.vttContent], { type: 'text/vtt' }))} 
                     srcLang="en" 
                     label="English" 
                     default 
                   />
                 )}
               </video>

               {activeScrub && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-950/80 backdrop-blur-sm border border-slate-700 px-3 py-1.5 rounded-lg text-emerald-400 font-mono text-xl shadow-xl z-20 transition-opacity">
                   {activeScrub === 'start' ? store.clipStartTime.toFixed(2) : store.clipEndTime.toFixed(2)}s
                 </div>
               )}

               <button 
                onClick={() => {
                  if (videoRef.current) {
                    if (videoRef.current.paused) {
                      if (videoRef.current.currentTime >= store.clipEndTime) {
                        videoRef.current.currentTime = store.clipStartTime;
                      }
                      videoRef.current.play();
                    } else {
                      videoRef.current.pause();
                    }
                  }
                }}
                className={`absolute inset-0 flex items-center justify-center bg-slate-950/40 transition-opacity ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
               >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/90 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 backdrop-blur-md">
                    <span className="font-bold tracking-widest pl-1 text-[11px] uppercase">
                      {isPlaying ? 'Pause' : 'Play'}
                    </span>
                  </div>
               </button>
             </div>

             <div className="h-16 relative bg-slate-900/50 rounded-xl border border-slate-700/50 mt-2 px-3 py-4 select-none">
                <div className="absolute inset-x-3 top-1/2 -mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 bottom-0 bg-emerald-500/30"
                    style={{ 
                      left: `${calculatePosition(store.clipStartTime)}%`, 
                      width: `${calculatePosition(store.clipEndTime) - calculatePosition(store.clipStartTime)}%` 
                    }}
                  />
                  <div 
                    className="absolute top-0 bottom-0 bg-emerald-400 w-[2px] shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    style={{ left: `${calculatePosition(store.clipCurrentTime)}%` }}
                  />
                </div>
                
                {/* Trimming Handles */}
                <input 
                  type="range" 
                  min="0" 
                  max={store.clipDuration || 100} 
                  step="0.01"
                  value={store.clipStartTime}
                  onChange={(e) => {
                    const newTime = Math.min(parseFloat(e.target.value), store.clipEndTime - 0.5);
                    store.setClipStartTime(newTime);
                    if (videoRef.current) videoRef.current.currentTime = newTime;
                  }}
                  className="absolute inset-x-3 top-0 bottom-0 w-[calc(100%-24px)] appearance-none bg-transparent m-0 focus:outline-none pointer-events-auto opacity-0"
                  style={{ zIndex: activeScrub === 'start' ? 10 : 5 }}
                  onPointerDown={() => setActiveScrub('start')}
                  onPointerUp={() => setActiveScrub(null)}
                  onMouseEnter={() => !activeScrub && setActiveScrub('start')}
                  onMouseLeave={() => !activeScrub && setActiveScrub(null)}
                />
                <input 
                  type="range" 
                  min="0" 
                  max={store.clipDuration || 100} 
                  step="0.01"
                  value={store.clipEndTime}
                  onChange={(e) => {
                    const newTime = Math.max(parseFloat(e.target.value), store.clipStartTime + 0.5);
                    store.setClipEndTime(newTime);
                    if (videoRef.current) videoRef.current.currentTime = newTime;
                  }}
                  className="absolute inset-x-3 top-0 bottom-0 w-[calc(100%-24px)] appearance-none bg-transparent m-0 focus:outline-none pointer-events-auto opacity-0"
                  style={{ zIndex: activeScrub === 'end' ? 10 : 4 }}
                  onPointerDown={() => setActiveScrub('end')}
                  onPointerUp={() => setActiveScrub(null)}
                  onMouseEnter={() => !activeScrub && setActiveScrub('end')}
                  onMouseLeave={() => !activeScrub && setActiveScrub(null)}
                />

                <div 
                  className="absolute top-1/2 -mt-3 w-3 h-6 bg-slate-200 border border-slate-400 rounded cursor-ew-resize flex items-center justify-center z-20 pointer-events-none shadow"
                  style={{ left: `calc(${calculatePosition(store.clipStartTime)}% + 12px)`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-[1px] h-3 bg-slate-600"></div>
                </div>
                <div 
                  className="absolute top-1/2 -mt-3 w-3 h-6 bg-slate-200 border border-slate-400 rounded cursor-ew-resize flex items-center justify-center z-20 pointer-events-none shadow"
                  style={{ left: `calc(${calculatePosition(store.clipEndTime)}% + 12px)`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-[1px] h-3 bg-slate-600"></div>
                </div>

                <div className="absolute top-0 right-3 text-[10px] text-slate-500 mono mt-1">
                   {(store.clipCurrentTime).toFixed(2)} / {(store.clipDuration).toFixed(2)}s
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4 mt-2">
                 <button 
                   onClick={handleExportClip}
                   className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-colors flex items-center justify-center gap-2"
                 >
                   Export Clip Resources
                 </button>
                 <button 
                   onClick={() => store.setClipUploadedFile(null)}
                   className="bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-colors flex items-center justify-center gap-2"
                 >
                   Remove Video
                 </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
