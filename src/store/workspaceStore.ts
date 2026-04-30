import { create } from 'zustand';

export interface Project {
  id: string;
  name: string;
  text: string;
  selectedVoice: string;
  tone: string;
  speed: string;
  pronunciations: PronunciationRule[];
  areRulesEnabled: boolean;
  updatedAt: number;
}

export type AppMode = 'standard' | 'clip' | 'batch';

export interface PronunciationRule {
  id: string;
  targetPhrase: string;
  phoneticReplacement: string;
}

export interface BatchItem {
  id: string;
  text: string;
  wavBlob: Blob | null;
  vttContent: string | null;
  audioStatus: 'idle' | 'loading' | 'done' | 'error';
  vttStatus: 'idle' | 'loading' | 'done' | 'error';
  errorMsg?: string;
}

export interface WorkspaceState {
  // Config
  apiKey: string;
  ttsModel: string;
  captionModel: string;
  setApiKey: (key: string) => void;
  setTtsModel: (model: string) => void;
  setCaptionModel: (model: string) => void;

  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  // Editor
  text: string;
  selectedVoice: string;
  tone: string;
  speed: string;
  setText: (text: string) => void;
  setSelectedVoice: (voice: string) => void;
  setTone: (tone: string) => void;
  setSpeed: (speed: string) => void;

  // Rules
  pronunciations: PronunciationRule[];
  areRulesEnabled: boolean;
  addRule: (rule: PronunciationRule) => void;
  removeRule: (id: string) => void;
  updateRule: (id: string, rule: Partial<PronunciationRule>) => void;
  setAreRulesEnabled: (enabled: boolean) => void;

  // Audio / Generated State
  wavUrl: string | null;
  audioBlob: Blob | null;
  isPlaying: boolean;
  volume: number;
  vttContent: string | null;
  isCaptioning: boolean;
  isGeneratingAudio: boolean;
  setWavUrl: (url: string | null) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setVttContent: (vtt: string | null) => void;
  setIsCaptioning: (isCaptioning: boolean) => void;
  setIsGeneratingAudio: (isGenerating: boolean) => void;

  // Video / Clip Mode
  clipUploadedFile: File | null;
  clipStartTime: number;
  clipEndTime: number;
  clipCurrentTime: number;
  clipDuration: number;
  setClipUploadedFile: (file: File | null) => void;
  setClipStartTime: (time: number) => void;
  setClipEndTime: (time: number) => void;
  setClipCurrentTime: (time: number) => void;
  setClipDuration: (time: number) => void;

  // Batch Mode
  batchItems: BatchItem[];
  isBatchProcessingAudio: boolean;
  isBatchProcessingVtt: boolean;
  batchStopRequested: boolean;

  setBatchItems: (items: BatchItem[] | ((prev: BatchItem[]) => BatchItem[])) => void;
  updateBatchItem: (id: string, updates: Partial<BatchItem>) => void;
  setBatchProcessingState: (state: Partial<{ isBatchProcessingAudio: boolean, isBatchProcessingVtt: boolean, batchStopRequested: boolean }>) => void;

  // RPM Limiting
  apiRequests: number[];
  logApiRequest: () => void;
  cooldownRemaining: number;
  setCooldownRemaining: (ms: number) => void;

  // File System
  projects: Project[];
  currentProjectId: string | null;
  loadProjects: () => void;
  saveProject: (name: string) => void;
  openProject: (id: string) => void;
  deleteProject: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  apiKey: process.env.GEMINI_API_KEY || '',
  ttsModel: 'gemini-3.1-flash-tts-preview',
  captionModel: 'gemini-3-flash-preview',
  setApiKey: (key) => set({ apiKey: key }),
  setTtsModel: (model) => set({ ttsModel: model }),
  setCaptionModel: (model) => set({ captionModel: model }),

  appMode: 'standard',
  setAppMode: (mode) => set({ appMode: mode }),

  text: 'Hello world! Welcome to ENunciate Studio.',
  selectedVoice: 'Puck',
  tone: 'Neutral',
  speed: 'Normal',
  setText: (text) => set({ text }),
  setSelectedVoice: (voice) => set({ selectedVoice: voice }),
  setTone: (tone) => set({ tone }),
  setSpeed: (speed) => set({ speed }),

