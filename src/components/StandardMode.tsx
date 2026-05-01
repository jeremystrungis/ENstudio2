import React, { useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Play, Pause, Square, Volume2, Plus, X, Upload, Save, Settings, Video, FileAudio, Download } from 'lucide-react';
import { generateAudio, generateCaptions } from '../services/aiService';

export function StandardMode() {
  const store = useWorkspaceStore();

  const handleGenerateTTS = async () => {
    if (!store.text.trim()) return;
    store.setIsGeneratingAudio(true);
    store.setWavUrl(null);
    store.setAudioBlob(null);

    let processedText = store.text;
    
    if (store.areRulesEnabled) {
      store.pronunciations.forEach(r => {
        const regex = new RegExp(`\\b${r.targetPhrase}\\b`, 'gi');
        processedText = processedText.replace(regex, r.phoneticReplacement);
      });
    }

    try {
      const { blob } = await generateAudio(
        processedText,
        { voice: store.selectedVoice, tone: store.tone, speed: store.speed, text: processedText },
        store.apiKey,
        store.ttsModel
      );
      
      const url = URL.createObjectURL(blob);
      store.setWavUrl(url);
      store.setAudioBlob(blob);
    } catch (e: any) {
      alert(`TTS Flow Error: ${e.message}`);
    } finally {
      store.setIsGeneratingAudio(false);
    }
  };

  const handleGenerateCaptions = async () => {
    if (!store.audioBlob) return;
    store.setIsCaptioning(true);
    
    try {
      store.logApiRequest();
      const vtt = await generateCaptions(store.audioBlob, store.apiKey, store.captionModel);
      store.setVttContent(vtt);
    } catch (e: any) {
      alert(`Captioning Error: ${e.message}`);
    } finally {
      store.setIsCaptioning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center relative flex-1">
        <div className="absolute top-6 right-6 flex gap-2">
          {store.wavUrl && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">WAV</span>}
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{store.wavUrl ? 'READY' : 'STANDBY'}</span>
        </div>

        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2 self-start border-b border-slate-800 pb-2 w-full">
           <FileAudio className="text-emerald-500 w-4 h-4"/> Standard Audio Output
        </h2>
        
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <div className="flex items-center gap-8 mb-8">
            <button 
              onClick={() => store.setIsPlaying(!store.isPlaying)}
              disabled={!store.wavUrl}
              className="w-16 h-16 rounded-full bg-slate-100 hover:bg-white text-slate-950 flex items-center justify-center transition-transform active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {store.isPlaying ? <Pause className="fill-current w-8 h-8" /> : <Play className="fill-current ml-1 w-8 h-8" />}
            </button>
            
            <div className="flex gap-4">
              <button 
                onClick={() => store.setIsPlaying(false)}
                disabled={!store.wavUrl || !store.isPlaying}
                className="text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/50"
                title="Stop Playing"
              >
                <Square className="fill-current w-4 h-4" />
              </button>

              <button 
                onClick={() => {
                  if (store.wavUrl) {
                    const a = document.createElement('a');
                    a.href = store.wavUrl;
                    a.download = `audio_${Date.now()}.mp3`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
                disabled={!store.wavUrl}
                className="text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/50"
                title="Download Audio (.mp3)"
              >
                <FileAudio className="w-4 h-4" />
              </button>

              <button 
                onClick={async () => {
                  if (store.vttContent) {
                    const blob = new Blob([store.vttContent], { type: 'text/vtt' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `captions_${Date.now()}.vtt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                }}
                disabled={!store.vttContent}
                className="text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/50"
                title="Download VTT (.vtt)"
              >
                <Video className="w-4 h-4" />
              </button>

              <button 
                onClick={async () => {
                   const JSZip = (await import('jszip')).default;
                   const zip = new JSZip();
                   if (store.audioBlob) zip.file('audio.mp3', store.audioBlob);
                   if (store.vttContent) zip.file('captions.vtt', store.vttContent);
                   
                   const content = await zip.generateAsync({ type: 'blob' });
                   const url = URL.createObjectURL(content);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = `enunciate_project_${Date.now()}.zip`;
                   document.body.appendChild(a);
                   a.click();
                   document.body.removeChild(a);
                   URL.revokeObjectURL(url);
                }}
                disabled={!store.wavUrl && !store.vttContent}
                className="text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/50"
                title="Download All (.zip)"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-full max-w-md flex items-center gap-3 pt-2 opacity-80">
            <Volume2 className="w-4 h-4 text-slate-500" />
            <div className="flex-1 h-1 bg-slate-800 rounded-full relative group cursor-pointer flex items-center">
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={store.volume}
                onChange={(e) => store.setVolume(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              />
              <div 
                className="absolute left-0 top-0 h-full bg-slate-400 rounded-full"
                style={{ width: `${store.volume * 100}%` }}
              ></div>
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-slate-950 transition-transform group-hover:scale-110"
                style={{ left: `calc(${store.volume * 100}% - 6px)` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {store.wavUrl && (
        <div className="glass rounded-2xl p-4 flex flex-col overflow-hidden h-56 shrink-0 relative">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generated Captions (VTT)</label>
              {store.vttContent && <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-mono">CAPTIONS READY</span>}
            </div>
            
            <button 
              onClick={handleGenerateCaptions}
              disabled={store.isCaptioning}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-widest disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {store.isCaptioning ? (
                <span className="w-3 h-3 border border-t-emerald-400 border-slate-500 rounded-full animate-spin inline-block"></span>
              ) : null}
              {store.vttContent ? 'Regenerate VTT' : 'Generate VTT'}
            </button>
          </div>
          
          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-3 overflow-hidden flex flex-col shadow-inner">
            {store.vttContent ? (
              <textarea 
                readOnly 
                value={store.vttContent} 
                className="flex-1 bg-transparent border-none text-[11px] mono text-slate-400 focus:outline-none resize-none custom-scrollbar"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-600 text-xs mono">
                No captions generated yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
