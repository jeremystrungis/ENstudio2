import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Download, Play, Square, List, Timer } from 'lucide-react';
import JSZip from 'jszip';
import { generateAudio, generateCaptions } from '../services/aiService';

export function BatchMode() {
  const store = useWorkspaceStore();
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const checkAndApplyCooldown = async (maxRpm: number = 5) => {
    let storeState = useWorkspaceStore.getState();
    let now = Date.now();
    let oneMinAgo = now - 60000;
    let recentRequests = (storeState.apiRequests || []).filter(time => time > oneMinAgo);

    if (recentRequests.length >= maxRpm) {
        recentRequests.sort((a, b) => a - b);
        const oldestRelevant = recentRequests[recentRequests.length - maxRpm];
        const waitTime = oldestRelevant + 60000 - now;

        if (waitTime > 0) {
            const endWait = Date.now() + waitTime;
            while (Date.now() < endWait) {
                if (useWorkspaceStore.getState().batchStopRequested) break;
                useWorkspaceStore.getState().setCooldownRemaining(Math.ceil((endWait - Date.now()) / 1000));
                await new Promise(r => setTimeout(r, 500));
            }
            useWorkspaceStore.getState().setCooldownRemaining(0);
        }
    }
  };

  const handleStartAudio = async () => {
    store.setBatchProcessingState({ isBatchProcessingAudio: true, batchStopRequested: false });
    
    const items = useWorkspaceStore.getState().batchItems;
    for (let i = 0; i < items.length; i++) {
        const currentStore = useWorkspaceStore.getState();
        if (currentStore.batchStopRequested) break;
        
        const item = items[i];
        if (item.audioStatus === 'done') continue;

        await checkAndApplyCooldown(5);
        if (useWorkspaceStore.getState().batchStopRequested) break;

        store.updateBatchItem(item.id, { audioStatus: 'loading' });
        useWorkspaceStore.getState().logApiRequest();

        try {
            const generatePromise = generateAudio(
              item.text,
              { voice: currentStore.selectedVoice, tone: currentStore.tone, speed: currentStore.speed, text: item.text },
              currentStore.apiKey,
              currentStore.ttsModel
            );
            
            // Timeout after 60 seconds
            let timeoutId: any;
            const timeoutPromise = new Promise<{ blob: Blob }>((_, reject) => {
               timeoutId = setTimeout(() => reject(new Error("Audio generation timed out after 60 seconds.")), 60000);
            });
            
            const { blob } = await Promise.race([generatePromise, timeoutPromise]);
            clearTimeout(timeoutId);
            
            store.updateBatchItem(item.id, { audioStatus: 'done', wavBlob: blob });
        } catch (e: any) {
            store.updateBatchItem(item.id, { audioStatus: 'error', errorMsg: e.message });
        }

        if (useWorkspaceStore.getState().batchStopRequested) break;
    }
    
    store.setBatchProcessingState({ isBatchProcessingAudio: false, batchStopRequested: false });
  };

  const handleStartVtt = async () => {
    store.setBatchProcessingState({ isBatchProcessingVtt: true, batchStopRequested: false });
    
    const items = useWorkspaceStore.getState().batchItems;
    for (let i = 0; i < items.length; i++) {
        const currentStore = useWorkspaceStore.getState();
        if (currentStore.batchStopRequested) break;
        
        const item = items[i];
        if (!item.wavBlob) continue;
        if (item.vttStatus === 'done') continue;

        await checkAndApplyCooldown(5);
        if (useWorkspaceStore.getState().batchStopRequested) break;

        store.updateBatchItem(item.id, { vttStatus: 'loading' });
        useWorkspaceStore.getState().logApiRequest();

        try {
            const generatePromise = generateCaptions(item.wavBlob, currentStore.apiKey, currentStore.captionModel);
            let timeoutId: any;
            const timeoutPromise = new Promise<string>((_, reject) => {
               timeoutId = setTimeout(() => reject(new Error("Caption generation timed out after 60 seconds.")), 60000);
            });
            const vtt = await Promise.race([generatePromise, timeoutPromise]);
            clearTimeout(timeoutId);
            store.updateBatchItem(item.id, { vttStatus: 'done', vttContent: vtt });
        } catch (e: any) {
            store.updateBatchItem(item.id, { vttStatus: 'error', errorMsg: e.message });
        }

        if (useWorkspaceStore.getState().batchStopRequested) break;
    }
    
    store.setBatchProcessingState({ isBatchProcessingVtt: false, batchStopRequested: false });
  };

  const handleStop = () => {
    store.setBatchProcessingState({ batchStopRequested: true });
  };

  const exportAudioZip = async () => {
    const zip = new JSZip();
    const items = store.batchItems;

    items.forEach((item, idx) => {
        const num = String(idx + 1).padStart(4, '0');
        if (item.wavBlob) {
           zip.file(`${num}-block.mp3`, item.wavBlob);
        }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enunciate_batch_audio_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportVttZip = async () => {
    const zip = new JSZip();
    const items = store.batchItems;

    items.forEach((item, idx) => {
        const num = String(idx + 1).padStart(3, '0');
        const folder = zip.folder(`item_${num}`);
        if(folder && item.vttContent) {
           folder.file(`subtitles.vtt`, item.vttContent);
           folder.file(`script.txt`, item.text);
        }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enunciate_batch_vtt_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalAudioProcessed = store.batchItems.filter(i => i.audioStatus === 'done' || i.audioStatus === 'error').length;
  const totalVttProcessed = store.batchItems.filter(i => i.vttStatus === 'done' || i.vttStatus === 'error').length;
  const isAnyProcessing = store.isBatchProcessingAudio || store.isBatchProcessingVtt;

  const rpmLimit = 5;
  const recentRequestsCount = (store.apiRequests || []).filter(time => time > currentTime - 60000).length;

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      <div className="glass rounded-2xl p-6 flex flex-col relative flex-1">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 self-start border-b border-slate-800 pb-2 w-full">
           <List className="text-emerald-500 w-4 h-4"/> Batch Studio
        </h2>

        {store.batchItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
             Upload a .txt file in the left panel to begin.
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full gap-8">
             
             {/* Progress Info */}
             <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col gap-6 shadow-inner">
               <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Items</div>
                    <div className="text-3xl font-bold text-slate-100 mono">{store.batchItems.length}</div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     <div className="flex flex-col items-end gap-1">
                       <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">API USAGE (60S)</span>
                       <div className="flex items-center gap-2">
                         <span className={`text-xs font-bold mono ${recentRequestsCount >= rpmLimit ? 'text-red-400' : 'text-emerald-400'}`}>
                           {recentRequestsCount} / {rpmLimit} RPM
                         </span>
                         {store.cooldownRemaining > 0 && (
                           <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                             <Timer className="w-3 h-3" />
                             Wait {store.cooldownRemaining}s
                           </span>
                         )}
                       </div>
                     </div>
                     {isAnyProcessing && store.cooldownRemaining === 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 h-fit">
                          <span className="w-3 h-3 border border-t-blue-400 border-transparent rounded-full animate-spin"></span>
                          Processing
                        </div>
                     )}
                     {isAnyProcessing && store.cooldownRemaining > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 h-fit">
                          <Timer className="w-3 h-3" />
                          Cooldown Active
                        </div>
                     )}
                  </div>
               </div>

               <div className="space-y-4">
                 <div className="space-y-1">
                   <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                     <span>Audio Processed</span>
                     <span className="text-emerald-400">{totalAudioProcessed} / {store.batchItems.length}</span>
                   </div>
                   <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${(totalAudioProcessed / store.batchItems.length) * 100}%` }}></div>
                   </div>
                 </div>

                 <div className="space-y-1">
                   <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                     <span>VTT Processed</span>
                     <span className="text-emerald-400">{totalVttProcessed} / {store.batchItems.length}</span>
                   </div>
                   <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${(totalVttProcessed / store.batchItems.length) * 100}%` }}></div>
                   </div>
                 </div>
               </div>
             </div>

             {/* Action Buttons */}
             <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleStartAudio}
                  disabled={isAnyProcessing || totalAudioProcessed === store.batchItems.length}
                  className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-emerald-500/50" />
                  Run Audio Batch
                </button>
                <button 
                  onClick={handleStartVtt}
                  disabled={isAnyProcessing || totalVttProcessed === store.batchItems.length}
                  className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-emerald-500/50" />
                  Run VTT Batch
                </button>
             </div>

             <div className="flex gap-4">
                <button 
                  onClick={handleStop}
                  disabled={!isAnyProcessing}
                  className="flex-1 bg-slate-800 border border-slate-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4 fill-current" /> Stop
                </button>
                
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <button 
                    onClick={exportAudioZip}
                    disabled={isAnyProcessing || !store.batchItems.some(i => i.audioStatus === 'done' && i.wavBlob)}
                    className="bg-slate-200 text-slate-950 hover:bg-white py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Download className="w-3 h-3" /> Audio ZIP
                  </button>
                  <button 
                    onClick={exportVttZip}
                    disabled={isAnyProcessing || !store.batchItems.some(i => i.vttStatus === 'done' && i.vttContent)}
                    className="bg-slate-200 text-slate-950 hover:bg-white py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Download className="w-3 h-3" /> VTT ZIP
                  </button>
                </div>
             </div>

          </div>
        )}
      </div>
    </div>
  );
}