  pronunciations: [],
  areRulesEnabled: true,
  addRule: (rule) => set((state) => ({ pronunciations: [...state.pronunciations, rule] })),
  removeRule: (id) => set((state) => ({ pronunciations: state.pronunciations.filter(r => r.id !== id) })),
  updateRule: (id, rule) => set((state) => ({
    pronunciations: state.pronunciations.map(r => r.id === id ? { ...r, ...rule } : r)
  })),
  setAreRulesEnabled: (enabled) => set({ areRulesEnabled: enabled }),

  wavUrl: null,
  audioBlob: null,
  isPlaying: false,
  volume: 0.8,
  vttContent: null,
  isCaptioning: false,
  isGeneratingAudio: false,
  setWavUrl: (url) => set({ wavUrl: url }),
  setAudioBlob: (blob) => set({ audioBlob: blob }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  setVttContent: (vtt) => set({ vttContent: vtt }),
  setIsCaptioning: (isCaptioning) => set({ isCaptioning }),
  setIsGeneratingAudio: (isGeneratingAudio) => set({ isGeneratingAudio }),

  clipUploadedFile: null,
  clipStartTime: 0,
  clipEndTime: 10,
  clipCurrentTime: 0,
  clipDuration: 0,
  setClipUploadedFile: (file) => set({ clipUploadedFile: file }),
  setClipStartTime: (time) => set({ clipStartTime: time }),
  setClipEndTime: (time) => set({ clipEndTime: time }),
  setClipCurrentTime: (time) => set({ clipCurrentTime: time }),
  setClipDuration: (time) => set({ clipDuration: time }),

  batchItems: [],
  isBatchProcessingAudio: false,
  isBatchProcessingVtt: false,
  batchStopRequested: false,
  setBatchItems: (items) => set((state) => ({ 
    batchItems: typeof items === 'function' ? items(state.batchItems) : items 
  })),
  updateBatchItem: (id, updates) => set((state) => ({
    batchItems: state.batchItems.map(item => item.id === id ? { ...item, ...updates } : item)
  })),
  setBatchProcessingState: (updates) => set((state) => ({ ...state, ...updates })),

  apiRequests: [],
  logApiRequest: () => set((state) => {
    const now = Date.now();
    const oneMinAgo = now - 60000;
    const currentRequests = state.apiRequests || [];
    return { apiRequests: [...currentRequests.filter(time => time > oneMinAgo), now] };
  }),
  cooldownRemaining: 0,
  setCooldownRemaining: (time) => set({ cooldownRemaining: time }),

  projects: [],
  currentProjectId: null,
  loadProjects: () => {
    const data = localStorage.getItem('enunciate_projects');
    if (data) {
      try {
        set({ projects: JSON.parse(data) });
      } catch (e) {
        console.error("Failed to parse projects", e);
      }
    }
  },
  saveProject: (name: string) => {
    const state = get();
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      text: state.text,
      selectedVoice: state.selectedVoice,
      tone: state.tone,
      speed: state.speed,
      pronunciations: state.pronunciations,
      areRulesEnabled: state.areRulesEnabled,
      updatedAt: Date.now(),
    };
    
    // Update existing or add new
    let updatedProjects = [...state.projects];
    if (state.currentProjectId) {
      const idx = updatedProjects.findIndex(p => p.id === state.currentProjectId);
      if (idx !== -1) {
        updatedProjects[idx] = { ...newProject, id: state.currentProjectId, name: updatedProjects[idx].name };
      } else {
        updatedProjects.push(newProject);
      }
    } else {
      updatedProjects.push(newProject);
      set({ currentProjectId: newProject.id });
    }
    
    set({ projects: updatedProjects });
    localStorage.setItem('enunciate_projects', JSON.stringify(updatedProjects));
  },
  openProject: (id: string) => {
    const project = get().projects.find(p => p.id === id);
    if (project) {
      set({
        currentProjectId: project.id,
        text: project.text,
        selectedVoice: project.selectedVoice,
        tone: project.tone,
        speed: project.speed,
        pronunciations: project.pronunciations || [],
        areRulesEnabled: project.areRulesEnabled ?? true,
        wavUrl: null, // clear previous generated data
        audioBlob: null,
        vttContent: null,
      });
    }
  },
  deleteProject: (id: string) => {
    const state = get();
    const updated = state.projects.filter(p => p.id !== id);
    set({ projects: updated });
    if (state.currentProjectId === id) set({ currentProjectId: null });
    localStorage.setItem('enunciate_projects', JSON.stringify(updated));
  }
}));
