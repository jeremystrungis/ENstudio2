import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { StandardMode } from './StandardMode';
import { ClipMode } from './ClipMode';
import { BatchMode } from './BatchMode';
import { AudioVisualizer } from './AudioVisualizer';
import { 
  Settings, FolderOpen, PlaySquare, Video as VideoIcon, 
  Mic2, Type, Zap, Plus, X, Save, Trash2, AlertCircle, List, Upload, Text,
  Download, FileAudio
} from 'lucide-react';

export function Workspace() {
  const store = useWorkspaceStore();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [newRuleTarget, setNewRuleTarget] = useState('');
  const [newRuleReplacement, setNewRuleReplacement] = useState('');
  const [projectNameInput, setProjectNameInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 5000);
  };

  useEffect(() => {
    store.loadProjects();
  }, []);

  const handleAddRule = () => {
    if (newRuleTarget.trim() && newRuleReplacement.trim()) {
      store.addRule({
        id: Date.now().toString(),
        targetPhrase: newRuleTarget,
        phoneticReplacement: newRuleReplacement
      });
      setNewRuleTarget('');
      setNewRuleReplacement('');
    }
  };

  const handleSaveProject = () => {
    if (projectNameInput.trim() || store.currentProjectId) {
      store.saveProject(projectNameInput || 'Untitled Project');
      setIsFileManagerOpen(false);
      showToast('Project saved successfully.');
    } else {
      showToast("Please enter a name to save as a new project.");
    }
  };

  const handleGenerate = async () => {
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
      store.logApiRequest();
      const { generateAudio } = await import('../services/aiService');
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
      showToast(`API Error: ${e.message}`);
    } finally {
      store.setIsGeneratingAudio(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 bg-emerald-500 rounded-full blur-sm opacity-50"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-slate-100">ENunciate</span><span className="text-emerald-500 ml-1">Studio 2.0</span>
          </h1>
        </div>

        <div className="w-px h-6 bg-slate-800 mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex gap-1 bg-slate-950 rounded-lg">
            <button 
              onClick={() => store.setAppMode('standard')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${store.appMode === 'standard' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}
            >
              STANDARD MODE
            </button>
            <button 
              onClick={() => store.setAppMode('clip')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${store.appMode === 'clip' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}
            >
              CLIP STUDIO
            </button>
            <button 
              onClick={() => store.setAppMode('batch')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${store.appMode === 'batch' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}
            >
              BATCH MODE
            </button>
          </div>

          <div className="w-px h-6 bg-slate-800 mx-2"></div>

          <button 
            onClick={() => setIsFileManagerOpen(true)}
            className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-2 px-3 py-1.5 border border-slate-800 rounded-lg hover:bg-slate-900 transition-colors"
          >
            <FolderOpen className="w-4 h-4" /> Projects
          </button>
          <button 
            onClick={() => setIsConfigOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold px-4 py-1.5 rounded-lg transition-colors accent-glow flex items-center gap-2"
          >
            <Settings className="w-4 h-4" /> API Config
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Panel (Input Zone) */}
        <section className="w-[400px] flex flex-col gap-4 overflow-hidden shrink-0">
          
          {/* Left panel conditional based on appMode */}
          {store.appMode === 'batch' ? (
            <div className="glass rounded-2xl p-4 flex flex-col flex-1 overflow-hidden">
               <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <List className="w-4 h-4 text-emerald-500" />
                   Batch List
                 </label>
                 {store.batchItems.length > 0 && <span className="text-[10px] text-slate-500 mono">{store.batchItems.length} ITEMS</span>}
               </div>

               {store.batchItems.length === 0 ? (
                 <div className="flex-1 border border-dashed border-slate-700/50 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-4 bg-slate-900/30 transition-colors hover:bg-slate-900/50">
                   <Upload className="w-8 h-8 text-slate-500" />
                   <p className="text-[11px] text-slate-500 text-center px-4">Upload a .txt file. Paragraphs separated by blank lines will turn into batch items.</p>
                   <label className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg cursor-pointer hover:bg-emerald-500/20 text-[10px] font-bold uppercase tracking-widest transition-colors">
                     Upload .txt
                     <input type="file" accept=".txt" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            const text = e.target?.result as string;
                            const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
                            const items = paragraphs.map((p, i) => ({
                              id: `batch-${Date.now()}-${i}`,
                              text: p,
                              wavBlob: null,
                              vttContent: null,
                              audioStatus: 'idle' as const,
                              vttStatus: 'idle' as const,
                            }));
                            store.setBatchItems(items);
                          };
                          reader.readAsText(file);
                        }
                     }} />
                   </label>
                 </div>
               ) : (
                 <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
                   {store.batchItems.map((item, idx) => (
                      <div key={item.id} className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl flex flex-col gap-2">
                         <div className="flex justify-between items-center bg-slate-950/50 -mx-3 -mt-3 p-2 rounded-t-xl border-b border-slate-800">
                           <div className="text-[10px] text-emerald-500 mono bg-emerald-500/10 px-2 py-0.5 rounded">ITEM {String(idx + 1).padStart(2, '0')}</div>
                           <button 
                             onClick={() => store.setBatchItems(prev => prev.filter(p => p.id !== item.id))}
                             className="text-slate-500 hover:text-red-400 transition-colors"
                           >
                             <Trash2 className="w-3 h-3" />
                           </button>
                         </div>
                         <div className="text-xs text-slate-300 line-clamp-3 my-1 leading-relaxed">{item.text}</div>
                         <div className="flex flex-col gap-1 text-[9px] font-bold tracking-widest mono border-t border-slate-800/50 pt-2 mt-1">
                           <div className="flex gap-2">
                             <span className={
                               item.audioStatus === 'done' ? 'text-emerald-400' : 
                               item.audioStatus === 'loading' ? 'text-blue-400' : 
                               item.audioStatus === 'error' ? 'text-red-400' : 'text-slate-500'
                             }>
                               AUDIO: {item.audioStatus.toUpperCase()}
                             </span>
                             <span className="text-slate-700">|</span>
                             <span className={
                               item.vttStatus === 'done' ? 'text-emerald-400' : 
                               item.vttStatus === 'loading' ? 'text-blue-400' : 
                               item.vttStatus === 'error' ? 'text-red-400' : 'text-slate-500'
                             }>
                               VTT: {item.vttStatus.toUpperCase()}
                             </span>
                           </div>
                           {(item.wavBlob || item.vttContent) && (
                             <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/30">
                               {item.wavBlob && (
                                 <button 
                                   onClick={() => {
                                     const url = URL.createObjectURL(item.wavBlob!);
                                     const a = document.createElement('a');
                                     a.href = url;
                                     a.download = `audio_${idx + 1}.mp3`;
                                     document.body.appendChild(a);
                                     a.click();
                                     document.body.removeChild(a);
                                     URL.revokeObjectURL(url);
                                   }}
                                   className="p-1 px-2 bg-slate-800 hover:bg-slate-700 rounded text-emerald-400 transition-colors flex items-center gap-1 text-[8px] font-bold uppercase tracking-tighter"
                                   title="Download Audio"
                                 >
                                   <FileAudio className="w-2.5 h-2.5" /> MP3
                                 </button>
                               )}
                               {item.vttContent && (
                                 <button 
                                   onClick={() => {
                                     const blob = new Blob([item.vttContent!], { type: 'text/vtt' });
                                     const url = URL.createObjectURL(blob);
                                     const a = document.createElement('a');
                                     a.href = url;
                                     a.download = `captions_${idx + 1}.vtt`;
                                     document.body.appendChild(a);
                                     a.click();
                                     document.body.removeChild(a);
                                     URL.revokeObjectURL(url);
                                   }}
                                   className="p-1 px-2 bg-slate-800 hover:bg-slate-700 rounded text-emerald-400 transition-colors flex items-center gap-1 text-[8px] font-bold uppercase tracking-tighter"
                                   title="Download VTT"
                                 >
                                   <VideoIcon className="w-2.5 h-2.5" /> VTT
                                 </button>
                               )}
                               {(item.wavBlob || item.vttContent) && (
                                 <button 
                                   onClick={async () => {
                                     const JSZip = (await import('jszip')).default;
                                     const zip = new JSZip();
                                     if (item.wavBlob) zip.file('audio.mp3', item.wavBlob);
                                     if (item.vttContent) zip.file('captions.vtt', item.vttContent);
                                     
                                     const content = await zip.generateAsync({ type: 'blob' });
                                     const url = URL.createObjectURL(content);
                                     const a = document.createElement('a');
                                     a.href = url;
                                     a.download = `item_${idx + 1}.zip`;
                                     document.body.appendChild(a);
                                     a.click();
                                     document.body.removeChild(a);
                                     URL.revokeObjectURL(url);
                                   }}
                                   className="p-1 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors flex items-center gap-1 text-[8px] font-bold uppercase tracking-tighter ml-auto"
                                   title="Download Item ZIP"
                                 >
                                   <Download className="w-2.5 h-2.5" /> ZIP
                                 </button>
                               )}
                             </div>
                           )}
                           {item.errorMsg && (
                             <div className="text-red-400/80 leading-normal lowercase normal-case mt-1">{item.errorMsg}</div>
                           )}
                         </div>
                      </div>
                   ))}
                 </div>
               )}
            </div>
          ) : (
            <div className="glass rounded-2xl p-4 flex flex-col flex-1 overflow-hidden">
               <div className="flex flex-col h-full gap-3">
                 <div className="flex items-center justify-between">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                     Script Editor
                   </label>
                   <span className="text-[10px] text-slate-500 mono">{store.text.length} CHARS</span>
                 </div>
                 <textarea 
                   value={store.text}
                   onChange={(e) => store.setText(e.target.value)}
                   spellCheck={false}
                   className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-sm mono text-slate-200 resize-none focus:outline-none focus:border-emerald-500/50 transition-all custom-scrollbar"
                 />
               </div>
            </div>
          )}

          <div className="glass rounded-2xl p-4 shrink-0">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Voice Configuration</label>
             <div className="grid grid-cols-2 gap-3 mb-4">
               <div className="space-y-1.5">
                 <span className="text-[10px] text-slate-500 ml-1">PRIMARY VOICE</span>
                 <select 
                   value={store.selectedVoice}
                   onChange={(e) => store.setSelectedVoice(e.target.value)}
                   className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                 >
                   <option value="Puck">Puck</option>
                   <option value="Charon">Charon</option>
                   <option value="Kore">Kore</option>
                   <option value="Fenrir">Fenrir</option>
                   <option value="Zephyr">Zephyr</option>
                   <option value="Aoede">Aoede</option>
                 </select>
               </div>
               <div className="space-y-1.5">
                 <span className="text-[10px] text-slate-500 ml-1">SPEED SCALE</span>
                 <select 
                   value={store.speed}
                   onChange={(e) => store.setSpeed(e.target.value)}
                   className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                 >
                   <option value="Normal">Normal (1.0x)</option>
                   <option value="Slow">Slow (0.85x)</option>
                   <option value="Fast">Fast (1.25x)</option>
                 </select>
               </div>
             </div>

             {/* Tone removed for brevity/layout match or can be added in an advanced panel */}

             <div className="space-y-2 mt-4">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 ml-1 uppercase">Pronunciation Rules</span>
                  <div 
                    onClick={() => store.setAreRulesEnabled(!store.areRulesEnabled)}
                    className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${store.areRulesEnabled ? 'bg-emerald-500/20 border border-transparent' : 'bg-slate-700/50 border border-slate-600'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${store.areRulesEnabled ? 'right-0.5 bg-emerald-500' : 'left-0.5 bg-slate-400'}`}></div>
                  </div>
               </div>
               
               <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newRuleTarget}
                    onChange={e => setNewRuleTarget(e.target.value)}
                    placeholder="Word" 
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                  <input 
                    type="text" 
                    value={newRuleReplacement}
                    onChange={e => setNewRuleReplacement(e.target.value)}
                    placeholder="Phonetic" 
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                  <button 
                    onClick={handleAddRule}
                    className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-2.5 transition-colors border border-slate-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
               </div>

               {store.pronunciations.length > 0 && (
                 <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-2 mt-2">
                   {store.pronunciations.map(r => (
                     <div key={r.id} className="flex gap-2 items-center justify-between p-2 rounded bg-slate-950/50 border border-slate-800 text-[11px]">
                       <div className="flex gap-2 items-center">
                         <span className="text-emerald-400 mono">{r.targetPhrase}</span>
                         <span className="text-slate-500">→</span>
                         <span className="text-slate-300 mono">{r.phoneticReplacement}</span>
                       </div>
                       <button onClick={() => store.removeRule(r.id)} className="text-slate-500 hover:text-red-400">
                         <X className="w-3 h-3" />
                       </button>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>

          {store.appMode !== 'batch' && (
            <button 
              onClick={handleGenerate}
              disabled={store.isGeneratingAudio || !store.text.trim()}
              className="w-full bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl hover:bg-emerald-400 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {store.isGeneratingAudio ? (
                <span className="w-5 h-5 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"></span>
              ) : (
                <>
                  GENERATE AUDIO
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </>
              )}
            </button>
          )}
        </section>

        {/* Right Panel (Output Zone) */}
        <section className="flex-1 flex flex-col gap-4 overflow-hidden">
           {store.appMode === 'batch' ? <BatchMode /> : store.appMode === 'clip' ? <ClipMode /> : <StandardMode />}
        </section>
      </main>

      {/* Modals & Toasts */}
      {isConfigOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex justify-between items-center">
              API Configuration
              <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Google Gemini API Key</label>
                <input 
                  type="password" 
                  value={store.apiKey}
                  onChange={e => store.setApiKey(e.target.value)}
                  placeholder="AIzaSy..." 
                  className="w-full bg-slate-900 border border-slate-700/50 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-sm mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">TTS Model String</label>
                <input 
                  type="text" 
                  value={store.ttsModel}
                  onChange={e => store.setTtsModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/50 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-sm mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Captioning Model String</label>
                <input 
                  type="text" 
                  value={store.captionModel}
                  onChange={e => store.setCaptionModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/50 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-sm mono"
                />
              </div>
              <button 
                onClick={() => setIsConfigOpen(false)}
                className="mt-4 w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-bold transition-all text-sm shadow-lg shadow-emerald-500/10"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isFileManagerOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-100 flex justify-between items-center">
                Project Manager
                <button onClick={() => setIsFileManagerOpen(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
              </h2>
            </div>
            
            <div className="p-6 bg-slate-950/30 border-b border-slate-800 shrink-0 flex gap-2">
               <input 
                 value={projectNameInput}
                 onChange={e => setProjectNameInput(e.target.value)}
                 placeholder="Save current as new project..."
                 className="flex-1 bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
               />
               <button 
                 onClick={handleSaveProject}
                 className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-lg shadow-emerald-500/10 transition-colors"
               >
                 <Save className="w-4 h-4" /> Save
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
               {store.projects.length === 0 ? (
                 <div className="p-8 text-center text-slate-500 text-sm">No projects saved yet.</div>
               ) : (
                 <ul className="flex flex-col gap-2">
                   {store.projects.map(p => (
                     <li key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${store.currentProjectId === p.id ? 'bg-slate-800 border-emerald-500/30 node-active' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/80 transition-colors'}`}>
                       <div>
                         <div className="text-slate-200 font-medium text-sm">{p.name}</div>
                         <div className="text-[10px] text-slate-500 mono mt-0.5">{new Date(p.updatedAt).toLocaleString()}</div>
                       </div>
                       <div className="flex gap-2">
                         <button 
                           onClick={() => { store.openProject(p.id); setIsFileManagerOpen(false); }}
                           className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-slate-200 transition-colors"
                         >
                           Load
                         </button>
                         <button 
                           onClick={() => store.deleteProject(p.id)}
                           className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition-colors bg-slate-800 hover:bg-slate-700"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     </li>
                   ))}
                 </ul>
               )}
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 glass rounded-xl border border-slate-700 p-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
          <AlertCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium text-slate-200">{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="ml-4 text-slate-500 hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
